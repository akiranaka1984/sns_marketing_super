import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { xApiSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * X API Settings Router
 * Manages X (Twitter) API credentials
 */
export const xApiSettingsRouter = router({
  /**
   * Get X API settings for current user
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id || 1;

    const settings = await db.query.xApiSettings.findFirst({
      where: eq(xApiSettings.userId, userId),
    });

    if (!settings) {
      return {
        configured: false,
        apiKey: "",
        apiSecret: "",
        bearerToken: "",
        lastTestedAt: null,
        testResult: null,
      };
    }

    return {
      configured: !!settings.bearerToken,
      apiKey: settings.apiKey || "",
      apiSecret: settings.apiSecret || "",
      bearerToken: settings.bearerToken || "",
      lastTestedAt: settings.lastTestedAt,
      testResult: settings.testResult,
    };
  }),

  /**
   * Save X API settings
   */
  save: protectedProcedure
    .input(z.object({
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      bearerToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || 1;

      // Check if settings exist
      const existing = await db.query.xApiSettings.findFirst({
        where: eq(xApiSettings.userId, userId),
      });

      if (existing) {
        // Update existing
        await db.update(xApiSettings)
          .set({
            apiKey: input.apiKey || existing.apiKey,
            apiSecret: input.apiSecret || existing.apiSecret,
            bearerToken: input.bearerToken || existing.bearerToken,
            updatedAt: toMySQLTimestamp(new Date()),
          })
          .where(eq(xApiSettings.userId, userId));
      } else {
        // Insert new
        await db.insert(xApiSettings).values({
          userId,
          apiKey: input.apiKey || null,
          apiSecret: input.apiSecret || null,
          bearerToken: input.bearerToken || null,
        });
      }

      return {
        success: true,
        message: "X API設定を保存しました",
      };
    }),

  /**
   * Test X API connection using Bearer Token
   */
  testConnection: protectedProcedure
    .input(z.object({
      bearerToken: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || 1;

      try {
        // Test the Bearer Token by fetching a user
        const response = await fetch(
          "https://api.twitter.com/2/users/by/username/twitter",
          {
            headers: {
              Authorization: `Bearer ${input.bearerToken}`,
            },
          }
        );

        const testResult = response.ok ? "success" : "failed";
        const now = toMySQLTimestamp(new Date());

        // Update test result in database
        const existing = await db.query.xApiSettings.findFirst({
          where: eq(xApiSettings.userId, userId),
        });

        if (existing) {
          await db.update(xApiSettings)
            .set({
              lastTestedAt: now,
              testResult,
            })
            .where(eq(xApiSettings.userId, userId));
        }

        if (response.ok) {
          return {
            success: true,
            message: "接続成功: X APIが正常に動作しています",
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.errors?.[0]?.message || response.statusText;

          if (response.status === 401) {
            return {
              success: false,
              message: "接続失敗: Bearer Tokenが無効です",
            };
          } else if (response.status === 403) {
            return {
              success: false,
              message: "接続失敗: アクセスが拒否されました（API権限を確認してください）",
            };
          } else if (response.status === 429) {
            return {
              success: false,
              message: "接続失敗: レート制限に達しました",
            };
          } else {
            return {
              success: false,
              message: `接続失敗: ${errorMessage}`,
            };
          }
        }
      } catch (error: any) {
        console.error("[X API] Connection test failed:", error);
        return {
          success: false,
          message: `接続失敗: ${error.message}`,
        };
      }
    }),
});
