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
    const duoplusApiKey = await getSetting('DUOPLUS_API_KEY');
    const openaiApiKey = await getSetting('OPENAI_API_KEY');
    
    return {
      duoplusApiKey: duoplusApiKey || '',
      openaiApiKey: openaiApiKey || '',
    };
  }),

  /**
   * Save API keys
   */
  saveApiKeys: protectedProcedure
    .input(z.object({
      duoplusApiKey: z.string().optional(),
      openaiApiKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log('[Settings] saveApiKeys called with:', {
        hasDuoplusKey: !!input.duoplusApiKey,
        hasOpenaiKey: !!input.openaiApiKey,
      });
      
      try {
        // Save API keys to database for persistence
        if (input.duoplusApiKey) {
          console.log('[Settings] Saving DUOPLUS_API_KEY to database...');
          await setSetting('DUOPLUS_API_KEY', input.duoplusApiKey, 'DuoPlus API key for device management');
          process.env.DUOPLUS_API_KEY = input.duoplusApiKey; // Also update runtime env
          console.log('[Settings] DUOPLUS_API_KEY saved successfully');
        }
        if (input.openaiApiKey) {
          console.log('[Settings] Saving OPENAI_API_KEY to database...');
          await setSetting('OPENAI_API_KEY', input.openaiApiKey, 'OpenAI API key for AI features');
          process.env.OPENAI_API_KEY = input.openaiApiKey; // Also update runtime env
          console.log('[Settings] OPENAI_API_KEY saved successfully');
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
   * Test DuoPlus API connection with provided API key
   */
  testDuoPlusConnection: protectedProcedure
    .input(z.object({
      apiKey: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        // Use provided API key or fall back to environment variable
        const apiKey = input.apiKey || process.env.DUOPLUS_API_KEY;
        
        if (!apiKey) {
          return {
            success: false,
            message: '接続失敗: APIキーが設定されていません',
            deviceCount: 0,
          };
        }

        // Test connection by listing devices
        const duoplusClient = axios.create({
          baseURL: 'https://openapi.duoplus.net',
          headers: {
            'DuoPlus-API-Key': apiKey,
            'Content-Type': 'application/json',
            'Lang': 'en',
          },
          timeout: 10000,
        });

        console.log('[Settings] Testing DuoPlus API connection...');
        const response = await duoplusClient.post('/api/v1/cloudPhone/list', {
          page: 1,
          pagesize: 100,
        });

        // Log the full response for debugging
        console.log('[Settings] DuoPlus API Response:', JSON.stringify(response.data, null, 2));

        // Check various possible response structures
        if (response.data) {
          // Case 1: response.data.data.list (expected structure)
          if (response.data.data && response.data.data.list) {
            const deviceCount = response.data.data.list.length;
            return {
              success: true,
              message: `接続成功: ${deviceCount}台のデバイスが見つかりました`,
              deviceCount,
            };
          }
          
          // Case 2: response.data.list (alternative structure)
          if (response.data.list) {
            const deviceCount = response.data.list.length;
            return {
              success: true,
              message: `接続成功: ${deviceCount}台のデバイスが見つかりました`,
              deviceCount,
            };
          }
          
          // Case 3: response.data is an array
          if (Array.isArray(response.data)) {
            const deviceCount = response.data.length;
            return {
              success: true,
              message: `接続成功: ${deviceCount}台のデバイスが見つかりました`,
              deviceCount,
            };
          }
          
          // Case 4: Success response but no device list
          if (response.data.code === 0 || response.data.success === true) {
            return {
              success: true,
              message: '接続成功: APIは正常に動作していますが、デバイスリストの構造を確認してください',
              deviceCount: 0,
            };
          }
          
          // Case 5: API returned an error message
          if (response.data.message || response.data.msg) {
            const errorMsg = response.data.message || response.data.msg;
            return {
              success: false,
              message: `接続失敗: ${errorMsg}`,
              deviceCount: 0,
            };
          }
        }

        // If we reach here, the response structure is unexpected
        return {
          success: false,
          message: `接続失敗: APIからの応答が不正です。レスポンス構造: ${JSON.stringify(Object.keys(response.data || {}))}`,
          deviceCount: 0,
        };
      } catch (error: any) {
        console.error('[Settings] DuoPlus connection test failed:', error);
        
        // Log the full error response for debugging
        if (error.response) {
          console.error('[Settings] Error response:', JSON.stringify(error.response.data, null, 2));
        }
        
        // Provide more specific error messages
        if (error.response) {
          const status = error.response.status;
          if (status === 401) {
            return {
              success: false,
              message: '接続失敗: APIキーが無効です（認証エラー）',
              deviceCount: 0,
            };
          } else if (status === 403) {
            return {
              success: false,
              message: '接続失敗: アクセスが拒否されました（権限エラー）',
              deviceCount: 0,
            };
          } else {
            const errorMsg = error.response.data?.message || error.response.data?.msg || '';
            return {
              success: false,
              message: `接続失敗: サーバーエラー（ステータス: ${status}）${errorMsg ? ` - ${errorMsg}` : ''}`,
              deviceCount: 0,
            };
          }
        } else if (error.code === 'ECONNABORTED') {
          return {
            success: false,
            message: '接続失敗: タイムアウト（10秒以内に応答がありませんでした）',
            deviceCount: 0,
          };
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: '接続失敗: サーバーに接続できません',
            deviceCount: 0,
          };
        } else {
          return {
            success: false,
            message: `接続失敗: ${error.message}`,
            deviceCount: 0,
          };
        }
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
        // Use provided API key or fall back to environment variable
        const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
          return {
            success: false,
            message: '接続失敗: APIキーが設定されていません',
          };
        }

        // Test connection with a simple API call
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
        
        // Provide more specific error messages
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
    const duoplusConfigured = !!process.env.DUOPLUS_API_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    return {
      duoplus: {
        configured: duoplusConfigured,
        apiUrl: 'https://openapi.duoplus.net',
      },
      openai: {
        configured: openaiConfigured,
      },
    };
  }),
});
