import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { db } from "./db";
import { interactions, postUrls } from "../drizzle/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import {
  startInteractionScheduler,
  stopInteractionScheduler,
  getSchedulerStatus,
} from "./interaction-scheduler";

export const schedulerRouter = router({
  // スケジューラー状態を取得
  getStatus: publicProcedure.query(async () => {
    return getSchedulerStatus();
  }),

  // スケジューラーを開始
  start: publicProcedure.mutation(async () => {
    startInteractionScheduler();
    return { success: true };
  }),

  // スケジューラーを停止
  stop: publicProcedure.mutation(async () => {
    stopInteractionScheduler();
    return { success: true };
  }),

  // ダッシュボード用統計を取得
  getStats: publicProcedure
    .input(z.object({ projectId: z.number().optional() }))
    .query(async ({ input }) => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 全体統計
      const [pendingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(interactions)
        .where(eq(interactions.status, "pending"));

      const [processingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(interactions)
        .where(eq(interactions.status, "processing"));

      const [completedTodayCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(interactions)
        .where(
          and(
            eq(interactions.status, "completed"),
            gte(interactions.executedAt, oneDayAgo)
          )
        );

      const [failedTodayCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(interactions)
        .where(
          and(
            eq(interactions.status, "failed"),
            gte(interactions.createdAt, oneDayAgo)
          )
        );

      // 次に実行予定のタスク
      const upcomingTasks = await db
        .select({
          interaction: interactions,
          postUrl: postUrls,
        })
        .from(interactions)
        .leftJoin(postUrls, eq(interactions.postUrlId, postUrls.id))
        .where(eq(interactions.status, "pending"))
        .orderBy(interactions.scheduledAt)
        .limit(10);

      // 最近の実行履歴
      const recentHistory = await db
        .select({
          interaction: interactions,
          postUrl: postUrls,
        })
        .from(interactions)
        .leftJoin(postUrls, eq(interactions.postUrlId, postUrls.id))
        .where(
          and(
            sql`${interactions.status} IN ('completed', 'failed')`,
            gte(interactions.executedAt, oneDayAgo)
          )
        )
        .orderBy(desc(interactions.executedAt))
        .limit(20);

      return {
        pending: pendingCount?.count || 0,
        processing: processingCount?.count || 0,
        completedToday: completedTodayCount?.count || 0,
        failedToday: failedTodayCount?.count || 0,
        upcomingTasks: upcomingTasks.map(t => ({
          id: t.interaction.id,
          type: t.interaction.interactionType,
          scheduledAt: t.interaction.scheduledAt,
          postUrl: t.postUrl?.postUrl,
        })),
        recentHistory: recentHistory.map(t => ({
          id: t.interaction.id,
          type: t.interaction.interactionType,
          status: t.interaction.status,
          executedAt: t.interaction.executedAt,
          postUrl: t.postUrl?.postUrl,
          error: t.interaction.errorMessage,
        })),
      };
    }),
});
