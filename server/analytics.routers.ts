import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { postAnalytics, accounts, scheduledPosts, hashtagPerformance, modelAccounts, modelAccountBehaviorPatterns } from "../drizzle/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, inArray, asc } from "drizzle-orm";
import { getTopHashtags, getHashtagCombinations, compareWithModelAccountHashtags } from "./services/hashtag-analyzer";
import { getFunnelData, getPostFunnelContribution } from "./services/funnel-tracker";

export const analyticsRouter = router({
  /**
   * Get performance overview for all accounts
   */
  getOverview: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get all user accounts
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = userAccounts.map((acc) => acc.id);

      if (accountIds.length === 0) {
        return {
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          avgEngagementRate: 0,
          accountPerformance: [],
        };
      }

      // Build date filter
      let dateFilter = sql`1=1`;
      if (input.startDate) {
        dateFilter = and(
          dateFilter,
          gte(postAnalytics.recordedAt, new Date(input.startDate).toISOString())
        )!;
      }
      if (input.endDate) {
        dateFilter = and(
          dateFilter,
          lte(postAnalytics.recordedAt, new Date(input.endDate).toISOString())
        )!;
      }

      // Get aggregated analytics
      const analytics = await db
        .select({
          accountId: postAnalytics.accountId,
          totalPosts: sql<number>`COUNT(*)`,
          totalViews: sql<number>`SUM(${postAnalytics.viewsCount})`,
          totalLikes: sql<number>`SUM(${postAnalytics.likesCount})`,
          totalComments: sql<number>`SUM(${postAnalytics.commentsCount})`,
          totalShares: sql<number>`SUM(${postAnalytics.sharesCount})`,
          avgEngagementRate: sql<number>`AVG(${postAnalytics.engagementRate})`,
        })
        .from(postAnalytics)
        .where(and(inArray(postAnalytics.accountId, accountIds), dateFilter))
        .groupBy(postAnalytics.accountId);

      // Calculate totals
      const totals = analytics.reduce(
        (acc, curr) => ({
          totalPosts: acc.totalPosts + Number(curr.totalPosts),
          totalViews: acc.totalViews + Number(curr.totalViews || 0),
          totalLikes: acc.totalLikes + Number(curr.totalLikes || 0),
          totalComments: acc.totalComments + Number(curr.totalComments || 0),
          totalShares: acc.totalShares + Number(curr.totalShares || 0),
          avgEngagementRate:
            acc.avgEngagementRate + Number(curr.avgEngagementRate || 0),
        }),
        {
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          avgEngagementRate: 0,
        }
      );

      // Calculate average engagement rate
      if (analytics.length > 0) {
        totals.avgEngagementRate = totals.avgEngagementRate / analytics.length;
      }

      // Get account performance details
      const accountPerformance = await Promise.all(
        analytics.map(async (analytic) => {
          const account = userAccounts.find((acc) => acc.id === analytic.accountId);
          return {
            accountId: analytic.accountId,
            accountName: account?.username || "Unknown",
            platform: account?.platform || "unknown",
            totalPosts: Number(analytic.totalPosts),
            totalViews: Number(analytic.totalViews || 0),
            totalLikes: Number(analytic.totalLikes || 0),
            totalComments: Number(analytic.totalComments || 0),
            totalShares: Number(analytic.totalShares || 0),
            avgEngagementRate: Number(analytic.avgEngagementRate || 0) / 100, // Convert back to percentage
          };
        })
      );

      return {
        ...totals,
        avgEngagementRate: totals.avgEngagementRate / 100, // Convert back to percentage
        accountPerformance,
      };
    }),

  /**
   * Get time-series analytics data for charts
   */
  getTimeSeries: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
        interval: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Verify account ownership if accountId is provided
      if (input.accountId) {
        const account = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
          .limit(1);

        if (account.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Account not found or access denied",
          });
        }
      }

      // Build query
      // Build date column for grouping using proper SQL template
      const dateColumn = sql<string>`DATE(\`recordedAt\`)`;

      let query = db
        .select({
          date: dateColumn,
          views: sql<number>`SUM(\`viewsCount\`)`,
          likes: sql<number>`SUM(\`likesCount\`)`,
          comments: sql<number>`SUM(\`commentsCount\`)`,
          shares: sql<number>`SUM(\`sharesCount\`)`,
          engagementRate: sql<number>`AVG(\`engagementRate\`)`,
        })
        .from(postAnalytics)
        .where(
          and(
            gte(postAnalytics.recordedAt, new Date(input.startDate).toISOString()),
            lte(postAnalytics.recordedAt, new Date(input.endDate).toISOString()),
            input.accountId
              ? eq(postAnalytics.accountId, input.accountId)
              : undefined
          )
        )
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const results = await query;

      return results.map((row) => ({
        date: row.date,
        views: Number(row.views || 0),
        likes: Number(row.likes || 0),
        comments: Number(row.comments || 0),
        shares: Number(row.shares || 0),
        engagementRate: Number(row.engagementRate || 0) / 100,
      }));
    }),

  /**
   * Get top performing posts
   */
  getTopPosts: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        limit: z.number().default(10),
        sortBy: z.enum(["views", "likes", "engagement"]).default("engagement"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get user accounts
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = input.accountId
        ? [input.accountId]
        : userAccounts.map((acc) => acc.id);

      if (accountIds.length === 0) {
        return [];
      }

      // Get top posts based on sort criteria
      let topPosts;
      if (input.sortBy === "views") {
        topPosts = await db
          .select({
            postId: postAnalytics.postId,
            accountId: postAnalytics.accountId,
            platform: postAnalytics.platform,
            views: postAnalytics.viewsCount,
            likes: postAnalytics.likesCount,
            comments: postAnalytics.commentsCount,
            shares: postAnalytics.sharesCount,
            engagementRate: postAnalytics.engagementRate,
            recordedAt: postAnalytics.recordedAt,
          })
          .from(postAnalytics)
          .where(inArray(postAnalytics.accountId, accountIds))
          .orderBy(desc(postAnalytics.viewsCount))
          .limit(input.limit);
      } else if (input.sortBy === "likes") {
        topPosts = await db
          .select({
            postId: postAnalytics.postId,
            accountId: postAnalytics.accountId,
            platform: postAnalytics.platform,
            views: postAnalytics.viewsCount,
            likes: postAnalytics.likesCount,
            comments: postAnalytics.commentsCount,
            shares: postAnalytics.sharesCount,
            engagementRate: postAnalytics.engagementRate,
            recordedAt: postAnalytics.recordedAt,
          })
          .from(postAnalytics)
          .where(inArray(postAnalytics.accountId, accountIds))
          .orderBy(desc(postAnalytics.likesCount))
          .limit(input.limit);
      } else {
        topPosts = await db
          .select({
            postId: postAnalytics.postId,
            accountId: postAnalytics.accountId,
            platform: postAnalytics.platform,
            views: postAnalytics.viewsCount,
            likes: postAnalytics.likesCount,
            comments: postAnalytics.commentsCount,
            shares: postAnalytics.sharesCount,
            engagementRate: postAnalytics.engagementRate,
            recordedAt: postAnalytics.recordedAt,
          })
          .from(postAnalytics)
          .where(inArray(postAnalytics.accountId, accountIds))
          .orderBy(desc(postAnalytics.engagementRate))
          .limit(input.limit);
      }

      // Get post content from scheduled_posts
      const postsWithContent = await Promise.all(
        topPosts.map(async (post) => {
          const postContent = await db
            .select()
            .from(scheduledPosts)
            .where(eq(scheduledPosts.id, post.postId))
            .limit(1);

          const account = userAccounts.find((acc) => acc.id === post.accountId);

          return {
            ...post,
            content: postContent[0]?.content || "",
            accountName: account?.username || "Unknown",
            engagementRate: post.engagementRate / 100,
          };
        })
      );

      return postsWithContent;
    }),

  /**
   * Record analytics data (called after posting)
   */
  recordAnalytics: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        accountId: z.number(),
        platform: z.enum(["twitter", "tiktok", "instagram", "facebook"]),
        views: z.number().default(0),
        likes: z.number().default(0),
        comments: z.number().default(0),
        shares: z.number().default(0),
        saves: z.number().default(0),
        clicks: z.number().default(0),
        reach: z.number().default(0),
        impressions: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Calculate engagement rate
      const totalEngagements = input.likes + input.comments + input.shares;
      const engagementRate =
        input.impressions > 0
          ? Math.round((totalEngagements / input.impressions) * 10000) // Store as percentage * 100
          : 0;

      // Insert analytics record
      await db.insert(postAnalytics).values({
        postId: input.postId,
        accountId: input.accountId,
        platform: input.platform,
        viewsCount: input.views,
        likesCount: input.likes,
        commentsCount: input.comments,
        sharesCount: input.shares,
        savesCount: input.saves,
        clicksCount: input.clicks,
        engagementRate,
        reachCount: input.reach,
        impressionsCount: input.impressions,
        recordedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  /**
   * Get heatmap data (7x24 grid of engagement by day-of-week and hour)
   */
  getHeatmapData: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = input.accountId
        ? [input.accountId]
        : userAccounts.map((acc) => acc.id);

      if (accountIds.length === 0) {
        return { cells: [], recommendation: "" };
      }

      const conditions = [inArray(postAnalytics.accountId, accountIds)];
      if (input.startDate) {
        conditions.push(gte(postAnalytics.recordedAt, new Date(input.startDate).toISOString()));
      }
      if (input.endDate) {
        conditions.push(lte(postAnalytics.recordedAt, new Date(input.endDate).toISOString()));
      }

      // Group by day of week and hour
      const rows = await db
        .select({
          dayOfWeek: sql<number>`DAYOFWEEK(${postAnalytics.recordedAt}) - 1`,
          hour: sql<number>`HOUR(${postAnalytics.recordedAt})`,
          avgEngagementRate: sql<number>`AVG(${postAnalytics.engagementRate})`,
          postCount: sql<number>`COUNT(*)`,
        })
        .from(postAnalytics)
        .where(and(...conditions))
        .groupBy(
          sql`DAYOFWEEK(${postAnalytics.recordedAt})`,
          sql`HOUR(${postAnalytics.recordedAt})`
        );

      const cells = rows.map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        hour: Number(row.hour),
        engagementRate: Number(row.avgEngagementRate || 0) / 100,
        postCount: Number(row.postCount),
      }));

      // Find best time slot
      let recommendation = "";
      if (cells.length > 0) {
        const best = cells.reduce((a, b) =>
          a.engagementRate > b.engagementRate ? a : b
        );
        const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
        recommendation = `最もエンゲージメントが高い時間帯: ${dayNames[best.dayOfWeek]}曜日 ${best.hour}時`;
      }

      return { cells, recommendation };
    }),

  /**
   * Get hashtag performance ranking
   */
  getHashtagRanking: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      return await getTopHashtags({
        accountId: input.accountId,
        projectId: input.projectId,
        limit: input.limit,
      });
    }),

  /**
   * Get hashtag trend data
   */
  getHashtagTrends: protectedProcedure
    .input(
      z.object({
        hashtag: z.string(),
        accountId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      // Get usage history from hashtagPerformance
      const conditions = [eq(hashtagPerformance.hashtag, input.hashtag)];
      if (input.accountId) {
        conditions.push(eq(hashtagPerformance.accountId, input.accountId));
      }

      const results = await db
        .select()
        .from(hashtagPerformance)
        .where(and(...conditions))
        .orderBy(desc(hashtagPerformance.updatedAt))
        .limit(30);

      return results.map((r) => ({
        hashtag: r.hashtag,
        usageCount: r.usageCount,
        avgLikes: r.avgLikes,
        avgComments: r.avgComments,
        avgShares: r.avgShares,
        avgEngagementRate: r.avgEngagementRate,
        trendScore: r.trendScore,
        lastUsedAt: r.lastUsedAt,
      }));
    }),

  /**
   * Get model account hashtags for comparison
   */
  getModelAccountHashtags: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // If no accountId provided, use first user account
      let accountId = input.accountId;
      if (!accountId) {
        const userAccounts = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.userId, ctx.user.id))
          .limit(1);
        accountId = userAccounts[0]?.id;
      }
      if (!accountId) {
        return { ownTopHashtags: [], modelTopHashtags: [], recommended: [] };
      }
      return await compareWithModelAccountHashtags(accountId, input.projectId);
    }),

  /**
   * Get competitor comparison data (your accounts vs model accounts)
   */
  getCompetitorComparison: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get user's accounts
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = input.accountId
        ? [input.accountId]
        : userAccounts.map((acc) => acc.id);

      // Get user's analytics summary
      const myAnalytics = accountIds.length > 0
        ? await db
            .select({
              totalPosts: sql<number>`COUNT(*)`,
              avgLikes: sql<number>`AVG(${postAnalytics.likesCount})`,
              avgComments: sql<number>`AVG(${postAnalytics.commentsCount})`,
              avgShares: sql<number>`AVG(${postAnalytics.sharesCount})`,
              avgEngagementRate: sql<number>`AVG(${postAnalytics.engagementRate})`,
            })
            .from(postAnalytics)
            .where(inArray(postAnalytics.accountId, accountIds))
        : [{ totalPosts: 0, avgLikes: 0, avgComments: 0, avgShares: 0, avgEngagementRate: 0 }];

      // Get model accounts behavior patterns
      const modelConditions = input.projectId
        ? [eq(modelAccounts.projectId, input.projectId)]
        : [];

      const models = await db
        .select()
        .from(modelAccounts)
        .where(modelConditions.length > 0 ? and(...modelConditions) : undefined)
        .limit(20);

      const modelIds = models.map((m) => m.id);

      const modelPatterns = modelIds.length > 0
        ? await db
            .select()
            .from(modelAccountBehaviorPatterns)
            .where(inArray(modelAccountBehaviorPatterns.modelAccountId, modelIds))
        : [];

      // Calculate model averages
      const modelAvgPostsPerWeek = modelPatterns.length > 0
        ? modelPatterns.reduce((sum, p) => sum + Number(p.avgPostsPerDay || 0), 0) / modelPatterns.length * 7
        : 0;
      const modelAvgEngagementRate = modelPatterns.length > 0
        ? modelPatterns.reduce((sum, p) => sum + Number(p.avgEngagementRate || 0), 0) / modelPatterns.length
        : 0;

      const my = myAnalytics[0];

      return {
        myStats: {
          totalPosts: Number(my?.totalPosts || 0),
          avgLikes: Math.round(Number(my?.avgLikes || 0)),
          avgComments: Math.round(Number(my?.avgComments || 0)),
          avgShares: Math.round(Number(my?.avgShares || 0)),
          avgEngagementRate: Number(my?.avgEngagementRate || 0) / 100,
        },
        modelStats: {
          accountCount: models.length,
          avgPostsPerWeek: Math.round(modelAvgPostsPerWeek * 10) / 10,
          avgEngagementRate: Math.round(modelAvgEngagementRate * 100) / 100,
          topModels: models.slice(0, 5).map((m) => ({
            id: m.id,
            handle: m.username,
            platform: m.platform,
            followerCount: m.followersCount,
          })),
        },
        modelPatterns: modelPatterns.map((p) => ({
          modelAccountId: p.modelAccountId,
          avgPostsPerDay: p.avgPostsPerDay,
          avgEngagementRate: p.avgEngagementRate,
          avgContentLength: p.avgContentLength,
          hashtagAvgCount: p.hashtagAvgCount,
        })),
      };
    }),

  /**
   * Get gap analysis between your accounts and model accounts
   */
  getGapAnalysis: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = input.accountId
        ? [input.accountId]
        : userAccounts.map((acc) => acc.id);

      // My stats
      const myStats = accountIds.length > 0
        ? await db
            .select({
              avgLikes: sql<number>`AVG(${postAnalytics.likesCount})`,
              avgComments: sql<number>`AVG(${postAnalytics.commentsCount})`,
              avgEngagementRate: sql<number>`AVG(${postAnalytics.engagementRate})`,
              postCount: sql<number>`COUNT(*)`,
            })
            .from(postAnalytics)
            .where(inArray(postAnalytics.accountId, accountIds))
        : [{ avgLikes: 0, avgComments: 0, avgEngagementRate: 0, postCount: 0 }];

      // Model stats
      const modelConditions = input.projectId
        ? [eq(modelAccounts.projectId, input.projectId)]
        : [];

      const models = await db
        .select()
        .from(modelAccounts)
        .where(modelConditions.length > 0 ? and(...modelConditions) : undefined);

      const modelIds = models.map((m) => m.id);
      const patterns = modelIds.length > 0
        ? await db
            .select()
            .from(modelAccountBehaviorPatterns)
            .where(inArray(modelAccountBehaviorPatterns.modelAccountId, modelIds))
        : [];

      const my = myStats[0];
      const myLikes = Number(my?.avgLikes || 0);
      const myComments = Number(my?.avgComments || 0);
      const myEngRate = Number(my?.avgEngagementRate || 0) / 100;

      const modelAvgEngRate = patterns.length > 0
        ? patterns.reduce((s, p) => s + Number(p.avgEngagementRate || 0), 0) / patterns.length
        : 0;

      const gaps = [];

      if (modelAvgEngRate > 0 && myEngRate < modelAvgEngRate) {
        const gapPct = Math.round(((modelAvgEngRate - myEngRate) / modelAvgEngRate) * 100);
        gaps.push({
          metric: "エンゲージメント率",
          myValue: Math.round(myEngRate * 100) / 100,
          modelValue: Math.round(modelAvgEngRate * 100) / 100,
          gapPercentage: gapPct,
          recommendation: `モデルアカウントのエンゲージメント率は${modelAvgEngRate.toFixed(2)}%。コンテンツの質と投稿タイミングを改善しましょう。`,
          priority: gapPct > 50 ? "high" : gapPct > 25 ? "medium" : "low",
        });
      }

      if (myLikes < 10) {
        gaps.push({
          metric: "平均いいね数",
          myValue: Math.round(myLikes),
          modelValue: 0,
          gapPercentage: 0,
          recommendation: `いいね数を増やすため、ビジュアルコンテンツの質を上げましょう。`,
          priority: "medium" as const,
        });
      }

      if (myComments < 5) {
        gaps.push({
          metric: "平均コメント数",
          myValue: Math.round(myComments),
          modelValue: 0,
          gapPercentage: 0,
          recommendation: `質問形式や議論を促す投稿を増やし、コメントを獲得しましょう。`,
          priority: "medium" as const,
        });
      }

      const modelAvgPostsDay = patterns.length > 0
        ? patterns.reduce((s, p) => s + Number(p.avgPostsPerDay || 0), 0) / patterns.length
        : 0;
      if (modelAvgPostsDay > 0) {
        gaps.push({
          metric: "投稿頻度",
          myValue: Number(my?.postCount || 0),
          modelValue: Math.round(modelAvgPostsDay * 7),
          gapPercentage: 0,
          recommendation: `モデルアカウントは1日平均${modelAvgPostsDay.toFixed(1)}回投稿。コンスタントな投稿を心がけましょう。`,
          priority: "medium" as const,
        });
      }

      return { gaps };
    }),

  /**
   * Get funnel data for visualization
   */
  getFunnelData: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await getFunnelData({
        accountId: input.accountId,
        projectId: input.projectId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),

  /**
   * Get post-level funnel contribution
   */
  getPostFunnelContribution: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      return await getPostFunnelContribution({
        accountId: input.accountId,
        projectId: input.projectId,
        limit: input.limit,
      });
    }),
});
