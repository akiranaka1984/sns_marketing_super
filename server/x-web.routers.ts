/**
 * X Web版投稿のtRPCルーター
 */

import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import { diagnoseDevice, testPostStep } from './x-web-diagnosis';
import { postToXWebV2 } from './x-web-post-v2';
import { autoFixDevice, diagnoseAndFixBeforePost } from './x-web-auto-fix';

export const xWebRouter = router({
  /**
   * デバイス診断
   */
  diagnose: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await diagnoseDevice(input.deviceId);
    }),

  /**
   * テスト投稿（ステップバイステップで結果返却）
   */
  testPost: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await testPostStep(input.deviceId, input.content);
    }),

  /**
   * 本番投稿
   */
  post: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await postToXWebV2(input.deviceId, input.content);
    }),

  /**
   * 自動修正
   */
  autoFix: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await autoFixDevice(input.deviceId);
    }),

  /**
   * 診断→自動修正→投稿可否判定
   */
  diagnoseAndFix: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await diagnoseAndFixBeforePost(input.deviceId);
    }),

  /**
   * 自動修正付き投稿（診断→修正→投稿を一連で実行）
   */
  postWithAutoFix: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      // 診断と自動修正
      const workflow = await diagnoseAndFixBeforePost(input.deviceId);
      
      if (!workflow.canPost) {
        return {
          success: false,
          error: 'DEVICE_NOT_READY',
          message: workflow.message,
          autoFixResult: workflow.autoFixResult
        };
      }
      
      // 投稿実行
      const postResult = await postToXWebV2(input.deviceId, input.content);
      
      return {
        ...postResult,
        autoFixResult: workflow.autoFixResult
      };
    }),
});
