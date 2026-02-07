/**
 * Agent Scheduled Posts Router
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { scheduledPosts, agents, accounts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generateScheduledPosts,
  approveScheduledPost,
  rejectScheduledPost,
  editScheduledPost,
  bulkApproveScheduledPosts,
  bulkRejectScheduledPosts,
  getAgentScheduledPosts,
  getPendingReviewPosts,
} from "./agent-scheduled-posts";

export const agentScheduledPostsRouter = router({
  // エージェントがスケジュール投稿を一括生成
  generate: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      count: z.number().min(1).max(20).default(5),
      accountId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await generateScheduledPosts(
        input.agentId,
        input.count,
        input.accountId
      );
      return result;
    }),

  // エージェントが生成したスケジュール投稿を取得
  getByAgent: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      reviewStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).optional(),
      status: z.enum(["pending", "posted", "failed", "cancelled"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      return await getAgentScheduledPosts(input.agentId, {
        reviewStatus: input.reviewStatus,
        status: input.status,
        limit: input.limit,
      });
    }),

  // レビュー待ちの投稿を取得
  getPendingReview: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const posts = await getPendingReviewPosts(input?.agentId, input?.limit);
      
      // エージェント情報とアカウント情報を付加
      const enrichedPosts = await Promise.all(posts.map(async (post) => {
        const agent = post.agentId 
          ? await db.query.agents.findFirst({ where: eq(agents.id, post.agentId) })
          : null;
        const account = await db.query.accounts.findFirst({ 
          where: eq(accounts.id, post.accountId) 
        });
        return {
          ...post,
          agent,
          account,
        };
      }));

      return enrichedPosts;
    }),

  // 投稿を承認
  approve: protectedProcedure
    .input(z.object({
      postId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await approveScheduledPost(input.postId, input.notes);
      return { success: true };
    }),

  // 投稿を却下
  reject: protectedProcedure
    .input(z.object({
      postId: z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ input }) => {
      await rejectScheduledPost(input.postId, input.reason);
      return { success: true };
    }),

  // 投稿を編集
  edit: protectedProcedure
    .input(z.object({
      postId: z.number(),
      content: z.string(),
      hashtags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      await editScheduledPost(input.postId, input.content, input.hashtags);
      return { success: true };
    }),

  // 一括承認
  bulkApprove: protectedProcedure
    .input(z.object({
      postIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const approved = await bulkApproveScheduledPosts(input.postIds);
      return { approved };
    }),

  // 一括却下
  bulkReject: protectedProcedure
    .input(z.object({
      postIds: z.array(z.number()),
      reason: z.string(),
    }))
    .mutation(async ({ input }) => {
      const rejected = await bulkRejectScheduledPosts(input.postIds, input.reason);
      return { rejected };
    }),

  // 投稿詳細を取得
  getById: protectedProcedure
    .input(z.object({
      postId: z.number(),
    }))
    .query(async ({ input }) => {
      const post = await db.query.scheduledPosts.findFirst({
        where: eq(scheduledPosts.id, input.postId),
      });

      if (!post) {
        return null;
      }

      const agent = post.agentId 
        ? await db.query.agents.findFirst({ where: eq(agents.id, post.agentId) })
        : null;
      const account = await db.query.accounts.findFirst({ 
        where: eq(accounts.id, post.accountId) 
      });

      return {
        ...post,
        agent,
        account,
      };
    }),

  // 全スケジュール投稿を取得（エージェント生成含む）
  getAll: protectedProcedure
    .input(z.object({
      generatedByAgent: z.boolean().optional(),
      reviewStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).optional(),
      status: z.enum(["pending", "posted", "failed", "cancelled"]).optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const conditions = [];
      
      if (input?.generatedByAgent !== undefined) {
        conditions.push(eq(scheduledPosts.generatedByAgent, input.generatedByAgent ? 1 : 0));
      }
      if (input?.reviewStatus) {
        conditions.push(eq(scheduledPosts.reviewStatus, input.reviewStatus));
      }
      if (input?.status) {
        conditions.push(eq(scheduledPosts.status, input.status));
      }

      const posts = await db.query.scheduledPosts.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(scheduledPosts.scheduledTime)],
        limit: input?.limit || 50,
      });

      // エージェント情報とアカウント情報を付加
      const enrichedPosts = await Promise.all(posts.map(async (post) => {
        const agent = post.agentId 
          ? await db.query.agents.findFirst({ where: eq(agents.id, post.agentId) })
          : null;
        const account = await db.query.accounts.findFirst({ 
          where: eq(accounts.id, post.accountId) 
        });
        return {
          ...post,
          agent,
          account,
        };
      }));

      return enrichedPosts;
    }),
});
