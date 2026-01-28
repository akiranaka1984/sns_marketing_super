import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { modelAccounts, buzzPosts, modelAccountBehaviorPatterns } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getXUserId, getLatestTweets, getXUserProfile, getLatestTweetsWithMetrics } from "./x-api-service";
import { classifyAccount } from "./services/category-classifier";
import {
  analyzePostingPatterns,
  getBehaviorSummary,
  compareWithModel,
  getPatternsForStrategy,
} from "./services/behavior-analysis-service";

// Industry categories enum for validation
const industryCategories = [
  'it_tech', 'beauty_fashion', 'food_restaurant', 'finance_investment',
  'health_fitness', 'education', 'entertainment', 'travel', 'business', 'other'
] as const;

const postingStyles = ['informative', 'entertaining', 'educational', 'inspirational', 'promotional'] as const;
const toneStyles = ['casual', 'formal', 'humorous', 'professional'] as const;
const platforms = ['twitter', 'tiktok', 'instagram', 'facebook'] as const;

export const modelAccountsRouter = router({
  // List model accounts
  list: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      industryCategory: z.enum(industryCategories).optional(),
      isActive: z.boolean().optional(),
      platform: z.enum(platforms).optional(),
    }))
    .query(async ({ ctx, input }) => {
      let conditions = [eq(modelAccounts.userId, ctx.user.id)];

      if (input.projectId !== undefined) {
        conditions.push(eq(modelAccounts.projectId, input.projectId));
      }
      if (input.industryCategory !== undefined) {
        conditions.push(eq(modelAccounts.industryCategory, input.industryCategory));
      }
      if (input.isActive !== undefined) {
        conditions.push(eq(modelAccounts.isActive, input.isActive ? 1 : 0));
      }
      if (input.platform !== undefined) {
        conditions.push(eq(modelAccounts.platform, input.platform));
      }

      const accounts = await db
        .select()
        .from(modelAccounts)
        .where(and(...conditions))
        .orderBy(desc(modelAccounts.createdAt));

      return accounts;
    }),

  // Get model account by ID
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.id),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });
      return account;
    }),

  // Add a new model account
  add: protectedProcedure
    .input(z.object({
      platform: z.enum(platforms),
      username: z.string().min(1),
      projectId: z.number().optional(),
      industryCategory: z.enum(industryCategories).optional(),
      postingStyle: z.enum(postingStyles).optional(),
      toneStyle: z.enum(toneStyles).optional(),
      collectionFrequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if account already exists
      const existing = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.userId, ctx.user.id),
          eq(modelAccounts.platform, input.platform),
          eq(modelAccounts.username, input.username)
        ),
      });

      if (existing) {
        return { success: false, error: "This model account already exists", id: existing.id };
      }

      // Build profile URL
      let profileUrl = "";
      if (input.platform === "twitter") {
        profileUrl = `https://x.com/${input.username}`;
      }

      const [result] = await db.insert(modelAccounts).values({
        userId: ctx.user.id,
        projectId: input.projectId || null,
        platform: input.platform,
        username: input.username,
        profileUrl,
        industryCategory: input.industryCategory || null,
        postingStyle: input.postingStyle || null,
        toneStyle: input.toneStyle || null,
        collectionFrequency: input.collectionFrequency,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  // Fetch profile data from X API
  fetchProfile: protectedProcedure
    .input(z.object({ modelAccountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      if (account.platform !== "twitter") {
        return { success: false, error: "Profile fetch is only supported for Twitter/X" };
      }

      try {
        // Get full profile from X API
        const profile = await getXUserProfile(account.username);

        if (!profile) {
          return { success: false, error: "Could not fetch user profile from X API" };
        }

        // Update with full profile data
        await db.update(modelAccounts)
          .set({
            displayName: profile.name,
            bio: profile.description || null,
            followersCount: profile.public_metrics?.followers_count || 0,
            profileUrl: `https://x.com/${account.username}`,
          })
          .where(eq(modelAccounts.id, input.modelAccountId));

        return {
          success: true,
          message: "Profile updated successfully",
          profile: {
            displayName: profile.name,
            bio: profile.description,
            followersCount: profile.public_metrics?.followers_count,
            verified: profile.verified,
          },
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // Collect posts from model account
  collectPosts: protectedProcedure
    .input(z.object({
      modelAccountId: z.number(),
      maxPosts: z.number().default(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found", collected: 0 };
      }

      if (account.platform !== "twitter") {
        return { success: false, error: "Post collection is only supported for Twitter/X", collected: 0 };
      }

      try {
        // Fetch latest tweets with engagement metrics
        const tweets = await getLatestTweetsWithMetrics(account.username, input.maxPosts);

        if (!tweets || tweets.length === 0) {
          return { success: true, collected: 0, message: "No tweets found" };
        }

        let collected = 0;
        for (const tweet of tweets) {
          // Check if post already exists
          const existing = await db.query.buzzPosts.findFirst({
            where: and(
              eq(buzzPosts.externalPostId, tweet.id),
              eq(buzzPosts.platform, "twitter")
            ),
          });

          if (!existing) {
            // Build post URL
            const postUrl = `https://x.com/${account.username}/status/${tweet.id}`;

            // Extract hashtags from content
            const hashtagMatches = tweet.text.match(/#\w+/g) || [];

            // Calculate virality score based on engagement
            const metrics = tweet.public_metrics;
            let viralityScore = 0;
            if (metrics) {
              // Simple virality score calculation
              const totalEngagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) * 2 + (metrics.reply_count || 0);
              viralityScore = Math.min(100, Math.round(Math.log10(totalEngagement + 1) * 25));
            }

            await db.insert(buzzPosts).values({
              userId: ctx.user.id,
              projectId: account.projectId || null,
              sourceType: "model_account",
              modelAccountId: account.id,
              platform: "twitter",
              externalPostId: tweet.id,
              postUrl,
              content: tweet.text,
              hashtags: JSON.stringify(hashtagMatches),
              likesCount: metrics?.like_count || 0,
              commentsCount: metrics?.reply_count || 0,
              sharesCount: metrics?.retweet_count || 0,
              viralityScore,
              industryCategory: account.industryCategory || null,
              isAnalyzed: 0,
              isUsedForLearning: 0,
            });
            collected++;
          }
        }

        // Update model account stats
        await db.update(modelAccounts)
          .set({
            lastCollectedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            totalCollectedPosts: (account.totalCollectedPosts || 0) + collected,
          })
          .where(eq(modelAccounts.id, input.modelAccountId));

        return { success: true, collected, total: tweets.length };
      } catch (error: any) {
        return { success: false, error: error.message, collected: 0 };
      }
    }),

  // Collect from all active model accounts
  collectAllActive: protectedProcedure
    .mutation(async ({ ctx }) => {
      const activeAccounts = await db
        .select()
        .from(modelAccounts)
        .where(and(
          eq(modelAccounts.userId, ctx.user.id),
          eq(modelAccounts.isActive, 1)
        ));

      let totalCollected = 0;
      const results: { username: string; collected: number; error?: string }[] = [];

      for (const account of activeAccounts) {
        if (account.platform !== "twitter") {
          results.push({ username: account.username, collected: 0, error: "Unsupported platform" });
          continue;
        }

        try {
          const tweets = await getLatestTweetsWithMetrics(account.username, 20);

          if (!tweets || tweets.length === 0) {
            results.push({ username: account.username, collected: 0 });
            continue;
          }

          let collected = 0;
          for (const tweet of tweets) {
            const existing = await db.query.buzzPosts.findFirst({
              where: and(
                eq(buzzPosts.externalPostId, tweet.id),
                eq(buzzPosts.platform, "twitter")
              ),
            });

            if (!existing) {
              const postUrl = `https://x.com/${account.username}/status/${tweet.id}`;
              const hashtagMatches = tweet.text.match(/#\w+/g) || [];

              // Calculate virality score
              const metrics = tweet.public_metrics;
              let viralityScore = 0;
              if (metrics) {
                const totalEngagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) * 2 + (metrics.reply_count || 0);
                viralityScore = Math.min(100, Math.round(Math.log10(totalEngagement + 1) * 25));
              }

              await db.insert(buzzPosts).values({
                userId: ctx.user.id,
                projectId: account.projectId || null,
                sourceType: "model_account",
                modelAccountId: account.id,
                platform: "twitter",
                externalPostId: tweet.id,
                postUrl,
                content: tweet.text,
                hashtags: JSON.stringify(hashtagMatches),
                likesCount: metrics?.like_count || 0,
                commentsCount: metrics?.reply_count || 0,
                sharesCount: metrics?.retweet_count || 0,
                viralityScore,
                industryCategory: account.industryCategory || null,
                isAnalyzed: 0,
                isUsedForLearning: 0,
              });
              collected++;
            }
          }

          // Update stats
          await db.update(modelAccounts)
            .set({
              lastCollectedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
              totalCollectedPosts: (account.totalCollectedPosts || 0) + collected,
            })
            .where(eq(modelAccounts.id, account.id));

          totalCollected += collected;
          results.push({ username: account.username, collected });
        } catch (error: any) {
          results.push({ username: account.username, collected: 0, error: error.message });
        }
      }

      return { success: true, totalCollected, results };
    }),

  // Update category classification
  updateCategory: protectedProcedure
    .input(z.object({
      modelAccountId: z.number(),
      industryCategory: z.enum(industryCategories).optional(),
      postingStyle: z.enum(postingStyles).optional(),
      toneStyle: z.enum(toneStyles).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      const updateData: any = {};
      if (input.industryCategory !== undefined) {
        updateData.industryCategory = input.industryCategory;
      }
      if (input.postingStyle !== undefined) {
        updateData.postingStyle = input.postingStyle;
      }
      if (input.toneStyle !== undefined) {
        updateData.toneStyle = input.toneStyle;
      }

      await db.update(modelAccounts)
        .set(updateData)
        .where(eq(modelAccounts.id, input.modelAccountId));

      return { success: true };
    }),

  // Toggle active status
  toggleActive: protectedProcedure
    .input(z.object({ modelAccountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      await db.update(modelAccounts)
        .set({ isActive: account.isActive === 1 ? 0 : 1 })
        .where(eq(modelAccounts.id, input.modelAccountId));

      return { success: true, isActive: account.isActive !== 1 };
    }),

  // Delete model account
  delete: protectedProcedure
    .input(z.object({ modelAccountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      // Delete associated buzz posts
      await db.delete(buzzPosts)
        .where(eq(buzzPosts.modelAccountId, input.modelAccountId));

      // Delete the model account
      await db.delete(modelAccounts)
        .where(eq(modelAccounts.id, input.modelAccountId));

      return { success: true };
    }),

  // Get statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const accounts = await db
        .select()
        .from(modelAccounts)
        .where(eq(modelAccounts.userId, ctx.user.id));

      const posts = await db
        .select()
        .from(buzzPosts)
        .where(and(
          eq(buzzPosts.userId, ctx.user.id),
          eq(buzzPosts.sourceType, "model_account")
        ));

      const byCategory: Record<string, number> = {};
      for (const account of accounts) {
        const cat = account.industryCategory || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }

      return {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.isActive === 1).length,
        totalCollectedPosts: posts.length,
        analyzedPosts: posts.filter(p => p.isAnalyzed === 1).length,
        byCategory,
      };
    }),

  // Auto-classify model account using AI
  autoClassify: protectedProcedure
    .input(z.object({ modelAccountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      // Get recent posts for classification
      const recentPosts = await db
        .select({ content: buzzPosts.content })
        .from(buzzPosts)
        .where(eq(buzzPosts.modelAccountId, input.modelAccountId))
        .orderBy(desc(buzzPosts.createdAt))
        .limit(10);

      const recentPostContents = recentPosts.map(p => p.content || '');

      try {
        const classification = await classifyAccount(
          account.username,
          account.bio || '',
          recentPostContents
        );

        // Map toneStyle to valid modelAccounts enum values
        // modelAccounts only supports: casual, formal, humorous, professional
        type ModelAccountToneStyle = 'casual' | 'formal' | 'humorous' | 'professional';
        const validToneStyles: ModelAccountToneStyle[] = ['casual', 'formal', 'humorous', 'professional'];
        const mappedToneStyle: ModelAccountToneStyle = validToneStyles.includes(classification.toneStyle as ModelAccountToneStyle)
          ? (classification.toneStyle as ModelAccountToneStyle)
          : 'casual'; // Default to casual if inspirational or other

        // Update model account with classification
        await db.update(modelAccounts)
          .set({
            industryCategory: classification.industryCategory,
            postingStyle: classification.postingStyle,
            toneStyle: mappedToneStyle,
          })
          .where(eq(modelAccounts.id, input.modelAccountId));

        return {
          success: true,
          classification: {
            industryCategory: classification.industryCategory,
            postingStyle: classification.postingStyle,
            toneStyle: classification.toneStyle,
            confidence: classification.confidence,
          },
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // ==========================================
  // Behavior Pattern Analysis APIs
  // ==========================================

  // Analyze posting patterns for a model account
  analyzePatterns: protectedProcedure
    .input(z.object({
      modelAccountId: z.number(),
      periodDays: z.number().default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      try {
        const pattern = await analyzePostingPatterns(input.modelAccountId, input.periodDays);
        return {
          success: true,
          pattern: {
            avgPostsPerDay: pattern.avgPostsPerDay,
            avgPostsPerWeek: pattern.avgPostsPerWeek,
            peakPostingHours: pattern.peakPostingHours,
            avgEngagementRate: pattern.avgEngagementRate,
            bestEngagementHours: pattern.bestEngagementHours,
            avgContentLength: pattern.avgContentLength,
            emojiUsageRate: pattern.emojiUsageRate,
            hashtagAvgCount: pattern.hashtagAvgCount,
            mediaUsageRate: pattern.mediaUsageRate,
            sampleSize: pattern.sampleSize,
          },
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // Get saved behavior pattern
  getPatterns: protectedProcedure
    .input(z.object({ modelAccountId: z.number() }))
    .query(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return null;
      }

      const summary = await getBehaviorSummary(input.modelAccountId);
      return summary;
    }),

  // Get all patterns for linked model accounts (for strategy generation)
  getPatternsForStrategy: protectedProcedure
    .input(z.object({ modelAccountIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      if (input.modelAccountIds.length === 0) {
        return [];
      }

      // Verify ownership
      const accounts = await db.query.modelAccounts.findMany({
        where: and(
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      const ownedIds = accounts.map(a => a.id);
      const validIds = input.modelAccountIds.filter(id => ownedIds.includes(id));

      if (validIds.length === 0) {
        return [];
      }

      return getPatternsForStrategy(validIds);
    }),

  // Compare own account with model account
  compareWithAccount: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      modelAccountId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify ownership of model account
      const modelAccount = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!modelAccount) {
        return { success: false, error: "Model account not found" };
      }

      const comparison = await compareWithModel(input.accountId, input.modelAccountId);
      if (!comparison) {
        return { success: false, error: "Could not generate comparison" };
      }

      return { success: true, comparison };
    }),

  // Delete behavior pattern (for re-analysis)
  deletePattern: protectedProcedure
    .input(z.object({ modelAccountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Model account not found" };
      }

      await db.delete(modelAccountBehaviorPatterns)
        .where(eq(modelAccountBehaviorPatterns.modelAccountId, input.modelAccountId));

      return { success: true };
    }),
});
