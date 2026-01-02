import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as proxyDb from "./proxy.db";
import * as db from "./db";
import { setProxy } from "./duoplus";
import { addProxyToDuoPlus, setDeviceProxy, findProxyIdByHostPort, batchGetDeviceProxyStatus } from "./duoplus-proxy";

export const proxyRouter = router({
  /**
   * Get all proxies for the current user
   */
  list: protectedProcedure.query(async () => {
    return await proxyDb.getAllProxies();
  }),

  /**
   * Get available proxies
   */
  available: protectedProcedure.query(async () => {
    return await proxyDb.getAvailableProxies();
  }),

  /**
   * Upload proxies from CSV content
   */
  uploadCSV: protectedProcedure
    .input(z.object({
      csvContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const proxyList = proxyDb.parseProxyCSV(input.csvContent);
        
        if (proxyList.length === 0) {
          return {
            success: false,
            message: '有効なプロキシが見つかりませんでした。形式を確認してください（host:port:username:password）',
            count: 0,
          };
        }

        const count = await proxyDb.bulkCreateProxies(proxyList);

        return {
          success: true,
          message: `${count}個のプロキシを追加しました`,
          count,
        };
      } catch (error: any) {
        console.error('[Proxy] Failed to upload CSV:', error);
        return {
          success: false,
          message: `プロキシの追加に失敗しました: ${error.message}`,
          count: 0,
        };
      }
    }),

  /**
   * Assign proxy to account manually
   */
  assign: protectedProcedure
    .input(z.object({
      proxyId: z.number(),
      accountId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        await proxyDb.assignProxyToAccount(input.proxyId, input.accountId);

        return {
          success: true,
          message: 'プロキシを割り当てました',
        };
      } catch (error: any) {
        console.error('[Proxy] Failed to assign proxy:', error);
        return {
          success: false,
          message: `プロキシの割り当てに失敗しました: ${error.message}`,
        };
      }
    }),

  /**
   * Unassign proxy from account
   */
  unassign: protectedProcedure
    .input(z.object({
      accountId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        await proxyDb.unassignProxyFromAccount(input.accountId);

        return {
          success: true,
          message: 'プロキシの割り当てを解除しました',
        };
      } catch (error: any) {
        console.error('[Proxy] Failed to unassign proxy:', error);
        return {
          success: false,
          message: `プロキシの割り当て解除に失敗しました: ${error.message}`,
        };
      }
    }),

  /**
   * Auto-assign proxies to accounts without proxy
   * Also adds proxies to DuoPlus and sets them on devices
   */
  autoAssign: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const accountsWithoutProxy = await proxyDb.getAccountsWithoutProxy(ctx.user.id);
      const availableProxies = await proxyDb.getAvailableProxies();

      if (accountsWithoutProxy.length === 0) {
        return {
          success: true,
          message: 'すべてのアカウントにプロキシが割り当てられています',
          assigned: 0,
        };
      }

      if (availableProxies.length === 0) {
        return {
          success: false,
          message: '利用可能なプロキシがありません',
          assigned: 0,
        };
      }

      let assigned = 0;
      const errors: string[] = [];

      for (let i = 0; i < accountsWithoutProxy.length && i < availableProxies.length; i++) {
        const account = accountsWithoutProxy[i];
        const proxy = availableProxies[i];

        try {
          // 1. Add proxy to DuoPlus (if not already added)
          let duoplusProxyId = proxy.duoplusProxyId;
          if (!duoplusProxyId) {
            try {
              duoplusProxyId = await addProxyToDuoPlus({
                host: proxy.host,
                port: proxy.port,
                username: proxy.username,
                password: proxy.password,
                name: `Proxy-${proxy.id}`,
              });

              // Save DuoPlus proxy ID to local database
              await proxyDb.updateProxyDuoPlusId(proxy.id, duoplusProxyId);
              console.log(`[Proxy] Added proxy ${proxy.id} to DuoPlus with ID: ${duoplusProxyId}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              console.error(`[Proxy] Failed to add proxy ${proxy.id} to DuoPlus:`, errorMessage);
              
              // Try to find existing proxy ID by host and port
              console.log(`[Proxy] Attempting to find existing proxy ID for ${proxy.host}:${proxy.port}`);
              duoplusProxyId = await findProxyIdByHostPort(proxy.host, proxy.port);
              
              if (duoplusProxyId) {
                // Save the found proxy ID to local database
                await proxyDb.updateProxyDuoPlusId(proxy.id, duoplusProxyId);
                console.log(`[Proxy] Found existing DuoPlus proxy ID: ${duoplusProxyId} for proxy ${proxy.id}`);
              } else {
                console.error(`[Proxy] Could not find DuoPlus proxy ID for ${proxy.host}:${proxy.port}`);
                throw new Error(`Failed to add or find proxy in DuoPlus: ${errorMessage}`);
              }
            }
          }

          // 2. Assign proxy to account in local database
          await proxyDb.assignProxyToAccount(proxy.id, account.id);

          // 3. Set proxy for device in DuoPlus (if device ID and DuoPlus proxy ID exist)
          if (account.deviceId && duoplusProxyId) {
            await setDeviceProxy(account.deviceId, duoplusProxyId);
          }

          assigned++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push(`Account ${account.username}: ${errorMessage}`);
          console.error(`[Proxy] Failed to assign proxy to account ${account.id}:`, error);
        }
      }

      return {
        success: true,
        message: `${assigned}個のアカウントにプロキシを割り当てました${errors.length > 0 ? ` (${errors.length}件のエラー)` : ""}`,
        assigned,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('[Proxy] Failed to auto-assign proxies:', error);
      return {
        success: false,
        message: `プロキシの自動割り当てに失敗しました: ${error.message}`,
        assigned: 0,
      };
    }
  }),

  /**
   * Set proxy on DuoPlus device
   */
  setOnDevice: protectedProcedure
    .input(z.object({
      accountId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Get account with proxy info
        const [account] = await proxyDb.getAccountsWithoutProxy(0); // Temporary, need to get account by ID
        
        if (!account || !account.deviceId || !account.proxyId) {
          return {
            success: false,
            message: 'アカウントにデバイスまたはプロキシが設定されていません',
          };
        }

        const proxy = await proxyDb.getProxyById(account.proxyId);
        if (!proxy) {
          return {
            success: false,
            message: 'プロキシ情報が見つかりません',
          };
        }

        // Set proxy on DuoPlus device
        await setProxy(account.deviceId, proxy.host, proxy.port);

        return {
          success: true,
          message: 'デバイスにプロキシを設定しました',
        };
      } catch (error: any) {
        console.error('[Proxy] Failed to set proxy on device:', error);
        return {
          success: false,
          message: `デバイスへのプロキシ設定に失敗しました: ${error.message}`,
        };
      }
    }),

  /**
   * Sync assigned proxies to DuoPlus
   * Only syncs proxies that are not yet configured on DuoPlus devices
   * Retrieves DuoPlus Proxy IDs for assigned proxies and configures devices
   */
  syncToDuoPlus: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Get all assigned proxies
      const allProxies = await proxyDb.getAllProxies();
      const assignedProxies = allProxies.filter(p => p.assignedAccountId !== null);

      if (assignedProxies.length === 0) {
        return {
          success: true,
          message: '割り当て済みのプロキシがありません',
          synced: 0,
        };
      }

      // Get all accounts to check device IDs and current proxy status
      const allAccounts = await db.getAccountsByUserId(ctx.user.id);
      
      // Get current proxy status for all devices
      const deviceIds = allAccounts
        .filter(a => a.deviceId)
        .map(a => a.deviceId as string);
      
      let deviceProxyStatus: Record<string, any> = {};
      if (deviceIds.length > 0) {
        try {
          deviceProxyStatus = await batchGetDeviceProxyStatus(deviceIds);
        } catch (error) {
          console.error('[Proxy Sync] Failed to get device proxy status:', error);
          // Continue without status check if API fails
        }
      }

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const proxy of assignedProxies) {
        try {
          // Find the account for this proxy
          const account = allAccounts.find(a => a.id === proxy.assignedAccountId);
          
          if (!account) {
            console.log(`[Proxy Sync] Account ${proxy.assignedAccountId} not found`);
            continue;
          }
          
          if (!account.deviceId) {
            console.log(`[Proxy Sync] Account ${account.username} has no device ID, skipping`);
            errors.push(`${account.username}: デバイスIDが未設定`);
            continue;
          }

          // Check if device already has a proxy configured
          const currentProxyStatus = deviceProxyStatus[account.deviceId];
          if (currentProxyStatus?.isConfigured) {
            console.log(`[Proxy Sync] Device ${account.deviceId} already has proxy configured, skipping`);
            skipped++;
            continue;
          }

          // Get DuoPlus Proxy ID if not already set
          let duoplusProxyId = proxy.duoplusProxyId;
          
          if (!duoplusProxyId) {
            console.log(`[Proxy Sync] Finding DuoPlus proxy ID for ${proxy.host}:${proxy.port}`);
            duoplusProxyId = await findProxyIdByHostPort(proxy.host, proxy.port);
            
            if (duoplusProxyId) {
              // Save the proxy ID to local database
              await proxyDb.updateProxyDuoPlusId(proxy.id, duoplusProxyId);
              console.log(`[Proxy Sync] Found and saved DuoPlus proxy ID: ${duoplusProxyId} for proxy ${proxy.id}`);
            } else {
              // Try to add proxy to DuoPlus
              console.log(`[Proxy Sync] Proxy not found in DuoPlus, attempting to add...`);
              try {
                duoplusProxyId = await addProxyToDuoPlus({
                  host: proxy.host,
                  port: proxy.port,
                  username: proxy.username,
                  password: proxy.password,
                  name: `Proxy-${proxy.id}`,
                });
                await proxyDb.updateProxyDuoPlusId(proxy.id, duoplusProxyId);
                console.log(`[Proxy Sync] Added proxy to DuoPlus with ID: ${duoplusProxyId}`);
              } catch (addError: any) {
                console.error(`[Proxy Sync] Failed to add proxy ${proxy.id}:`, addError.message);
                errors.push(`${account.username}: ${addError.message}`);
                continue;
              }
            }
          }

          // Set proxy for device in DuoPlus
          if (duoplusProxyId) {
            console.log(`[Proxy Sync] Setting proxy ${duoplusProxyId} for device ${account.deviceId} (${account.username})`);
            await setDeviceProxy(account.deviceId, duoplusProxyId);
            synced++;
          }
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const account = allAccounts.find(a => a.id === proxy.assignedAccountId);
          const accountName = account?.username || `Account ${proxy.assignedAccountId}`;
          errors.push(`${accountName}: ${errorMessage}`);
          console.error(`[Proxy Sync] Failed to sync proxy ${proxy.id}:`, error);
        }
      }

      let message = `${synced}個のプロキシをDuoPlusに設定しました`;
      if (skipped > 0) {
        message += ` (${skipped}個は既に設定済みのためスキップ)`;
      }
      if (errors.length > 0) {
        message += ` (${errors.length}件のエラー)`;
      }

      return {
        success: true,
        message,
        synced,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('[Proxy Sync] Failed to sync proxies:', error);
      return {
        success: false,
        message: `プロキシの同期に失敗しました: ${error.message}`,
        synced: 0,
      };
    }
  }),

  /**
   * Delete proxy
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        await proxyDb.deleteProxy(input.id);

        return {
          success: true,
          message: 'プロキシを削除しました',
        };
      } catch (error: any) {
        console.error('[Proxy] Failed to delete proxy:', error);
        return {
          success: false,
          message: `プロキシの削除に失敗しました: ${error.message}`,
        };
      }
    }),

  /**
   * Set individual proxy to DuoPlus device
   */
  setProxyToDuoPlus: protectedProcedure
    .input(z.object({
      proxyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get proxy details
        const proxies = await proxyDb.getAllProxies();
        const proxy = proxies.find((p: any) => p.id === input.proxyId);
        
        if (!proxy) {
          return {
            success: false,
            message: 'プロキシが見つかりません',
          };
        }

        if (!proxy.assignedAccountId) {
          return {
            success: false,
            message: 'プロキシがアカウントに割り当てられていません',
          };
        }

        // Get account with device ID
        const account = await db.getAccountById(proxy.assignedAccountId);
        if (!account) {
          return {
            success: false,
            message: 'アカウントが見つかりません',
          };
        }

        if (!account.deviceId) {
          return {
            success: false,
            message: 'アカウントにデバイスIDが設定されていません',
          };
        }

        // Get or create DuoPlus Proxy ID
        let duoplusProxyId = proxy.duoplusProxyId;
        
        if (!duoplusProxyId) {
          console.log(`[Proxy Set] Finding DuoPlus proxy ID for ${proxy.host}:${proxy.port}`);
          duoplusProxyId = await findProxyIdByHostPort(proxy.host, proxy.port);
          
          if (!duoplusProxyId) {
            // Try to add proxy to DuoPlus
            console.log(`[Proxy Set] Proxy not found in DuoPlus, attempting to add...`);
            try {
              duoplusProxyId = await addProxyToDuoPlus({
                host: proxy.host,
                port: proxy.port,
                username: proxy.username,
                password: proxy.password,
                name: `Proxy-${proxy.id}`,
              });
              await proxyDb.updateProxyDuoPlusId(proxy.id, duoplusProxyId);
              console.log(`[Proxy Set] Added proxy to DuoPlus with ID: ${duoplusProxyId}`);
            } catch (addError: any) {
              console.error(`[Proxy Set] Failed to add proxy:`, addError.message);
              return {
                success: false,
                message: `プロキシの追加に失敗しました: ${addError.message}`,
              };
            }
          } else {
            // Save the proxy ID to local database
            await proxyDb.updateProxyDuoPlusId(proxy.id, duoplusProxyId);
            console.log(`[Proxy Set] Found and saved DuoPlus proxy ID: ${duoplusProxyId}`);
          }
        }

        // Set proxy to device
        console.log(`[Proxy Set] Setting proxy ${duoplusProxyId} for device ${account.deviceId}`);
        await setDeviceProxy(account.deviceId, duoplusProxyId);

        return {
          success: true,
          message: `プロキシをDuoPlusデバイスに設定しました`,
        };
      } catch (error: any) {
        console.error('[Proxy Set] Failed to set proxy:', error);
        return {
          success: false,
          message: `プロキシの設定に失敗しました: ${error.message}`,
        };
      }
    }),

  /**
   * Get proxy configuration status from DuoPlus
   */
  getProxyStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Get all proxies with assigned accounts
        const proxies = await proxyDb.getAllProxies();
        const assignedProxies = proxies.filter((p: any) => p.assignedAccountId);

        // Get device IDs for assigned accounts
        const deviceIds: string[] = [];
        const proxyToDeviceMap = new Map<number, string>();

        for (const proxy of assignedProxies) {
          if (proxy.assignedAccountId) {
            const account = await db.getAccountById(proxy.assignedAccountId);
            if (account?.deviceId) {
              deviceIds.push(account.deviceId);
              proxyToDeviceMap.set(proxy.id, account.deviceId);
            }
          }
        }

        // Batch get proxy status from DuoPlus
        const statusMap = await batchGetDeviceProxyStatus(deviceIds);

        // Build result map
        const result: Record<number, boolean> = {};
        proxyToDeviceMap.forEach((deviceId, proxyId) => {
          result[proxyId] = statusMap.get(deviceId) || false;
        });

        return result;
      } catch (error: any) {
        console.error('[Proxy Status] Failed to get proxy status:', error);
        return {};
      }
    }),
});
