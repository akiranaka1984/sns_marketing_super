import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { weeklyReviews, postAnalytics, posts } from "../drizzle/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { analyzeAgentPerformance, saveInsightsToKnowledge } from "./services/engagement-analyzer";
import { generateOptimizationSuggestions, applyMultipleOptimizations } from "./services/strategy-optimizer";

/**
 * Weekly Review Router
 * Manages weekly performance reviews and AI-generated insights
 */

export const weeklyReviewRouter = router({
  /**
   * Run auto-optimization for an agent
   */
  autoOptimize: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      daysBack: z.number().default(7),
      autoApply: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      console.log(`[WeeklyReview] Running auto-optimization for agent ${input.agentId}`);

      // エンゲージメント分析を実行
      const analysis = await analyzeAgentPerformance(input.agentId, input.daysBack);

      if (analysis.totalPosts === 0) {
        return {
          success: false,
          message: '分析対象の投稿がありません',
          analysis: null,
          suggestions: [],
          applied: null,
        };
      }

      // インサイトを知識ベースに保存
      await saveInsightsToKnowledge(input.agentId, analysis.insights);

      // 最適化提案を生成
      const suggestions = await generateOptimizationSuggestions(input.agentId, analysis.insights);

      let appliedResult = null;
      if (input.autoApply && suggestions.length > 0) {
        // 自動適用
        appliedResult = await applyMultipleOptimizations(input.agentId, suggestions);
      }

      return {
        success: true,
        message: `${analysis.totalPosts}件の投稿を分析し、${suggestions.length}件の最適化提案を生成しました`,
        analysis: {
          totalPosts: analysis.totalPosts,
          avgEngagementRate: analysis.avgEngagementRate,
          topPostsCount: analysis.topPosts.length,
          insightsCount: analysis.insights.length,
        },
        suggestions,
        applied: appliedResult,
      };
    }),

  /**
   * Generate weekly review
   */
  generateReview: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      weekStartDate: z.date(),
      weekEndDate: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[WeeklyReview] Generating review for week:", input.weekStartDate, "to", input.weekEndDate);

      // Get all posts in the date range
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(posts.projectId, input.projectId));
      }
      conditions.push(gte(posts.createdAt, input.weekStartDate));
      conditions.push(lte(posts.createdAt, input.weekEndDate));

      const weekPosts = await db
        .select()
        .from(posts)
        .where(and(...conditions));

      // Get analytics for these posts
      const analytics = await db
        .select()
        .from(postAnalytics)
        .where(
          and(
            gte(postAnalytics.recordedAt, input.weekStartDate),
            lte(postAnalytics.recordedAt, input.weekEndDate)
          )
        );

      // Calculate aggregated metrics
      const totalPosts = weekPosts.length;
      const totalViews = analytics.reduce((sum, a) => sum + (a.viewsCount ?? 0), 0);
      const totalLikes = analytics.reduce((sum, a) => sum + (a.likesCount ?? 0), 0);
      const totalComments = analytics.reduce((sum, a) => sum + (a.commentsCount ?? 0), 0);
      const totalShares = analytics.reduce((sum, a) => sum + (a.sharesCount ?? 0), 0);
      const avgEngagementRate = analytics.length > 0
        ? Math.round(analytics.reduce((sum, a) => sum + (a.engagementRate ?? 0), 0) / analytics.length)
        : 0;

      // Generate AI insights
      const insightsPrompt = `Analyze the following weekly social media performance data and provide insights:

Total Posts: ${totalPosts}
Total Views: ${totalViews}
Total Likes: ${totalLikes}
Total Comments: ${totalComments}
Total Shares: ${totalShares}
Average Engagement Rate: ${avgEngagementRate / 100}%

Provide:
1. Key performance highlights
2. Areas for improvement
3. Trending patterns
4. Engagement analysis

Format the response as JSON with keys: highlights, improvements, trends, engagement`;

      let insights: any = {};
      let recommendations: any = {};

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a social media analytics expert." },
            { role: "user", content: insightsPrompt },
          ],
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "weekly_insights",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  highlights: { type: "array", items: { type: "string" } },
                  improvements: { type: "array", items: { type: "string" } },
                  trends: { type: "array", items: { type: "string" } },
                  engagement: { type: "string" },
                },
                required: ["highlights", "improvements", "trends", "engagement"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (content && typeof content === 'string') {
          insights = JSON.parse(content);
        }

        // Generate recommendations
        const recommendationsPrompt = `Based on the following performance data, provide 3-5 actionable recommendations:

Total Posts: ${totalPosts}
Average Engagement Rate: ${avgEngagementRate / 100}%
Total Views: ${totalViews}

Format as JSON array of strings.`;

        const recResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are a social media strategy consultant." },
            { role: "user", content: recommendationsPrompt },
          ],
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "recommendations",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  recommendations: { type: "array", items: { type: "string" } },
                },
                required: ["recommendations"],
                additionalProperties: false,
              },
            },
          },
        });

        const recContent = recResponse.choices[0]?.message?.content;
        if (recContent && typeof recContent === 'string') {
          recommendations = JSON.parse(recContent);
        }
      } catch (error: any) {
        console.error("[WeeklyReview] Error generating AI insights:", error);
        insights = {
          highlights: ["データ収集完了"],
          improvements: ["AI分析は利用できません"],
          trends: [],
          engagement: "分析中",
        };
        recommendations = {
          recommendations: ["AI推奨事項は利用できません"],
        };
      }

      // Save review to database
      await db.insert(weeklyReviews).values({
        userId: ctx.user.id,
        projectId: input.projectId ?? null,
        weekStartDate: input.weekStartDate,
        weekEndDate: input.weekEndDate,
        totalPosts,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        avgEngagementRate,
        insights: JSON.stringify(insights),
        recommendations: JSON.stringify(recommendations),
      });

      return {
        success: true,
        review: {
          totalPosts,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          avgEngagementRate: avgEngagementRate / 100,
          insights,
          recommendations,
        },
      };
    }),

  /**
   * List weekly reviews
   */
  listReviews: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(weeklyReviews.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(weeklyReviews.projectId, input.projectId));
      }

      const reviews = await db
        .select()
        .from(weeklyReviews)
        .where(and(...conditions))
        .orderBy(desc(weeklyReviews.weekStartDate))
        .limit(input.limit);

      return reviews.map((review) => ({
        ...review,
        insights: review.insights ? JSON.parse(review.insights) : {},
        recommendations: review.recommendations ? JSON.parse(review.recommendations) : {},
        avgEngagementRate: review.avgEngagementRate ? review.avgEngagementRate / 100 : 0,
      }));
    }),

  /**
   * Get review by ID
   */
  getReviewById: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const [review] = await db
        .select()
        .from(weeklyReviews)
        .where(
          and(
            eq(weeklyReviews.id, input.id),
            eq(weeklyReviews.userId, ctx.user.id)
          )
        );

      if (!review) {
        throw new Error("Review not found");
      }

      return {
        ...review,
        insights: review.insights ? JSON.parse(review.insights) : {},
        recommendations: review.recommendations ? JSON.parse(review.recommendations) : {},
        avgEngagementRate: review.avgEngagementRate ? review.avgEngagementRate / 100 : 0,
      };
    }),

  /**
   * Delete review
   */
  deleteReview: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(weeklyReviews)
        .where(
          and(
            eq(weeklyReviews.id, input.id),
            eq(weeklyReviews.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Get current week date range
   */
  getCurrentWeekRange: protectedProcedure
    .query(async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as start of week

      const weekStartDate = new Date(now);
      weekStartDate.setDate(now.getDate() - diff);
      weekStartDate.setHours(0, 0, 0, 0);

      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);

      return {
        weekStartDate,
        weekEndDate,
      };
    }),
});
