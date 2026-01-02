import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { xApiSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const xApiSettingsRouter = router({
  // 設定を取得
  get: protectedProcedure.query(async ({ ctx }) => {
    const settings = await db.query.xApiSettings.findFirst({
      where: eq(xApiSettings.userId, ctx.user.id),
    });
    // パスワード系はマスク
    if (settings) {
      return {
        ...settings,
        apiKey: settings.apiKey ? "****" + settings.apiKey.slice(-4) : null,
        apiSecret: settings.apiSecret ? "****" : null,
        bearerToken: settings.bearerToken ? "****" + settings.bearerToken.slice(-4) : null,
        hasApiKey: !!settings.apiKey,
        hasApiSecret: !!settings.apiSecret,
        hasBearerToken: !!settings.bearerToken,
      };
    }
    return null;
  }),

  // 設定を保存
  save: protectedProcedure
    .input(z.object({
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      bearerToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.xApiSettings.findFirst({
        where: eq(xApiSettings.userId, ctx.user.id),
      });

      // 空文字でない場合のみ更新
      const updateData: any = {};
      if (input.apiKey && input.apiKey.length > 10) updateData.apiKey = input.apiKey;
      if (input.apiSecret && input.apiSecret.length > 10) updateData.apiSecret = input.apiSecret;
      if (input.bearerToken && input.bearerToken.length > 10) updateData.bearerToken = input.bearerToken;

      if (existing) {
        await db.update(xApiSettings)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(xApiSettings.id, existing.id));
      } else {
        await db.insert(xApiSettings).values({
          userId: ctx.user.id,
          ...updateData,
        });
      }

      return { success: true };
    }),

  // 接続テスト
  test: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.query.xApiSettings.findFirst({
      where: eq(xApiSettings.userId, ctx.user.id),
    });

    if (!settings?.bearerToken) {
      return { success: false, error: "Bearer Token が設定されていません" };
    }

    try {
      // Bearer Token（App-only auth）で使用可能なSearch APIでテスト
      const testQuery = encodeURIComponent("twitter -is:retweet");
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${testQuery}&max_results=10`,
        {
          headers: {
            Authorization: `Bearer ${settings.bearerToken}`,
          },
        }
      );

      const result = response.ok ? "success" : "failed";

      await db.update(xApiSettings)
        .set({ lastTestedAt: new Date(), testResult: result })
        .where(eq(xApiSettings.id, settings.id));

      if (response.ok) {
        const data = await response.json();
        const tweetCount = data.meta?.result_count || 0;
        return { 
          success: true, 
          message: `接続成功: ${tweetCount}件のツイートを取得しました`,
          user: { username: "(Search API verified)" }
        };
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        return { 
          success: false, 
          error: `API エラー (${response.status}): ${errorData.title || errorData.error || "接続に失敗しました"}` 
        };
      }
    } catch (error) {
      return { success: false, error: `接続エラー: ${String(error)}` };
    }
  }),
});
