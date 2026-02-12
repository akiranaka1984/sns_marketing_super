/**
 * Auto-Engagement tRPC Routers
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { engagementTasks, engagementLogs } from "../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export const engagementRouter = router({
  /**
   * Get all engagement tasks
   */
  getTasks: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
        accountId: z.number().optional(),
        taskType: z.enum(["like", "follow", "comment", "unfollow"]).optional(),
        isActive: z.boolean().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(engagementTasks.projectId, input.projectId));
      }
      if (input.accountId) {
        conditions.push(eq(engagementTasks.accountId, input.accountId));
      }
      if (input.taskType) {
        conditions.push(eq(engagementTasks.taskType, input.taskType));
      }
      if (input.isActive !== undefined) {
        conditions.push(eq(engagementTasks.isActive, input.isActive ? 1 : 0));
      }

      const tasks = await db.query.engagementTasks.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(engagementTasks.createdAt)],
        limit: input.limit,
      });

      return tasks;
    }),

  /**
   * Get engagement task by ID
   */
  getTaskById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const task = await db.query.engagementTasks.findFirst({
        where: eq(engagementTasks.id, input.id),
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Engagement task not found",
        });
      }

      return task;
    }),

  /**
   * Create engagement task
   */
  createTask: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        accountId: z.number(),
        taskType: z.enum(["like", "follow", "comment", "unfollow"]),
        targetUser: z.string().optional(),
        targetPost: z.string().optional(),
        commentText: z.string().optional(),
        frequency: z.number().default(10),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const [task] = await db.insert(engagementTasks).values({
        projectId: input.projectId,
        accountId: input.accountId,
        taskType: input.taskType,
        targetUser: input.targetUser,
        targetPost: input.targetPost,
        commentText: input.commentText,
        frequency: input.frequency,
        isActive: input.isActive ? 1 : 0,
      });

      return task;
    }),

  /**
   * Update engagement task
   */
  updateTask: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        targetUser: z.string().optional(),
        targetPost: z.string().optional(),
        commentText: z.string().optional(),
        frequency: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, isActive, ...updates } = input;

      await db
        .update(engagementTasks)
        .set({
          ...updates,
          ...(isActive !== undefined ? { isActive: isActive ? 1 : 0 } : {}),
        })
        .where(eq(engagementTasks.id, id));

      return { success: true };
    }),

  /**
   * Delete engagement task
   */
  deleteTask: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(engagementTasks).where(eq(engagementTasks.id, input.id));

      return { success: true };
    }),

  /**
   * Toggle task active status
   */
  toggleTask: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await db
        .update(engagementTasks)
        .set({ isActive: input.isActive ? 1 : 0 })
        .where(eq(engagementTasks.id, input.id));

      return { success: true };
    }),

  /**
   * Get engagement logs
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        taskId: z.number().optional(),
        accountId: z.number().optional(),
        status: z.enum(["success", "failed"]).optional(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.taskId) {
        conditions.push(eq(engagementLogs.taskId, input.taskId));
      }
      if (input.accountId) {
        conditions.push(eq(engagementLogs.accountId, input.accountId));
      }
      if (input.status) {
        conditions.push(eq(engagementLogs.status, input.status));
      }

      const logs = await db.query.engagementLogs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(engagementLogs.createdAt)],
        limit: input.limit,
      });

      return logs;
    }),

  /**
   * Get engagement statistics
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

      const conditions = [gte(engagementLogs.createdAt, toMySQLTimestamp(startDate))];
      if (input.accountId) {
        conditions.push(eq(engagementLogs.accountId, input.accountId));
      }

      const logs = await db.query.engagementLogs.findMany({
        where: and(...conditions),
      });

      const total = logs.length;
      const byType = {
        like: logs.filter((l) => l.taskType === "like").length,
        follow: logs.filter((l) => l.taskType === "follow").length,
        comment: logs.filter((l) => l.taskType === "comment").length,
        unfollow: logs.filter((l) => l.taskType === "unfollow").length,
      };
      const byStatus = {
        success: logs.filter((l) => l.status === "success").length,
        failed: logs.filter((l) => l.status === "failed").length,
      };

      const successRate =
        total > 0 ? Math.round((byStatus.success / total) * 100) : 0;

      return {
        total,
        byType,
        byStatus,
        successRate,
      };
    }),
});
