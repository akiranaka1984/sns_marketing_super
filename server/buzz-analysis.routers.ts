import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { buzzPosts, buzzLearnings, agentKnowledge, accounts, learningSyncLog } from "../drizzle/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { analyzeBuzzPost, extractBuzzPatterns, generateLearningEntry } from "./services/buzz-analyzer";
import { classifyPost } from "./services/category-classifier";
import { syncLearningsToLinkedProjects } from "./project-model-accounts.routers";
import { applyBuzzLearningToAccount } from "./services/account-learning-service";
import {
  extractTextFromImage,
  extractPostFromScreenshot,
  analyzeImageViralPotential
} from "./services/ocr-service";
import {
  runDetectionCycle,
  startBuzzDetectionScheduler,
  stopBuzzDetectionScheduler,
  getSchedulerStatus,
  detectBuzzForAccount
} from "./services/buzz-detection-scheduler";

// Enums for validation
const industryCategories = [
  'it_tech', 'beauty_fashion', 'food_restaurant', 'finance_investment',
  'health_fitness', 'education', 'entertainment', 'travel', 'business', 'other'
] as const;

const postTypes = [
  'announcement', 'empathy', 'educational', 'humor',
  'promotional', 'question', 'other'
] as const;

const learningTypes = [
  'hook_pattern', 'structure_pattern', 'hashtag_strategy',
  'timing_pattern', 'cta_pattern', 'media_usage', 'tone_pattern'
] as const;

export const buzzAnalysisRouter = router({
  // List buzz posts with filters
  listBuzzPosts: protectedProcedure
    .input(z.object({
      sourceType: z.enum(['own_account', 'model_account']).optional(),
      industryCategory: z.enum(industryCategories).optional(),
      postType: z.enum(postTypes).optional(),
      minViralityScore: z.number().optional(),
      isAnalyzed: z.boolean().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      let conditions = [eq(buzzPosts.userId, ctx.user.id)];

      if (input.sourceType) {
        conditions.push(eq(buzzPosts.sourceType, input.sourceType));
      }
      if (input.industryCategory) {
        conditions.push(eq(buzzPosts.industryCategory, input.industryCategory));
      }
      if (input.postType) {
        conditions.push(eq(buzzPosts.postType, input.postType));
      }
      if (input.minViralityScore !== undefined) {
        conditions.push(gte(buzzPosts.viralityScore, input.minViralityScore));
      }
      if (input.isAnalyzed !== undefined) {
        conditions.push(eq(buzzPosts.isAnalyzed, input.isAnalyzed ? 1 : 0));
      }

      const posts = await db
        .select()
        .from(buzzPosts)
        .where(and(...conditions))
        .orderBy(desc(buzzPosts.viralityScore))
        .limit(input.limit)
        .offset(input.offset);

      return posts;
    }),

  // Get a single buzz post by ID
  getBuzzPost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await db.query.buzzPosts.findFirst({
        where: and(
          eq(buzzPosts.id, input.id),
          eq(buzzPosts.userId, ctx.user.id)
        ),
      });
      return post;
    }),

  // Analyze a single buzz post
  analyzeBuzzPost: protectedProcedure
    .input(z.object({ buzzPostId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.query.buzzPosts.findFirst({
        where: and(
          eq(buzzPosts.id, input.buzzPostId),
          eq(buzzPosts.userId, ctx.user.id)
        ),
      });

      if (!post) {
        return { success: false, error: "Buzz post not found" };
      }

      try {
        // Classify the post
        const hasImage = post.contentFormat === 'with_image';
        const hasVideo = post.contentFormat === 'with_video';
        const isThread = post.contentFormat === 'thread';

        const classification = await classifyPost(
          post.content || '',
          hasImage,
          hasVideo,
          isThread
        );

        // Analyze the post
        const analysis = await analyzeBuzzPost(
          post.content || '',
          hasImage,
          hasVideo,
          isThread,
          {
            likes: post.likesCount || 0,
            comments: post.commentsCount || 0,
            shares: post.sharesCount || 0,
            views: post.viewsCount || undefined,
          }
        );

        // Update the post with analysis results
        await db.update(buzzPosts)
          .set({
            industryCategory: classification.industryCategory,
            postType: classification.postType,
            toneStyle: classification.toneStyle,
            contentFormat: classification.contentFormat,
            successFactors: JSON.stringify(analysis.successFactors),
            hookAnalysis: JSON.stringify(analysis.hookAnalysis),
            ctaAnalysis: JSON.stringify(analysis.ctaAnalysis),
            isAnalyzed: 1,
          })
          .where(eq(buzzPosts.id, input.buzzPostId));

        return {
          success: true,
          classification,
          analysis,
        };
      } catch (error: any) {
        console.error("[BuzzAnalysis] Error analyzing post:", error);
        return { success: false, error: error.message };
      }
    }),

  // Batch analyze multiple buzz posts
  batchAnalyze: protectedProcedure
    .input(z.object({
      limit: z.number().default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get unanalyzed posts
      const posts = await db
        .select()
        .from(buzzPosts)
        .where(and(
          eq(buzzPosts.userId, ctx.user.id),
          eq(buzzPosts.isAnalyzed, 0)
        ))
        .orderBy(desc(buzzPosts.viralityScore))
        .limit(input.limit);

      let analyzed = 0;
      let errors = 0;

      for (const post of posts) {
        try {
          const hasImage = post.contentFormat === 'with_image';
          const hasVideo = post.contentFormat === 'with_video';
          const isThread = post.contentFormat === 'thread';

          const classification = await classifyPost(
            post.content || '',
            hasImage,
            hasVideo,
            isThread
          );

          const analysis = await analyzeBuzzPost(
            post.content || '',
            hasImage,
            hasVideo,
            isThread,
            {
              likes: post.likesCount || 0,
              comments: post.commentsCount || 0,
              shares: post.sharesCount || 0,
            }
          );

          await db.update(buzzPosts)
            .set({
              industryCategory: classification.industryCategory,
              postType: classification.postType,
              toneStyle: classification.toneStyle,
              contentFormat: classification.contentFormat,
              successFactors: JSON.stringify(analysis.successFactors),
              hookAnalysis: JSON.stringify(analysis.hookAnalysis),
              ctaAnalysis: JSON.stringify(analysis.ctaAnalysis),
              isAnalyzed: 1,
            })
            .where(eq(buzzPosts.id, post.id));

          analyzed++;
        } catch (error) {
          console.error(`[BuzzAnalysis] Error analyzing post ${post.id}:`, error);
          errors++;
        }
      }

      return { success: true, analyzed, errors, total: posts.length };
    }),

  // Extract patterns from analyzed posts
  extractPatterns: protectedProcedure
    .input(z.object({
      industryCategory: z.enum(industryCategories).optional(),
      minViralityScore: z.number().default(50),
      minPosts: z.number().default(5),
    }))
    .mutation(async ({ ctx, input }) => {
      let conditions = [
        eq(buzzPosts.userId, ctx.user.id),
        eq(buzzPosts.isAnalyzed, 1),
        gte(buzzPosts.viralityScore, input.minViralityScore),
      ];

      if (input.industryCategory) {
        conditions.push(eq(buzzPosts.industryCategory, input.industryCategory));
      }

      const posts = await db
        .select()
        .from(buzzPosts)
        .where(and(...conditions))
        .orderBy(desc(buzzPosts.viralityScore))
        .limit(50);

      if (posts.length < input.minPosts) {
        return {
          success: false,
          error: `Not enough analyzed posts (need at least ${input.minPosts}, found ${posts.length})`,
          patterns: [],
        };
      }

      try {
        const patterns = await extractBuzzPatterns(
          posts.map(p => ({
            id: p.id,
            content: p.content || '',
            viralityScore: p.viralityScore || 0,
            industryCategory: p.industryCategory || undefined,
            postType: p.postType || undefined,
          }))
        );

        // Save patterns as buzz learnings
        const savedLearnings: number[] = [];
        for (const pattern of patterns) {
          const [result] = await db.insert(buzzLearnings).values({
            userId: ctx.user.id,
            industryCategory: input.industryCategory || null,
            postType: pattern.learningType === 'hook_pattern' ? 'educational' : null,
            learningType: pattern.learningType,
            title: pattern.title,
            description: pattern.description,
            patternData: JSON.stringify(pattern.patternData),
            examplePostIds: JSON.stringify(pattern.examplePostIds),
            confidence: pattern.confidence,
            sampleSize: pattern.sampleSize,
            isActive: 1,
          });
          savedLearnings.push(result.insertId);
        }

        // Auto-apply learnings to ALL user accounts (simplified flow)
        let appliedCount = 0;
        let applyErrors = 0;
        if (savedLearnings.length > 0) {
          try {
            // Get all accounts for the user
            const userAccounts = await db
              .select()
              .from(accounts)
              .where(eq(accounts.userId, ctx.user.id));

            console.log(`[BuzzAnalysis] Auto-applying ${savedLearnings.length} learnings to ${userAccounts.length} accounts`);

            // Apply each learning to each account and record sync log
            for (const learningId of savedLearnings) {
              for (const account of userAccounts) {
                try {
                  const accountLearningId = await applyBuzzLearningToAccount(learningId, account.id);
                  appliedCount++;

                  // Record in learning sync log for traceability
                  await db.insert(learningSyncLog).values({
                    sourceLearningType: 'buzz_learning',
                    sourceLearningId: learningId,
                    targetAccountId: account.id,
                    accountLearningId: accountLearningId,
                    relevanceScore: 70,
                    autoApplied: 1,
                  });
                } catch (applyError) {
                  console.error(`[BuzzAnalysis] Error applying learning ${learningId} to account ${account.id}:`, applyError);
                  applyErrors++;
                }
              }
            }

            console.log(`[BuzzAnalysis] Applied ${appliedCount} learnings (${applyErrors} errors)`);

            // Also sync to linked projects (for project-specific targeting)
            const linkedProjectResults = await syncLearningsToLinkedProjects(savedLearnings, ctx.user.id);
            console.log("[BuzzAnalysis] Also synced to linked projects:", linkedProjectResults);
          } catch (autoApplyError) {
            console.error("[BuzzAnalysis] Error auto-applying learnings:", autoApplyError);
            // Don't fail the main request if auto-apply fails
          }
        }

        return {
          success: true,
          patterns,
          savedLearningIds: savedLearnings,
          autoApplied: {
            learningsCount: savedLearnings.length,
            appliedCount,
            errors: applyErrors,
          },
        };
      } catch (error: any) {
        console.error("[BuzzAnalysis] Error extracting patterns:", error);
        return { success: false, error: error.message, patterns: [] };
      }
    }),

  // List buzz learnings
  listLearnings: protectedProcedure
    .input(z.object({
      industryCategory: z.enum(industryCategories).optional(),
      learningType: z.enum(learningTypes).optional(),
      isActive: z.boolean().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      let conditions = [eq(buzzLearnings.userId, ctx.user.id)];

      if (input.industryCategory) {
        conditions.push(eq(buzzLearnings.industryCategory, input.industryCategory));
      }
      if (input.learningType) {
        conditions.push(eq(buzzLearnings.learningType, input.learningType));
      }
      if (input.isActive !== undefined) {
        conditions.push(eq(buzzLearnings.isActive, input.isActive ? 1 : 0));
      }

      const learnings = await db
        .select()
        .from(buzzLearnings)
        .where(and(...conditions))
        .orderBy(desc(buzzLearnings.confidence))
        .limit(input.limit);

      return learnings;
    }),

  // Apply learning to agent knowledge
  applyLearningToAgent: protectedProcedure
    .input(z.object({
      learningId: z.number(),
      agentId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const learning = await db.query.buzzLearnings.findFirst({
        where: and(
          eq(buzzLearnings.id, input.learningId),
          eq(buzzLearnings.userId, ctx.user.id)
        ),
      });

      if (!learning) {
        return { success: false, error: "Learning not found" };
      }

      try {
        // Create agent knowledge entry
        const knowledgeKey = `buzz_${learning.learningType}_${learning.industryCategory || 'general'}_${Date.now()}`;
        const knowledgeValue = JSON.stringify({
          title: learning.title,
          description: learning.description,
          patternData: learning.patternData ? JSON.parse(learning.patternData) : {},
          confidence: learning.confidence,
          source: 'buzz_learning',
          learningId: learning.id,
        });

        // Map buzz learning type to agent knowledge type
        type AgentKnowledgeType = 'success_pattern' | 'failure_pattern' | 'content_template' | 'hashtag_strategy' | 'timing_insight' | 'audience_insight' | 'engagement_tactic' | 'general';
        const knowledgeTypeMap: Record<string, AgentKnowledgeType> = {
          'hook_pattern': 'success_pattern',
          'structure_pattern': 'content_template',
          'hashtag_strategy': 'hashtag_strategy',
          'timing_pattern': 'timing_insight',
          'cta_pattern': 'engagement_tactic',
          'media_usage': 'general',
          'tone_pattern': 'general',
          'engagement_tactic': 'engagement_tactic',
        };
        const mappedType: AgentKnowledgeType = knowledgeTypeMap[learning.learningType] || 'general';

        await db.insert(agentKnowledge).values({
          agentId: input.agentId,
          knowledgeType: mappedType,
          title: `[Buzz] ${learning.title}`,
          content: knowledgeValue,
          confidence: learning.confidence || 50,
          usageCount: 0,
          successRate: 0,
          isActive: 1,
        });

        // Update usage count
        await db.update(buzzLearnings)
          .set({
            usageCount: (learning.usageCount || 0) + 1,
            agentId: input.agentId,
          })
          .where(eq(buzzLearnings.id, input.learningId));

        return { success: true, knowledgeKey };
      } catch (error: any) {
        console.error("[BuzzAnalysis] Error applying learning:", error);
        return { success: false, error: error.message };
      }
    }),

  // Toggle learning active status
  toggleLearningActive: protectedProcedure
    .input(z.object({ learningId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const learning = await db.query.buzzLearnings.findFirst({
        where: and(
          eq(buzzLearnings.id, input.learningId),
          eq(buzzLearnings.userId, ctx.user.id)
        ),
      });

      if (!learning) {
        return { success: false, error: "Learning not found" };
      }

      await db.update(buzzLearnings)
        .set({ isActive: learning.isActive === 1 ? 0 : 1 })
        .where(eq(buzzLearnings.id, input.learningId));

      return { success: true, isActive: learning.isActive !== 1 };
    }),

  // Delete learning
  deleteLearning: protectedProcedure
    .input(z.object({ learningId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const learning = await db.query.buzzLearnings.findFirst({
        where: and(
          eq(buzzLearnings.id, input.learningId),
          eq(buzzLearnings.userId, ctx.user.id)
        ),
      });

      if (!learning) {
        return { success: false, error: "Learning not found" };
      }

      await db.delete(buzzLearnings).where(eq(buzzLearnings.id, input.learningId));
      return { success: true };
    }),

  // Dashboard statistics
  getDashboardStats: protectedProcedure
    .query(async ({ ctx }) => {
      const allPosts = await db
        .select()
        .from(buzzPosts)
        .where(eq(buzzPosts.userId, ctx.user.id));

      const learnings = await db
        .select()
        .from(buzzLearnings)
        .where(eq(buzzLearnings.userId, ctx.user.id));

      // Calculate statistics
      const totalPosts = allPosts.length;
      const analyzedPosts = allPosts.filter(p => p.isAnalyzed === 1).length;
      const highViralityPosts = allPosts.filter(p => (p.viralityScore || 0) >= 70).length;

      const avgViralityScore = totalPosts > 0
        ? Math.round(allPosts.reduce((sum, p) => sum + (p.viralityScore || 0), 0) / totalPosts)
        : 0;

      // Posts by source
      const ownAccountPosts = allPosts.filter(p => p.sourceType === 'own_account').length;
      const modelAccountPosts = allPosts.filter(p => p.sourceType === 'model_account').length;

      // Posts by category
      const byCategory: Record<string, number> = {};
      for (const post of allPosts) {
        const cat = post.industryCategory || 'uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }

      // Learnings by type
      const byLearningType: Record<string, number> = {};
      for (const learning of learnings) {
        const type = learning.learningType || 'other';
        byLearningType[type] = (byLearningType[type] || 0) + 1;
      }

      return {
        totalPosts,
        analyzedPosts,
        highViralityPosts,
        avgViralityScore,
        ownAccountPosts,
        modelAccountPosts,
        totalLearnings: learnings.length,
        activeLearnings: learnings.filter(l => l.isActive === 1).length,
        byCategory,
        byLearningType,
      };
    }),

  // ============================================
  // OCR & Image Analysis
  // ============================================

  // Extract text from image using OCR
  extractTextFromImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await extractTextFromImage(input.imageUrl);
    }),

  // Extract post data from screenshot
  analyzeScreenshot: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
      platform: z.enum(['twitter', 'instagram', 'facebook', 'tiktok']).default('twitter'),
    }))
    .mutation(async ({ ctx, input }) => {
      const postData = await extractPostFromScreenshot(input.imageUrl, input.platform);

      if (!postData) {
        return { success: false, error: "Failed to extract post data from screenshot" };
      }

      // Optionally save as buzz post
      if (postData.content) {
        await db.insert(buzzPosts).values({
          userId: ctx.user.id,
          platform: input.platform,
          content: postData.content,
          postUrl: input.imageUrl,
          likesCount: postData.engagementMetrics?.likes || 0,
          commentsCount: postData.engagementMetrics?.comments || 0,
          sharesCount: postData.engagementMetrics?.shares || 0,
          viewsCount: postData.engagementMetrics?.views || 0,
          sourceType: 'model_account',
          isAnalyzed: 0,
        });
      }

      return { success: true, postData };
    }),

  // Analyze image for viral potential
  analyzeViralPotential: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await analyzeImageViralPotential(input.imageUrl);
    }),

  // ============================================
  // Auto Detection Scheduler
  // ============================================

  // Get detection scheduler status
  getDetectionStatus: protectedProcedure
    .query(async () => {
      return getSchedulerStatus();
    }),

  // Start auto detection scheduler
  startAutoDetection: protectedProcedure
    .mutation(async () => {
      startBuzzDetectionScheduler();
      return {
        success: true,
        message: "Buzz detection scheduler started",
        status: getSchedulerStatus(),
      };
    }),

  // Stop auto detection scheduler
  stopAutoDetection: protectedProcedure
    .mutation(async () => {
      stopBuzzDetectionScheduler();
      return {
        success: true,
        message: "Buzz detection scheduler stopped",
        status: getSchedulerStatus(),
      };
    }),

  // Run detection cycle manually
  runDetectionCycle: protectedProcedure
    .mutation(async () => {
      const result = await runDetectionCycle();
      return {
        success: true,
        ...result,
      };
    }),

  // Detect buzz for specific account
  detectBuzzForAccount: protectedProcedure
    .input(z.object({
      accountId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const detected = await detectBuzzForAccount(input.accountId);
      return {
        success: true,
        detected: detected.length,
        posts: detected,
      };
    }),
});
