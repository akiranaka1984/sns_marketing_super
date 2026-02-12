import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { suggestKPIs, generateStrategyWithContext } from "./aiEngine";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Projects Router
 * Manages marketing campaign projects
 */

export const projectsRouter = router({
  /**
   * Get all projects for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await db.getAllProjects(ctx.user.id);
    
    // Add account count and post count for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const accounts = await db.getProjectAccounts(project.id);
        const posts = await db.getPostsByProject(project.id);
        
        return {
          ...project,
          accountCount: accounts.length,
          postCount: posts.length,
        };
      })
    );
    
    return projectsWithCounts;
  }),

  /**
   * Get project by ID with related data
   */
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      console.log('[DEBUG] projects.byId called with:', {
        inputId: input.id,
        userId: ctx.user.id,
        userOpenId: ctx.user.openId
      });
      const project = await db.getProjectById(input.id, ctx.user.id);
      if (!project) {
        console.log('[DEBUG] Project not found for:', { inputId: input.id, userId: ctx.user.id });
        return null;
      }

      console.log('[DEBUG] Raw project data from DB:', {
        id: project.id,
        startDate: project.startDate,
        endDate: project.endDate,
        startDateType: typeof project.startDate,
        endDateType: typeof project.endDate,
        startDateConstructor: project.startDate?.constructor?.name,
        endDateConstructor: project.endDate?.constructor?.name
      });

      // Get related data
      const accounts = await db.getProjectAccounts(input.id);
      const strategies = await db.getStrategiesByProject(input.id);
      const posts = await db.getPostsByProject(input.id);

      // Helper function to safely convert to ISO string
      const toISOString = (date: any): string | null => {
        if (!date) return null;
        try {
          // If it's already a Date object or has toISOString method
          if (typeof date.toISOString === 'function') {
            return date.toISOString();
          }
          // If it's a string, parse it first
          if (typeof date === 'string') {
            return new Date(date).toISOString();
          }
          // If it's a number (timestamp), convert it
          if (typeof date === 'number') {
            return new Date(date).toISOString();
          }
          // Fallback: try to create a Date from it
          return new Date(date).toISOString();
        } catch (e) {
          console.error('[ERROR] Failed to convert date:', date, e);
          return null;
        }
      };

      const result = {
        ...project,
        startDate: toISOString(project.startDate),
        endDate: toISOString(project.endDate),
        accounts,
        strategies,
        posts,
      };

      console.log('[DEBUG] Processed dates:', {
        startDate: result.startDate,
        endDate: result.endDate
      });

      return result;
    }),

  /**
   * Create a new project
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      objective: z.string().min(1),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targets: z.record(z.string(), z.union([z.number(), z.string()])).optional(), // Flexible KPI targets
    }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await db.createProject({
        userId: ctx.user.id,
        name: input.name,
        objective: input.objective,
        description: input.description,
        status: 'draft',
        startDate: input.startDate,
        endDate: input.endDate,
        targets: input.targets ? JSON.stringify(input.targets) : undefined,
      });

      return { id: projectId };
    }),

  /**
   * Update project
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      objective: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targets: z.record(z.string(), z.union([z.number(), z.string()])).optional(), // Flexible KPI targets
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, targets, ...data } = input;
      
      const updateData: any = {};
      
      // Copy non-date fields
      if (data.name !== undefined) updateData.name = data.name;
      if (data.objective !== undefined) updateData.objective = data.objective;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      
      // Convert date strings to MySQL timestamp format (YYYY-MM-DD HH:MM:SS)
      if (data.startDate) {
        updateData.startDate = data.startDate + ' 00:00:00';
      }
      if (data.endDate) {
        updateData.endDate = data.endDate + ' 23:59:59';
      }
      
      if (targets) {
        updateData.targets = JSON.stringify(targets);
      }

      await db.updateProject(id, ctx.user.id, updateData);
      return { success: true };
    }),

  /**
   * Update project execution mode
   * Also updates skipReview flag for all agents in this project
   * And auto-approves existing pending posts when switching to fullAuto mode
   */
  updateMode: protectedProcedure
    .input(z.object({
      id: z.number(),
      executionMode: z.enum(['fullAuto', 'confirm', 'manual']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update project execution mode
      await db.updateProject(input.id, ctx.user.id, {
        executionMode: input.executionMode,
      });

      // Update skipReview for all agents in this project
      // fullAuto = skipReview: true, confirm/manual = skipReview: false
      const skipReview = input.executionMode === 'fullAuto' ? 1 : 0;
      await db.updateAgentsSkipReview(input.id, skipReview);

      // When switching to fullAuto mode, auto-approve existing pending posts
      // This ensures posts created before the mode change will be executed
      if (input.executionMode === 'fullAuto') {
        await db.updatePendingPostsReviewStatus(input.id, 'approved');
      }

      return { success: true };
    }),

  /**
   * Suggest KPIs based on objective using AI
   */
  suggestKPIs: protectedProcedure
    .input(z.object({
      objective: z.string().min(1),
      currentMetrics: z.object({
        followers: z.number().optional(),
        engagement: z.number().optional(),
        clicks: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const suggestion = await suggestKPIs(input.objective, input.currentMetrics);
      return suggestion;
    }),

  /**
   * Delete project
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteProject(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Add account to project with persona
   */
  addAccount: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      accountId: z.number(),
      personaRole: z.string().optional(),
      personaTone: z.string().optional(),
      personaCharacteristics: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const projectAccountId = await db.addAccountToProject({
        projectId: input.projectId,
        accountId: input.accountId,
        personaRole: input.personaRole,
        personaTone: input.personaTone,
        personaCharacteristics: input.personaCharacteristics,
        isActive: 1,
      });

      return { id: projectAccountId };
    }),

  /**
   * Remove account from project
   */
  removeAccount: protectedProcedure
    .input(z.object({ projectAccountId: z.number() }))
    .mutation(async ({ input }) => {
      await db.removeAccountFromProject(input.projectAccountId);
      return { success: true };
    }),

  /**
   * Update account persona in project
   */
  updateAccountPersona: protectedProcedure
    .input(z.object({
      projectAccountId: z.number(),
      personaRole: z.string().optional(),
      personaTone: z.string().optional(),
      personaCharacteristics: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { projectAccountId, ...data } = input;
      await db.updateProjectAccountPersona(projectAccountId, data);
      return { success: true };
    }),

  /**
   * Link strategy to project
   */
  linkStrategy: protectedProcedure
    .input(z.object({
      strategyId: z.number(),
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await db.linkStrategyToProject(input.strategyId, input.projectId);
      return { success: true };
    }),

  /**
   * Create post for project
   */
  createPost: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      accountId: z.number(),
      strategyId: z.number().optional(),
      content: z.string().min(1),
      mediaUrls: z.string().optional(),
      hashtags: z.string().optional(),
      scheduledAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const postId = await db.createPost({
        projectId: input.projectId,
        accountId: input.accountId,
        content: input.content,
        mediaUrls: input.mediaUrls,
        hashtags: input.hashtags,
        scheduledTime: input.scheduledAt ? toMySQLTimestamp(new Date(input.scheduledAt)) : toMySQLTimestamp(new Date()),
        status: 'pending',
      });

      return { id: postId };
    }),

  /**
   * Update post
   */
  updatePost: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      mediaUrls: z.string().optional(),
      hashtags: z.string().optional(),
      scheduledAt: z.string().optional(),
      status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      
      const updateData: any = { ...data };
      if (data.scheduledAt) {
        updateData.scheduledAt = new Date(data.scheduledAt);
      }

      await db.updatePost(id, updateData);
      return { success: true };
    }),

  /**
   * Delete post
   */
  deletePost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePost(input.id);
      return { success: true };
    }),

  /**
   * Get posts by project
   */
  posts: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPostsByProject(input.projectId);
    }),

  /**
   * Generate strategy with context from buzz learnings and model account patterns
   * This is the data-driven strategy generation endpoint
   */
  generateStrategyWithContext: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      objective: z.string().optional(),
      minBuzzConfidence: z.number().min(0).max(100).default(50),
      maxBuzzLearnings: z.number().min(1).max(50).default(10),
      maxModelPatterns: z.number().min(1).max(20).default(5),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Get project to retrieve objective and targets
      const project = await db.getProjectById(input.projectId, ctx.user.id);
      if (!project) {
        throw new Error("Project not found");
      }

      // Use provided objective or fall back to project's objective
      const objective = input.objective || project.objective;

      // Parse project targets
      let projectTargets: Record<string, number> | undefined;
      if (project.targets) {
        try {
          const parsed = JSON.parse(project.targets);
          projectTargets = {};
          for (const [key, value] of Object.entries(parsed)) {
            projectTargets[key] = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
          }
        } catch (e) {
          console.error("[generateStrategyWithContext] Failed to parse project targets:", e);
        }
      }

      // 2. Get buzz learnings for this project
      const buzzLearnings = await db.getBuzzLearningsForProject(
        input.projectId,
        ctx.user.id,
        {
          minConfidence: input.minBuzzConfidence,
          limit: input.maxBuzzLearnings,
        }
      );

      // 3. Get model patterns for this project
      const modelPatterns = await db.getModelPatternsForProject(
        input.projectId,
        {
          limit: input.maxModelPatterns,
        }
      );

      // 4. Generate strategy with context
      const strategy = await generateStrategyWithContext(objective, {
        buzzLearnings,
        modelPatterns,
        projectTargets,
      });

      // 5. Save strategy to database
      const strategyId = await db.createStrategy({
        userId: ctx.user.id,
        projectId: input.projectId,
        objective,
        contentType: strategy.contentType,
        hashtags: strategy.hashtags,
        postingSchedule: strategy.postingSchedule,
        engagementStrategy: strategy.engagementStrategy,
        generatedContent: strategy.generatedContent,
        // Store context data for tracking
        projectTargetsSnapshot: projectTargets ? JSON.stringify(projectTargets) : undefined,
        incorporatedBuzzLearnings: buzzLearnings.length > 0
          ? JSON.stringify(buzzLearnings.map(l => l.id))
          : undefined,
        incorporatedModelPatterns: modelPatterns.length > 0
          ? JSON.stringify(modelPatterns.map(p => p.modelAccountId))
          : undefined,
        // Store guidelines as JSON
        contentGuidelines: strategy.contentGuidelines
          ? JSON.stringify(strategy.contentGuidelines)
          : undefined,
        timingGuidelines: strategy.timingGuidelines
          ? JSON.stringify(strategy.timingGuidelines)
          : undefined,
        hashtagGuidelines: strategy.hashtagGuidelines
          ? JSON.stringify(strategy.hashtagGuidelines)
          : undefined,
        toneGuidelines: strategy.toneGuidelines
          ? JSON.stringify(strategy.toneGuidelines)
          : undefined,
        isActive: 1,
        validFrom: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });

      // 6. Return result
      return {
        success: true,
        strategyId,
        strategy: {
          contentType: strategy.contentType,
          hashtags: strategy.hashtags,
          postingSchedule: strategy.postingSchedule,
          engagementStrategy: strategy.engagementStrategy,
          generatedContent: strategy.generatedContent,
          contentGuidelines: strategy.contentGuidelines,
          timingGuidelines: strategy.timingGuidelines,
          hashtagGuidelines: strategy.hashtagGuidelines,
          toneGuidelines: strategy.toneGuidelines,
        },
        dataUsed: {
          buzzLearnings: buzzLearnings.map(l => l.id),
          modelPatterns: modelPatterns.map(p => p.modelAccountId),
        },
      };
    }),
});
