/**
 * X Web版投稿の座標自動調整ルーター
 */

import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import { autoTuneCoordinates, applyCoordinateAdjustments } from './x-web-coordinate-tuner';

export const xWebCoordinateRouter = router({
  /**
   * 座標自動調整（ステップテスト実行 + 学習データ記録 + 最適座標計算）
   */
  autoTune: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      resolution: z.string(),
      testContent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await autoTuneCoordinates(
        input.deviceId,
        input.resolution,
        input.testContent
      );
    }),

  /**
   * 座標調整を適用（設定ファイルに保存）
   */
  applyAdjustments: protectedProcedure
    .input(z.object({
      resolution: z.string(),
      coordinates: z.object({
        composeButton: z.object({
          x: z.number(),
          y: z.number(),
        }).optional(),
        textArea: z.object({
          x: z.number(),
          y: z.number(),
        }).optional(),
        postButton: z.object({
          x: z.number(),
          y: z.number(),
        }).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return await applyCoordinateAdjustments(
        input.resolution,
        input.coordinates
      );
    }),
});
