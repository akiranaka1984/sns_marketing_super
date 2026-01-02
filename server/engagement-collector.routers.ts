/**
 * Engagement Collector Router
 * 
 * エンゲージメント自動取得機能のAPIエンドポイント
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  collectPostEngagement,
  collectAllPendingEngagements,
  generateKnowledgeFromEngagement,
  updateKnowledgeConfidence,
  runScheduledCollection
} from "./engagement-collector";

// スケジューラーの状態
let collectionInterval: NodeJS.Timeout | null = null;
let isCollectorRunning = false;

export const engagementCollectorRouter = router({
  // 単一投稿のエンゲージメントを収集
  collectSingle: protectedProcedure
    .input(z.object({
      postId: z.number()
    }))
    .mutation(async ({ input }) => {
      const result = await collectPostEngagement(input.postId);
      return result;
    }),

  // 公開済み投稿のエンゲージメントを一括収集
  collectAll: protectedProcedure
    .mutation(async () => {
      const result = await collectAllPendingEngagements();
      return result;
    }),

  // 投稿から知見を生成
  generateKnowledge: protectedProcedure
    .input(z.object({
      postId: z.number()
    }))
    .mutation(async ({ input }) => {
      await generateKnowledgeFromEngagement(input.postId);
      return { success: true };
    }),

  // エージェントの知見信頼度を更新
  updateConfidence: protectedProcedure
    .input(z.object({
      agentId: z.number()
    }))
    .mutation(async ({ input }) => {
      await updateKnowledgeConfidence(input.agentId);
      return { success: true };
    }),

  // スケジュール収集を手動実行
  runScheduled: protectedProcedure
    .mutation(async () => {
      await runScheduledCollection();
      return { success: true };
    }),

  // 自動収集スケジューラーを開始
  startCollector: protectedProcedure
    .mutation(async () => {
      if (isCollectorRunning) {
        return { success: false, message: "Collector is already running" };
      }

      // 1時間ごとに実行
      collectionInterval = setInterval(async () => {
        console.log("[EngagementCollector] Running scheduled collection...");
        try {
          await runScheduledCollection();
        } catch (error) {
          console.error("[EngagementCollector] Scheduled collection error:", error);
        }
      }, 60 * 60 * 1000); // 1時間

      isCollectorRunning = true;
      console.log("[EngagementCollector] Collector started");
      return { success: true, message: "Collector started" };
    }),

  // 自動収集スケジューラーを停止
  stopCollector: protectedProcedure
    .mutation(async () => {
      if (!isCollectorRunning || !collectionInterval) {
        return { success: false, message: "Collector is not running" };
      }

      clearInterval(collectionInterval);
      collectionInterval = null;
      isCollectorRunning = false;
      console.log("[EngagementCollector] Collector stopped");
      return { success: true, message: "Collector stopped" };
    }),

  // 収集スケジューラーの状態を取得
  getStatus: protectedProcedure
    .query(async () => {
      return {
        isRunning: isCollectorRunning,
        intervalMs: 60 * 60 * 1000 // 1時間
      };
    })
});
