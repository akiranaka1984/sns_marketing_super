import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { profileAnalyses, modelAccounts, accounts, agentKnowledge, abTests, abTestVariations } from "../drizzle/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";
import { analyzeProfile, generateBioVariations, compareWithModelAccounts, ProfileData, AnalysisLanguage } from "./services/profile-optimizer";
import { getXUserProfile, updateXUserProfile } from "./x-api-service";

const bioStyles = ['professional', 'casual', 'creative', 'minimalist'] as const;
const languages = ['ja', 'en'] as const;

export const profileOptimizationRouter = router({
  // Analyze an account profile
  analyzeProfile: protectedProcedure
    .input(z.object({
      targetType: z.enum(['own_account', 'model_account']),
      accountId: z.number().optional(),
      modelAccountId: z.number().optional(),
      includeModelComparison: z.boolean().default(true),
      language: z.enum(languages).default('ja'),
    }))
    .mutation(async ({ ctx, input }) => {
      let profileData: ProfileData | null = null;
      let modelProfilesData: ProfileData[] = [];

      // Get target profile data
      if (input.targetType === 'own_account' && input.accountId) {
        const account = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.id, input.accountId),
            eq(accounts.userId, ctx.user.id)
          ),
        });

        if (!account) {
          return { success: false, error: "Account not found" };
        }

        // Fetch profile from X API if it's a Twitter account
        if (account.platform === 'twitter' && account.xHandle) {
          const xProfile = await getXUserProfile(account.xHandle);
          if (xProfile) {
            profileData = {
              username: xProfile.username,
              displayName: xProfile.name,
              bio: xProfile.description,
              followersCount: xProfile.public_metrics?.followers_count,
              followingCount: xProfile.public_metrics?.following_count,
              postsCount: xProfile.public_metrics?.tweet_count,
            };
          }
        }

        if (!profileData) {
          profileData = {
            username: account.xHandle || account.username,
            displayName: account.username,
          };
        }
      } else if (input.targetType === 'model_account' && input.modelAccountId) {
        const modelAccount = await db.query.modelAccounts.findFirst({
          where: and(
            eq(modelAccounts.id, input.modelAccountId),
            eq(modelAccounts.userId, ctx.user.id)
          ),
        });

        if (!modelAccount) {
          return { success: false, error: "Model account not found" };
        }

        profileData = {
          username: modelAccount.username,
          displayName: modelAccount.displayName || undefined,
          bio: modelAccount.bio || undefined,
          followersCount: modelAccount.followersCount || undefined,
          industryCategory: modelAccount.industryCategory || undefined,
          postingStyle: modelAccount.postingStyle || undefined,
        };
      }

      if (!profileData) {
        return { success: false, error: "Could not get profile data" };
      }

      // Get model accounts for comparison if requested
      if (input.includeModelComparison) {
        const models = await db
          .select()
          .from(modelAccounts)
          .where(and(
            eq(modelAccounts.userId, ctx.user.id),
            eq(modelAccounts.isActive, 1)
          ))
          .limit(5);

        modelProfilesData = models.map(m => ({
          username: m.username,
          displayName: m.displayName || undefined,
          bio: m.bio || undefined,
          followersCount: m.followersCount || undefined,
          industryCategory: m.industryCategory || undefined,
          postingStyle: m.postingStyle || undefined,
        }));
      }

      try {
        // Run analysis - for model accounts, focus on learning from their success
        const isModelAccount = input.targetType === 'model_account';

        // For own accounts, fetch accumulated learnings to inform suggestions
        let accumulatedLearnings: string[] = [];
        if (!isModelAccount) {
          const learnings = await db
            .select()
            .from(agentKnowledge)
            .where(and(
              eq(agentKnowledge.agentId, 0),
              like(agentKnowledge.title, '[Profile]%'),
              eq(agentKnowledge.isActive, 1)
            ))
            .orderBy(desc(agentKnowledge.createdAt))
            .limit(20);

          accumulatedLearnings = learnings.map(l => {
            try {
              const content = JSON.parse(l.content);
              return `${content.learning} (learned from @${content.sourceUsername})`;
            } catch {
              return l.content;
            }
          });
        }

        const analysis = await analyzeProfile(profileData, modelProfilesData, input.language, isModelAccount, accumulatedLearnings);

        // Save analysis result
        const [result] = await db.insert(profileAnalyses).values({
          userId: ctx.user.id,
          targetType: input.targetType,
          accountId: input.accountId || null,
          modelAccountId: input.modelAccountId || null,
          bio: profileData.bio || null,
          bioAnalysis: JSON.stringify(analysis.bioAnalysis),
          overallScore: analysis.overallScore,
          bioSuggestions: JSON.stringify({
            suggestions: analysis.suggestions,
            competitorInsights: analysis.competitorInsights,
            improvedBioOptions: analysis.improvedBioOptions,
          }),
        });

        return {
          success: true,
          analysisId: result.insertId,
          analysis,
        };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error analyzing profile:", error);
        return { success: false, error: error.message };
      }
    }),

  // Generate bio variations
  generateBio: protectedProcedure
    .input(z.object({
      targetType: z.enum(['own_account', 'model_account']),
      accountId: z.number().optional(),
      modelAccountId: z.number().optional(),
      targetStyle: z.enum(bioStyles),
      keyPoints: z.array(z.string()).default([]),
      language: z.enum(languages).default('ja'),
    }))
    .mutation(async ({ ctx, input }) => {
      let profileData: ProfileData | null = null;

      // Get target profile data (same logic as analyzeProfile)
      if (input.targetType === 'own_account' && input.accountId) {
        const account = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.id, input.accountId),
            eq(accounts.userId, ctx.user.id)
          ),
        });

        if (!account) {
          return { success: false, error: "Account not found", bios: [] };
        }

        profileData = {
          username: account.xHandle || account.username,
          displayName: account.username,
        };

        if (account.platform === 'twitter' && account.xHandle) {
          const xProfile = await getXUserProfile(account.xHandle);
          if (xProfile) {
            profileData.bio = xProfile.description;
          }
        }
      } else if (input.targetType === 'model_account' && input.modelAccountId) {
        const modelAccount = await db.query.modelAccounts.findFirst({
          where: and(
            eq(modelAccounts.id, input.modelAccountId),
            eq(modelAccounts.userId, ctx.user.id)
          ),
        });

        if (!modelAccount) {
          return { success: false, error: "Model account not found", bios: [] };
        }

        profileData = {
          username: modelAccount.username,
          bio: modelAccount.bio || undefined,
          industryCategory: modelAccount.industryCategory || undefined,
        };
      }

      if (!profileData) {
        return { success: false, error: "Could not get profile data", bios: [] };
      }

      try {
        const bios = await generateBioVariations(
          profileData,
          input.targetStyle,
          input.keyPoints,
          input.language
        );

        return { success: true, bios };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error generating bios:", error);
        return { success: false, error: error.message, bios: [] };
      }
    }),

  // Compare with model accounts
  compareWithModels: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      language: z.enum(languages).default('ja'),
    }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.accountId),
          eq(accounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Account not found" };
      }

      let targetProfile: ProfileData = {
        username: account.xHandle || account.username,
        displayName: account.username,
      };

      // Get full profile from X API
      if (account.platform === 'twitter' && account.xHandle) {
        const xProfile = await getXUserProfile(account.xHandle);
        if (xProfile) {
          targetProfile = {
            username: xProfile.username,
            displayName: xProfile.name,
            bio: xProfile.description,
            followersCount: xProfile.public_metrics?.followers_count,
            followingCount: xProfile.public_metrics?.following_count,
            postsCount: xProfile.public_metrics?.tweet_count,
          };
        }
      }

      // Get model accounts
      const models = await db
        .select()
        .from(modelAccounts)
        .where(and(
          eq(modelAccounts.userId, ctx.user.id),
          eq(modelAccounts.isActive, 1)
        ))
        .limit(10);

      if (models.length === 0) {
        return {
          success: false,
          error: "No model accounts found. Add model accounts first."
        };
      }

      const modelProfiles: ProfileData[] = models.map(m => ({
        username: m.username,
        displayName: m.displayName || undefined,
        bio: m.bio || undefined,
        followersCount: m.followersCount || undefined,
        industryCategory: m.industryCategory || undefined,
      }));

      try {
        const comparison = await compareWithModelAccounts(targetProfile, modelProfiles, input.language);
        return { success: true, comparison };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error comparing:", error);
        return { success: false, error: error.message };
      }
    }),

  // List analysis history
  listAnalyses: protectedProcedure
    .input(z.object({
      targetType: z.enum(['own_account', 'model_account']).optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      let conditions = [eq(profileAnalyses.userId, ctx.user.id)];

      if (input.targetType) {
        conditions.push(eq(profileAnalyses.targetType, input.targetType));
      }

      const analyses = await db
        .select()
        .from(profileAnalyses)
        .where(and(...conditions))
        .orderBy(desc(profileAnalyses.createdAt))
        .limit(input.limit);

      return analyses;
    }),

  // Get a single analysis
  getAnalysis: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const analysis = await db.query.profileAnalyses.findFirst({
        where: and(
          eq(profileAnalyses.id, input.id),
          eq(profileAnalyses.userId, ctx.user.id)
        ),
      });
      return analysis;
    }),

  // Delete analysis
  deleteAnalysis: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const analysis = await db.query.profileAnalyses.findFirst({
        where: and(
          eq(profileAnalyses.id, input.id),
          eq(profileAnalyses.userId, ctx.user.id)
        ),
      });

      if (!analysis) {
        return { success: false, error: "Analysis not found" };
      }

      await db.delete(profileAnalyses).where(eq(profileAnalyses.id, input.id));
      return { success: true };
    }),

  // Get accounts for selection
  getAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      const ownAccounts = await db
        .select()
        .from(accounts)
        .where(and(
          eq(accounts.userId, ctx.user.id),
          eq(accounts.platform, 'twitter')
        ));

      const modelAccountsList = await db
        .select()
        .from(modelAccounts)
        .where(eq(modelAccounts.userId, ctx.user.id));

      return {
        ownAccounts: ownAccounts.map(a => ({
          id: a.id,
          username: a.username,
          xHandle: a.xHandle,
          platform: a.platform,
        })),
        modelAccounts: modelAccountsList.map(m => ({
          id: m.id,
          username: m.username,
          displayName: m.displayName,
          followersCount: m.followersCount,
        })),
      };
    }),

  // Get current profile from X API
  getCurrentProfile: protectedProcedure
    .input(z.object({
      accountId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.accountId),
          eq(accounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Account not found" };
      }

      // Fetch profile from X API
      if (account.platform === 'twitter' && account.xHandle) {
        try {
          const xProfile = await getXUserProfile(account.xHandle);
          if (xProfile) {
            return {
              success: true,
              profile: {
                username: xProfile.username,
                displayName: xProfile.name,
                bio: xProfile.description || "",
                followersCount: xProfile.public_metrics?.followers_count || 0,
                followingCount: xProfile.public_metrics?.following_count || 0,
                postsCount: xProfile.public_metrics?.tweet_count || 0,
                profileImageUrl: xProfile.profile_image_url,
              },
            };
          }
        } catch (error: any) {
          console.error("[ProfileOptimization] Error fetching X profile:", error);
          return { success: false, error: `Failed to fetch profile: ${error.message}` };
        }
      }

      // Return basic info if not a Twitter account or no X handle
      return {
        success: true,
        profile: {
          username: account.xHandle || account.username,
          displayName: account.username,
          bio: "",
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
        },
      };
    }),

  // Save learnings from model account analysis as knowledge
  saveLearning: protectedProcedure
    .input(z.object({
      modelAccountId: z.number(),
      modelAccountUsername: z.string(),
      learning: z.string(),
      category: z.enum(['bio', 'branding', 'engagement', 'general']).default('general'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Save to agentKnowledge with a special type for profile learnings
        await db.insert(agentKnowledge).values({
          agentId: 0, // 0 means global knowledge (not agent-specific)
          knowledgeType: 'success_pattern',
          title: `[Profile] @${input.modelAccountUsername}`,
          content: JSON.stringify({
            learning: input.learning,
            category: input.category,
            sourceModelAccountId: input.modelAccountId,
            sourceUsername: input.modelAccountUsername,
            learnedAt: new Date().toISOString(),
          }),
          confidence: 80,
          usageCount: 0,
          successRate: 0,
          isActive: 1,
        });

        return { success: true };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error saving learning:", error);
        return { success: false, error: error.message };
      }
    }),

  // Save multiple learnings at once
  saveLearnings: protectedProcedure
    .input(z.object({
      modelAccountId: z.number(),
      modelAccountUsername: z.string(),
      learnings: z.array(z.string()),
      strengths: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const allLearnings = [
          ...input.learnings.map(l => ({ text: l, type: 'learning' as const })),
          ...(input.strengths || []).map(s => ({ text: s, type: 'strength' as const })),
        ];

        for (const item of allLearnings) {
          await db.insert(agentKnowledge).values({
            agentId: 0, // Global knowledge
            knowledgeType: item.type === 'strength' ? 'success_pattern' : 'general',
            title: `[Profile] @${input.modelAccountUsername}`,
            content: JSON.stringify({
              learning: item.text,
              type: item.type,
              sourceModelAccountId: input.modelAccountId,
              sourceUsername: input.modelAccountUsername,
              learnedAt: new Date().toISOString(),
            }),
            confidence: 80,
            usageCount: 0,
            successRate: 0,
            isActive: 1,
          });
        }

        return { success: true, savedCount: allLearnings.length };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error saving learnings:", error);
        return { success: false, error: error.message };
      }
    }),

  // Get accumulated profile learnings
  getLearnings: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const learnings = await db
        .select()
        .from(agentKnowledge)
        .where(and(
          eq(agentKnowledge.agentId, 0), // Global knowledge
          like(agentKnowledge.title, '[Profile]%'),
          eq(agentKnowledge.isActive, 1)
        ))
        .orderBy(desc(agentKnowledge.createdAt))
        .limit(input.limit);

      return learnings.map(l => {
        try {
          const content = JSON.parse(l.content);
          return {
            id: l.id,
            learning: content.learning,
            type: content.type || 'learning',
            sourceUsername: content.sourceUsername,
            sourceModelAccountId: content.sourceModelAccountId,
            learnedAt: content.learnedAt,
            createdAt: l.createdAt,
          };
        } catch {
          return {
            id: l.id,
            learning: l.content,
            type: 'learning',
            sourceUsername: 'Unknown',
            sourceModelAccountId: null,
            learnedAt: null,
            createdAt: l.createdAt,
          };
        }
      });
    }),

  // Delete a learning
  deleteLearning: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(agentKnowledge)
        .set({ isActive: 0 })
        .where(eq(agentKnowledge.id, input.id));
      return { success: true };
    }),

  // Get learnings formatted for use in analysis
  getFormattedLearnings: protectedProcedure
    .query(async ({ ctx }) => {
      const learnings = await db
        .select()
        .from(agentKnowledge)
        .where(and(
          eq(agentKnowledge.agentId, 0),
          like(agentKnowledge.title, '[Profile]%'),
          eq(agentKnowledge.isActive, 1)
        ))
        .orderBy(desc(agentKnowledge.createdAt))
        .limit(20);

      const formatted: string[] = [];
      for (const l of learnings) {
        try {
          const content = JSON.parse(l.content);
          formatted.push(`• ${content.learning} (from @${content.sourceUsername})`);
        } catch {
          formatted.push(`• ${l.content}`);
        }
      }

      return formatted;
    }),

  // ============================================
  // Profile A/B Testing
  // ============================================

  // Create a Bio A/B test
  createBioAbTest: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      name: z.string(),
      currentBio: z.string(),
      testBios: z.array(z.object({
        name: z.string(),
        content: z.string(),
        style: z.enum(bioStyles),
      })),
      testDurationDays: z.number().default(7),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify account ownership
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.accountId),
          eq(accounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Account not found" };
      }

      try {
        // Create the A/B test
        const [testResult] = await db.insert(abTests).values({
          agentId: 0, // Not agent-specific
          name: `[Profile] ${input.name}`,
          description: `Bio A/B test for @${account.username}`,
          theme: `Profile optimization - ${input.testBios.length + 1} bio variations`,
          variationCount: input.testBios.length + 1,
          testDurationHours: input.testDurationDays * 24,
          status: "draft",
        });

        const testId = testResult.insertId;

        // Create variation for current bio (control)
        await db.insert(abTestVariations).values({
          testId,
          variationName: "Control",
          content: input.currentBio,
          hashtags: "[]",
          tone: "current",
          contentLength: "medium",
          emojiUsage: "none",
          hashtagCount: 0,
          hasMedia: false,
        });

        // Create variations for test bios
        for (let i = 0; i < input.testBios.length; i++) {
          const bio = input.testBios[i];
          await db.insert(abTestVariations).values({
            testId,
            variationName: bio.name || `Variation ${String.fromCharCode(65 + i)}`,
            content: bio.content,
            hashtags: "[]",
            tone: bio.style,
            contentLength: bio.content.length > 150 ? "long" : bio.content.length > 80 ? "medium" : "short",
            emojiUsage: "none",
            hashtagCount: 0,
            hasMedia: false,
          });
        }

        // Store account reference in test metadata
        await db.update(abTests)
          .set({
            description: JSON.stringify({
              type: "profile_ab_test",
              accountId: input.accountId,
              originalBio: input.currentBio,
            }),
          })
          .where(eq(abTests.id, testId));

        return {
          success: true,
          testId,
          message: `Created Bio A/B test with ${input.testBios.length + 1} variations`,
        };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error creating Bio A/B test:", error);
        return { success: false, error: error.message };
      }
    }),

  // Apply a bio variation to the account
  applyBioVariation: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      variationId: z.number(),
      testId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify account ownership
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.accountId),
          eq(accounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        return { success: false, error: "Account not found" };
      }

      // Get the variation
      const variation = await db.query.abTestVariations.findFirst({
        where: eq(abTestVariations.id, input.variationId),
      });

      if (!variation) {
        return { success: false, error: "Variation not found" };
      }

      try {
        // Update the bio on X (Twitter)
        if (account.platform === "twitter" && account.xHandle) {
          const updateResult = await updateXUserProfile(account.id, {
            description: variation.content,
          });

          if (!updateResult.success) {
            return {
              success: false,
              error: `Failed to update profile: ${updateResult.error}`,
            };
          }
        }

        // Update the test to track which variation is currently active
        await db.update(abTests)
          .set({
            status: "running",
            startedAt: new Date(),
          })
          .where(eq(abTests.id, input.testId));

        // Record the application
        console.log(`[ProfileOptimization] Applied bio variation ${input.variationId} to account ${input.accountId}`);

        return {
          success: true,
          appliedBio: variation.content,
          message: "Bio updated successfully. Monitor engagement over the test period.",
        };
      } catch (error: any) {
        console.error("[ProfileOptimization] Error applying bio variation:", error);
        return { success: false, error: error.message };
      }
    }),

  // Get profile A/B test results
  getProfileAbTestResults: protectedProcedure
    .input(z.object({
      testId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const test = await db.query.abTests.findFirst({
        where: eq(abTests.id, input.testId),
      });

      if (!test) {
        return { success: false, error: "Test not found" };
      }

      // Parse test metadata
      let metadata: any = {};
      try {
        metadata = test.description ? JSON.parse(test.description) : {};
      } catch {
        metadata = { description: test.description };
      }

      if (metadata.type !== "profile_ab_test") {
        return { success: false, error: "Not a profile A/B test" };
      }

      // Get variations
      const variations = await db.select()
        .from(abTestVariations)
        .where(eq(abTestVariations.testId, input.testId))
        .orderBy(desc(abTestVariations.performanceScore));

      // Get account metrics if available
      const account = metadata.accountId
        ? await db.query.accounts.findFirst({
            where: eq(accounts.id, metadata.accountId),
          })
        : null;

      return {
        success: true,
        test: {
          id: test.id,
          name: test.name,
          status: test.status,
          startedAt: test.startedAt,
          completedAt: test.completedAt,
          confidenceLevel: test.confidenceLevel,
          winnerId: test.winnerId,
        },
        variations: variations.map(v => ({
          id: v.id,
          name: v.variationName,
          content: v.content,
          style: v.tone,
          performanceScore: v.performanceScore,
          isWinner: v.isWinner,
        })),
        accountMetrics: account ? {
          currentFollowers: 0, // Would need to fetch from X API
          username: account.username,
        } : null,
        originalBio: metadata.originalBio,
      };
    }),

  // List profile A/B tests
  listProfileAbTests: protectedProcedure
    .query(async ({ ctx }) => {
      const tests = await db.select()
        .from(abTests)
        .where(like(abTests.name, "[Profile]%"))
        .orderBy(desc(abTests.createdAt))
        .limit(20);

      return tests.map(t => {
        let metadata: any = {};
        try {
          metadata = t.description ? JSON.parse(t.description) : {};
        } catch {
          metadata = {};
        }

        return {
          id: t.id,
          name: t.name?.replace("[Profile] ", ""),
          status: t.status,
          variationCount: t.variationCount,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          winnerId: t.winnerId,
          accountId: metadata.accountId,
        };
      });
    }),
});
