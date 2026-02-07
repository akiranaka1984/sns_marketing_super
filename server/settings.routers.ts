import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";
import { setSetting, getSetting } from "./db";

/**
 * Settings Router
 * Manages API configuration and connection testing
 */

export const settingsRouter = router({
  /**
   * Get saved API keys from database
   */
  getApiKeys: protectedProcedure.query(async () => {
    const openaiApiKey = await getSetting('OPENAI_API_KEY');

    return {
      openaiApiKey: openaiApiKey || '',
    };
  }),

  /**
   * Save API keys
   */
  saveApiKeys: protectedProcedure
    .input(z.object({
      openaiApiKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        if (input.openaiApiKey) {
          await setSetting('OPENAI_API_KEY', input.openaiApiKey, 'OpenAI API key for AI features');
          process.env.OPENAI_API_KEY = input.openaiApiKey;
        }

        return {
          success: true,
          message: 'APIキーをデータベースに保存しました。',
        };
      } catch (error) {
        console.error('[Settings] Error saving API keys:', error);
        throw error;
      }
    }),

  /**
   * Test OpenAI API connection with provided API key
   */
  testOpenAIConnection: protectedProcedure
    .input(z.object({
      apiKey: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const apiKey = input.apiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
          return {
            success: false,
            message: '接続失敗: APIキーが設定されていません',
          };
        }

        const openaiClient = axios.create({
          baseURL: 'https://api.openai.com/v1',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        const response = await openaiClient.post('/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          max_tokens: 10,
        });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
          return {
            success: true,
            message: "接続成功: OpenAI APIが正常に動作しています",
          };
        } else {
          return {
            success: false,
            message: "接続失敗: OpenAI APIからの応答が不正です",
          };
        }
      } catch (error: any) {
        console.error('[Settings] OpenAI connection test failed:', error);

        if (error.response) {
          const status = error.response.status;
          if (status === 401) {
            return {
              success: false,
              message: '接続失敗: APIキーが無効です（認証エラー）',
            };
          } else if (status === 429) {
            return {
              success: false,
              message: '接続失敗: レート制限に達しました（しばらく待ってから再試行してください）',
            };
          } else if (status === 403) {
            return {
              success: false,
              message: '接続失敗: アクセスが拒否されました（権限エラー）',
            };
          } else {
            return {
              success: false,
              message: `接続失敗: サーバーエラー（ステータス: ${status}）`,
            };
          }
        } else if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            message: '接続失敗: タイムアウト（10秒以内に応答がありませんでした）',
          };
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: '接続失敗: サーバーに接続できません',
          };
        } else {
          return {
            success: false,
            message: `接続失敗: ${error.message}`,
          };
        }
      }
    }),

  /**
   * Get current API configuration status
   */
  getApiStatus: protectedProcedure.query(async () => {
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    return {
      openai: {
        configured: openaiConfigured,
      },
    };
  }),
});
