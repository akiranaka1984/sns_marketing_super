/**
 * プロキシヘルスチェックのtRPCルーター
 */

import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { checkProxyConnection, reconnectProxy, checkAllProxies } from './duoplus-proxy-health';
import { db } from './db';
import { proxies } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export const proxyHealthRouter = router({
  /**
   * 単一デバイスのプロキシ接続状況をチェック
   */
  checkConnection: publicProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const isConnected = await checkProxyConnection(input.deviceId);
      return { isConnected };
    }),

  /**
   * 単一デバイスのプロキシを再接続
   */
  reconnect: publicProcedure
    .input(z.object({
      deviceId: z.string(),
      proxyId: z.number(),
    }))
    .mutation(async ({ input }) => {
      // プロキシ情報を取得
      const [proxy] = await db
        .select()
        .from(proxies)
        .where(eq(proxies.id, input.proxyId))
        .limit(1);

      if (!proxy || !proxy.duoplusProxyId) {
        throw new Error('Proxy not found or not registered in DuoPlus');
      }

      const success = await reconnectProxy(input.deviceId, proxy.duoplusProxyId);
      return { success };
    }),

  /**
   * すべてのデバイスのプロキシ接続状況をチェックし、必要に応じて再接続
   */
  checkAll: publicProcedure
    .mutation(async () => {
      const stats = await checkAllProxies();
      return stats;
    }),
});
