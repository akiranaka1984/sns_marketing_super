import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { db } from "./db";
import { interactionSettings, projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const interactionSettingsRouter = router({
  // 設定を取得
  get: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      let settings = await db.query.interactionSettings.findFirst({
        where: eq(interactionSettings.projectId, input.projectId),
      });

      // 存在しない場合はデフォルト値を返す
      if (!settings) {
        return {
          projectId: input.projectId,
          isEnabled: false,
          likeEnabled: true,
          likeDelayMinMin: 5,
          likeDelayMinMax: 30,
          commentEnabled: true,
          commentDelayMinMin: 10,
          commentDelayMinMax: 60,
          defaultPersona: "フレンドリーなユーザー",
        };
      }

      return settings;
    }),

  // 設定を保存
  save: publicProcedure
    .input(z.object({
      projectId: z.number(),
      isEnabled: z.boolean(),
      likeEnabled: z.boolean(),
      likeDelayMinMin: z.number().min(1).max(120),
      likeDelayMinMax: z.number().min(1).max(120),
      commentEnabled: z.boolean(),
      commentDelayMinMin: z.number().min(1).max(120),
      commentDelayMinMax: z.number().min(1).max(120),
      defaultPersona: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.query.interactionSettings.findFirst({
        where: eq(interactionSettings.projectId, input.projectId),
      });

      if (existing) {
        await db.update(interactionSettings)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(interactionSettings.id, existing.id));
      } else {
        await db.insert(interactionSettings).values(input);
      }

      return { success: true };
    }),

  // AI戦略から設定を読み込む
  loadFromStrategy: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      // プロジェクトの戦略を取得
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        return { success: false, error: "プロジェクトが見つかりません" };
      }

      // strategiesテーブルから最新の戦略を取得
      const strategy = await db.query.strategies.findFirst({
        where: eq(projects.id, input.projectId),
        orderBy: (strategies, { desc }) => [desc(strategies.createdAt)],
      });

      if (!strategy?.engagementStrategy) {
        return { success: false, error: "プロジェクトに戦略が設定されていません" };
      }

      try {
        let engagementStrategy: any = null;

        // JSON形式の場合はパース、それ以外はデフォルト値を使用
        if (strategy.engagementStrategy) {
          try {
            engagementStrategy = JSON.parse(strategy.engagementStrategy);
          } catch (parseError) {
            // JSON形式でない場合（自然言語テキストの場合）はデフォルト値を使用
            console.log('[InteractionSettings] engagementStrategy is not JSON, using defaults');
          }
        }

        // 戦略から設定を抽出（JSON形式の場合）または デフォルト値を使用
        const settings = {
          projectId: input.projectId,
          isEnabled: true,
          likeEnabled: engagementStrategy?.mutualLikes?.enabled ?? true,
          likeDelayMinMin: engagementStrategy?.mutualLikes?.delayMinutes?.min ?? 5,
          likeDelayMinMax: engagementStrategy?.mutualLikes?.delayMinutes?.max ?? 30,
          commentEnabled: engagementStrategy?.mutualComments?.enabled ?? true,
          commentDelayMinMin: engagementStrategy?.mutualComments?.delayMinutes?.min ?? 10,
          commentDelayMinMax: engagementStrategy?.mutualComments?.delayMinutes?.max ?? 60,
          defaultPersona: engagementStrategy?.commentStyle || "フレンドリーなユーザー",
        };

        // 保存
        const existing = await db.query.interactionSettings.findFirst({
          where: eq(interactionSettings.projectId, input.projectId),
        });

        if (existing) {
          await db.update(interactionSettings)
            .set({ ...settings, updatedAt: new Date() })
            .where(eq(interactionSettings.id, existing.id));
        } else {
          await db.insert(interactionSettings).values(settings);
        }

        return { success: true, settings };
      } catch (error) {
        return { success: false, error: "戦略の解析に失敗しました: " + String(error) };
      }
    }),
});
