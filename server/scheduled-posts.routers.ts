/**
 * Scheduled Posts tRPC Routers
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { scheduledPosts, agents, accounts } from "../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { publishPost } from "./scheduled-posts";
import { TRPCError } from "@trpc/server";
import { buildAgentContext, generateContent } from "./agent-engine";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export const scheduledPostsRouter = router({
  /**
   * Get all scheduled posts
   */
  getAll: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
        accountId: z.number().optional(),
        status: z.enum(["pending", "posted", "failed", "cancelled"]).optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(scheduledPosts.projectId, input.projectId));
      }
      if (input.accountId) {
        conditions.push(eq(scheduledPosts.accountId, input.accountId));
      }
      if (input.status) {
        conditions.push(eq(scheduledPosts.status, input.status));
      }

      const posts = await db.query.scheduledPosts.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(scheduledPosts.scheduledTime)],
        limit: input.limit,
      });

      return posts;
    }),

  /**
   * Get scheduled post by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const post = await db.query.scheduledPosts.findFirst({
        where: eq(scheduledPosts.id, input.id),
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled post not found",
        });
      }

      return post;
    }),

  /**
   * Create scheduled post
   */
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        accountId: z.number(),
        content: z.string().min(1),
        mediaUrls: z.array(z.string()).optional(),
        hashtags: z.string().optional(),
        scheduledTime: z.date(),
        repeatInterval: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
      })
    )
    .mutation(async ({ input }) => {
      const [post] = await db.insert(scheduledPosts).values({
        projectId: input.projectId,
        accountId: input.accountId,
        content: input.content,
        mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
        hashtags: input.hashtags,
        scheduledTime: toMySQLTimestamp(input.scheduledTime),
        repeatInterval: input.repeatInterval,
        status: "pending",
      });

      return post;
    }),

  /**
   * Update scheduled post
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        content: z.string().min(1).optional(),
        mediaUrls: z.string().optional(),
        hashtags: z.string().optional(),
        scheduledTime: z.date().optional(),
        repeatInterval: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, scheduledTime, ...rest } = input;

      const updates: Record<string, any> = { ...rest };
      if (scheduledTime !== undefined) {
        updates.scheduledTime = toMySQLTimestamp(scheduledTime);
      }

      await db
        .update(scheduledPosts)
        .set(updates)
        .where(eq(scheduledPosts.id, id));

      return { success: true };
    }),

  /**
   * Cancel scheduled post
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(scheduledPosts)
        .set({ status: "cancelled" })
        .where(eq(scheduledPosts.id, input.id));

      return { success: true };
    }),

  /**
   * Delete scheduled post
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(scheduledPosts).where(eq(scheduledPosts.id, input.id));

      return { success: true };
    }),

  /**
   * Manually publish a scheduled post now
   */
  publishNow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const result = await publishPost(input.id);
      return result;
    }),

  /**
   * Generate content using agent
   */
  generateWithAgent: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        accountId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Get agent
      const agent = await db.query.agents.findFirst({
        where: eq(agents.id, input.agentId),
      });

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      // Build context and generate content
      const context = await buildAgentContext(agent.id);
      if (!context) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to build agent context",
        });
      }
      
      // Determine max length based on platform and account plan
      // X (Twitter): free=280, premium=280, premium_plus=25000
      let maxLength: number | undefined;
      let planType: string = 'free';
      if (input.accountId) {
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, input.accountId),
        });
        if (account && account.platform === 'twitter') {
          planType = account.planType || 'free';
          switch (planType) {
            case 'premium_plus':
              maxLength = 25000;
              break;
            case 'premium':
              maxLength = 4000;
              break;
            case 'free':
            default:
              maxLength = 280;
              break;
          }
          console.log(`[ScheduledPosts] Account plan: ${planType}, maxLength: ${maxLength}`);
        }
      }

      const generated = await generateContent(context, maxLength);

      return {
        content: generated.content,
        hashtags: generated.hashtags,
        mediaPrompt: generated.mediaPrompt,
        confidence: generated.confidence,
        agentName: agent.name,
        agentTheme: agent.theme,
      };
    }),

  /**
   * Retry failed scheduled post
   */
  retryFailed: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Get the post
      const post = await db.query.scheduledPosts.findFirst({
        where: eq(scheduledPosts.id, input.id),
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled post not found",
        });
      }

      if (post.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed posts can be retried",
        });
      }

      // Reset status to pending
      await db
        .update(scheduledPosts)
        .set({
          status: "pending",
          errorMessage: null,
        })
        .where(eq(scheduledPosts.id, input.id));

      // Try to publish immediately
      const result = await publishPost(input.id);
      return result;
    }),

  /**
   * Get scheduled posts statistics
   */
  getStats: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
        accountId: z.number().optional(),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const conditions = [gte(scheduledPosts.createdAt, toMySQLTimestamp(startDate))];
      if (input.projectId) {
        conditions.push(eq(scheduledPosts.projectId, input.projectId));
      }
      if (input.accountId) {
        conditions.push(eq(scheduledPosts.accountId, input.accountId));
      }

      const posts = await db.query.scheduledPosts.findMany({
        where: and(...conditions),
      });

      const total = posts.length;
      const byStatus = {
        pending: posts.filter((p) => p.status === "pending").length,
        posted: posts.filter((p) => p.status === "posted").length,
        failed: posts.filter((p) => p.status === "failed").length,
        cancelled: posts.filter((p) => p.status === "cancelled").length,
      };

      const successRate =
        total > 0
          ? Math.round((byStatus.posted / (byStatus.posted + byStatus.failed)) * 100)
          : 0;

      return {
        total,
        byStatus,
        successRate,
      };
    }),
});
