/**
 * A/B Testing Router
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { abTests, abTestVariations, abTestLearnings } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import {
  createAbTest,
  startAbTest,
  analyzeTestResults,
  extractLearnings,
  getTestDetails,
  getAgentTests,
  linkPostToVariation,
  updateVariationEngagement,
  generateContentVariations
} from "./ab-testing";

export const abTestingRouter = router({
  // A/Bテスト一覧を取得
  list: protectedProcedure
    .input(z.object({
      agentId: z.number().optional()
    }).optional())
    .query(async ({ input }) => {
      if (input?.agentId) {
        return await getAgentTests(input.agentId);
      }
      return await db.select()
        .from(abTests)
        .orderBy(desc(abTests.createdAt));
    }),

  // A/Bテスト詳細を取得
  get: protectedProcedure
    .input(z.object({
      testId: z.number()
    }))
    .query(async ({ input }) => {
      return await getTestDetails(input.testId);
    }),

  // 新しいA/Bテストを作成
  create: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      name: z.string(),
      theme: z.string(),
      variationCount: z.number().min(2).max(8).default(2),
      testDurationHours: z.number().min(1).max(168).default(48)
    }))
    .mutation(async ({ input }) => {
      const testId = await createAbTest(
        input.agentId,
        input.name,
        input.theme,
        input.variationCount,
        input.testDurationHours
      );
      return { testId };
    }),

  // A/Bテストを開始
  start: protectedProcedure
    .input(z.object({
      testId: z.number()
    }))
    .mutation(async ({ input }) => {
      await startAbTest(input.testId);
      return { success: true };
    }),

  // バリエーションを投稿に紐付け
  linkPost: protectedProcedure
    .input(z.object({
      variationId: z.number(),
      postId: z.number()
    }))
    .mutation(async ({ input }) => {
      await linkPostToVariation(input.variationId, input.postId);
      return { success: true };
    }),

  // バリエーションのエンゲージメントを更新
  updateEngagement: protectedProcedure
    .input(z.object({
      variationId: z.number(),
      likesCount: z.number().default(0),
      commentsCount: z.number().default(0),
      sharesCount: z.number().default(0),
      viewsCount: z.number().default(0)
    }))
    .mutation(async ({ input }) => {
      await updateVariationEngagement(input.variationId, {
        likesCount: input.likesCount,
        commentsCount: input.commentsCount,
        sharesCount: input.sharesCount,
        viewsCount: input.viewsCount
      });
      return { success: true };
    }),

  // テスト結果を分析
  analyze: protectedProcedure
    .input(z.object({
      testId: z.number()
    }))
    .mutation(async ({ input }) => {
      const result = await analyzeTestResults(input.testId);
      return result;
    }),

  // 学習を抽出
  extractLearnings: protectedProcedure
    .input(z.object({
      testId: z.number()
    }))
    .mutation(async ({ input }) => {
      await extractLearnings(input.testId);
      return { success: true };
    }),

  // テストをキャンセル
  cancel: protectedProcedure
    .input(z.object({
      testId: z.number()
    }))
    .mutation(async ({ input }) => {
      await db.update(abTests)
        .set({ status: "cancelled" })
        .where(eq(abTests.id, input.testId));
      return { success: true };
    }),

  // バリエーションのプレビューを生成
  previewVariations: protectedProcedure
    .input(z.object({
      theme: z.string(),
      count: z.number().min(2).max(8).default(2),
      platform: z.string().default("twitter")
    }))
    .mutation(async ({ input }) => {
      const variations = await generateContentVariations(
        input.theme,
        input.count,
        input.platform
      );
      return { variations };
    }),

  // 学習一覧を取得
  getLearnings: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
      testId: z.number().optional()
    }).optional())
    .query(async ({ input }) => {
      if (input?.testId) {
        return await db.select()
          .from(abTestLearnings)
          .where(eq(abTestLearnings.testId, input.testId));
      }
      if (input?.agentId) {
        return await db.select()
          .from(abTestLearnings)
          .where(eq(abTestLearnings.agentId, input.agentId))
          .orderBy(desc(abTestLearnings.createdAt));
      }
      return await db.select()
        .from(abTestLearnings)
        .orderBy(desc(abTestLearnings.createdAt));
    }),

  // 学習を適用済みにマーク
  applyLearning: protectedProcedure
    .input(z.object({
      learningId: z.number()
    }))
    .mutation(async ({ input }) => {
      await db.update(abTestLearnings)
        .set({
          isApplied: true,
          appliedAt: new Date()
        })
        .where(eq(abTestLearnings.id, input.learningId));
      return { success: true };
    })
});
