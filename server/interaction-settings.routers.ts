import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { db } from "./db";
import { interactionSettings, projects, strategies } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// AI parsing function for engagement strategy
async function parseEngagementStrategyWithAI(strategyText: string): Promise<{
  likeEnabled: boolean;
  likeDelayMin: number;
  likeDelayMax: number;
  commentEnabled: boolean;
  commentDelayMin: number;
  commentDelayMax: number;
  commentPersona: string;
  retweetEnabled: boolean;
  retweetDelayMin: number;
  retweetDelayMax: number;
  followEnabled: boolean;
  followDelayMin: number;
  followDelayMax: number;
  reactionProbability: number;
}> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSNSマーケティング戦略を分析するアシスタントです。
与えられた戦略テキストから、相互連携（他のアカウントからの自動いいね・コメント・リツイート・フォロー）の設定を抽出してください。

以下のJSON形式で回答してください：
{
  "likeEnabled": true/false,
  "likeDelayMin": 数値（分）,
  "likeDelayMax": 数値（分）,
  "commentEnabled": true/false,
  "commentDelayMin": 数値（分）,
  "commentDelayMax": 数値（分）,
  "commentPersona": "コメントのペルソナ/スタイル",
  "retweetEnabled": true/false,
  "retweetDelayMin": 数値（分）,
  "retweetDelayMax": 数値（分）,
  "followEnabled": true/false,
  "followDelayMin": 数値（分）,
  "followDelayMax": 数値（分）,
  "reactionProbability": 数値（0-100のパーセンテージ）
}

戦略テキストに明示的な指示がない場合は、以下のデフォルト値を使用：
- いいね: 有効、5-30分後
- コメント: 有効、10-60分後
- リツイート: 無効
- フォロー: 無効
- 反応確率: 80%

戦略テキストから推測できる情報（例：「積極的にエンゲージ」→反応確率高め、「控えめに」→反応確率低め）を反映してください。`
      },
      {
        role: "user",
        content: `以下の戦略テキストを分析してください：\n\n${strategyText}`
      }
    ],
    responseFormat: { type: "json_object" }
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error("AI response is empty");
  }

  const parsed = JSON.parse(content);

  return {
    likeEnabled: parsed.likeEnabled ?? true,
    likeDelayMin: parsed.likeDelayMin ?? 5,
    likeDelayMax: parsed.likeDelayMax ?? 30,
    commentEnabled: parsed.commentEnabled ?? true,
    commentDelayMin: parsed.commentDelayMin ?? 10,
    commentDelayMax: parsed.commentDelayMax ?? 60,
    commentPersona: parsed.commentPersona || "フレンドリーなユーザー",
    retweetEnabled: parsed.retweetEnabled ?? false,
    retweetDelayMin: parsed.retweetDelayMin ?? 15,
    retweetDelayMax: parsed.retweetDelayMax ?? 90,
    followEnabled: parsed.followEnabled ?? false,
    followDelayMin: parsed.followDelayMin ?? 30,
    followDelayMax: parsed.followDelayMax ?? 180,
    reactionProbability: parsed.reactionProbability ?? 80,
  };
}

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
          retweetEnabled: false,
          retweetDelayMinMin: 15,
          retweetDelayMinMax: 90,
          followEnabled: false,
          followDelayMinMin: 30,
          followDelayMinMax: 180,
          followTargetUsers: null,
          reactionProbability: 100,
          maxReactingAccounts: 0,
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
      retweetEnabled: z.boolean(),
      retweetDelayMinMin: z.number().min(0).max(180),
      retweetDelayMinMax: z.number().min(0).max(180),
      followEnabled: z.boolean(),
      followDelayMinMin: z.number().min(0).max(360),
      followDelayMinMax: z.number().min(0).max(360),
      followTargetUsers: z.string().nullable().optional(),
      reactionProbability: z.number().min(0).max(100).optional(),
      maxReactingAccounts: z.number().min(0).optional(),
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
        where: eq(strategies.projectId, input.projectId),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });

      if (!strategy?.engagementStrategy) {
        return { success: false, error: "プロジェクトに戦略が設定されていません" };
      }

      try {
        let parsedStrategy: {
          likeEnabled: boolean;
          likeDelayMin: number;
          likeDelayMax: number;
          commentEnabled: boolean;
          commentDelayMin: number;
          commentDelayMax: number;
          commentPersona: string;
          retweetEnabled: boolean;
          retweetDelayMin: number;
          retweetDelayMax: number;
          followEnabled: boolean;
          followDelayMin: number;
          followDelayMax: number;
          reactionProbability: number;
        };

        // First try to parse as JSON, if fails use AI to parse natural language
        try {
          const jsonStrategy = JSON.parse(strategy.engagementStrategy);
          // JSON parsed successfully, extract values
          parsedStrategy = {
            likeEnabled: jsonStrategy?.mutualLikes?.enabled ?? true,
            likeDelayMin: jsonStrategy?.mutualLikes?.delayMinutes?.min ?? 5,
            likeDelayMax: jsonStrategy?.mutualLikes?.delayMinutes?.max ?? 30,
            commentEnabled: jsonStrategy?.mutualComments?.enabled ?? true,
            commentDelayMin: jsonStrategy?.mutualComments?.delayMinutes?.min ?? 10,
            commentDelayMax: jsonStrategy?.mutualComments?.delayMinutes?.max ?? 60,
            commentPersona: jsonStrategy?.commentStyle || "フレンドリーなユーザー",
            retweetEnabled: jsonStrategy?.mutualRetweets?.enabled ?? false,
            retweetDelayMin: jsonStrategy?.mutualRetweets?.delayMinutes?.min ?? 15,
            retweetDelayMax: jsonStrategy?.mutualRetweets?.delayMinutes?.max ?? 90,
            followEnabled: jsonStrategy?.mutualFollows?.enabled ?? false,
            followDelayMin: jsonStrategy?.mutualFollows?.delayMinutes?.min ?? 30,
            followDelayMax: jsonStrategy?.mutualFollows?.delayMinutes?.max ?? 180,
            reactionProbability: jsonStrategy?.reactionProbability ?? 80,
          };
          console.log('[InteractionSettings] Parsed as JSON');
        } catch (parseError) {
          // JSON parse failed, use AI to analyze natural language
          console.log('[InteractionSettings] Using AI to parse natural language strategy');
          parsedStrategy = await parseEngagementStrategyWithAI(strategy.engagementStrategy);
          console.log('[InteractionSettings] AI parsed result:', parsedStrategy);
        }

        // Build settings object
        const settings = {
          projectId: input.projectId,
          isEnabled: true,
          likeEnabled: parsedStrategy.likeEnabled,
          likeDelayMinMin: parsedStrategy.likeDelayMin,
          likeDelayMinMax: parsedStrategy.likeDelayMax,
          commentEnabled: parsedStrategy.commentEnabled,
          commentDelayMinMin: parsedStrategy.commentDelayMin,
          commentDelayMinMax: parsedStrategy.commentDelayMax,
          defaultPersona: parsedStrategy.commentPersona,
          retweetEnabled: parsedStrategy.retweetEnabled,
          retweetDelayMinMin: parsedStrategy.retweetDelayMin,
          retweetDelayMinMax: parsedStrategy.retweetDelayMax,
          followEnabled: parsedStrategy.followEnabled,
          followDelayMinMin: parsedStrategy.followDelayMin,
          followDelayMinMax: parsedStrategy.followDelayMax,
          followTargetUsers: null,
          reactionProbability: parsedStrategy.reactionProbability,
          maxReactingAccounts: 0,
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
