/**
 * DuoPlusプロキシのヘルスチェックと自動再接続機能
 */

import { setDeviceProxy } from './duoplus-proxy';
import axios from 'axios';
import { db } from './db';
import { accounts, proxies, settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Get DuoPlus API key from database
 */
async function getApiKey(): Promise<string | null> {
  try {
    const result = await db.query.settings.findFirst({
      where: eq(settings.key, 'DUOPLUS_API_KEY'),
    });
    return result?.value || null;
  } catch (error) {
    console.error('[ProxyHealth] Failed to get API key from database:', error);
    return null;
  }
}

/**
 * プロキシの接続状況をチェック
 */
export async function checkProxyConnection(deviceId: string): Promise<boolean> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('[ProxyHealth] DUOPLUS_API_KEY not found');
      return false;
    }

    // 簡単な接続テスト: curlコマンドでGoogle APIにアクセス
    const testCommand = 'curl -I --connect-timeout 5 https://www.google.com';
    
    const response = await axios.post(
      'https://openapi.duoplus.net/api/v1/cloudPhone/executeAdb',
      {
        cloudPhoneId: deviceId,
        command: testCommand,
      },
      {
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    // HTTP 200または301/302レスポンスがあれば接続成功
    const output = response.data?.data?.output || response.data?.output || '';
    const isConnected = output && (
      output.includes('HTTP/1.1 200') ||
      output.includes('HTTP/1.1 301') ||
      output.includes('HTTP/1.1 302') ||
      output.includes('HTTP/2 200') ||
      output.includes('HTTP/2 301') ||
      output.includes('HTTP/2 302')
    );

    console.log(`[ProxyHealth] Device ${deviceId} proxy connection: ${isConnected ? 'OK' : 'FAILED'}`);
    return isConnected;
  } catch (error) {
    console.error(`[ProxyHealth] Error checking proxy connection for device ${deviceId}:`, error);
    return false;
  }
}

/**
 * プロキシを再接続
 */
export async function reconnectProxy(deviceId: string, duoplusProxyId: string): Promise<boolean> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('[ProxyHealth] DUOPLUS_API_KEY not found');
      return false;
    }

    console.log(`[ProxyHealth] Reconnecting proxy for device ${deviceId}...`);

    // 1. 現在のプロキシ設定を削除
    console.log(`[ProxyHealth] Step 1: Removing current proxy...`);
    await setDeviceProxy(deviceId, ''); // 空文字列でプロキシを削除

    // 2. 3秒待機（デバイスがプロキシ設定をクリアする時間を確保）
    console.log(`[ProxyHealth] Step 2: Waiting 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. プロキシを再設定
    console.log(`[ProxyHealth] Step 3: Setting proxy ${duoplusProxyId}...`);
    await setDeviceProxy(deviceId, duoplusProxyId);

    // 4. 接続確認
    console.log(`[ProxyHealth] Step 4: Verifying connection...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isConnected = await checkProxyConnection(deviceId);

    if (isConnected) {
      console.log(`[ProxyHealth] ✅ Proxy reconnected successfully for device ${deviceId}`);
    } else {
      console.log(`[ProxyHealth] ⚠️ Proxy reconnected but connection test failed for device ${deviceId}`);
    }

    return isConnected;
  } catch (error) {
    console.error(`[ProxyHealth] Error reconnecting proxy for device ${deviceId}:`, error);
    return false;
  }
}

/**
 * すべてのデバイスのプロキシ接続状況をチェックし、必要に応じて再接続
 */
export async function checkAllProxies(): Promise<{
  total: number;
  healthy: number;
  reconnected: number;
  failed: number;
}> {
  console.log('[ProxyHealth] Starting proxy health check...');

  const stats = {
    total: 0,
    healthy: 0,
    reconnected: 0,
    failed: 0,
  };

  try {
    // プロキシが割り当てられているアカウントを取得
    const accountsWithProxy = await db
      .select({
        accountId: accounts.id,
        deviceId: accounts.deviceId,
        proxyId: accounts.proxyId,
      })
      .from(accounts)
      .where(eq(accounts.status, 'active'));

    stats.total = accountsWithProxy.length;
    console.log(`[ProxyHealth] Found ${stats.total} active accounts with proxies`);

    for (const account of accountsWithProxy) {
      if (!account.deviceId || !account.proxyId) {
        console.log(`[ProxyHealth] Skipping account ${account.accountId}: missing deviceId or proxyId`);
        continue;
      }

      // プロキシ情報を取得
      const [proxy] = await db
        .select()
        .from(proxies)
        .where(eq(proxies.id, account.proxyId))
        .limit(1);

      if (!proxy || !proxy.duoplusProxyId) {
        console.log(`[ProxyHealth] Skipping account ${account.accountId}: proxy not found or not registered in DuoPlus`);
        continue;
      }

      // 接続チェック
      const isConnected = await checkProxyConnection(account.deviceId);

      if (isConnected) {
        stats.healthy++;
      } else {
        // 再接続を試行
        console.log(`[ProxyHealth] Attempting to reconnect proxy for device ${account.deviceId}...`);
        const reconnected = await reconnectProxy(account.deviceId, proxy.duoplusProxyId);

        if (reconnected) {
          stats.reconnected++;
        } else {
          stats.failed++;
        }
      }

      // レート制限を避けるため、各チェックの間に2秒待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('[ProxyHealth] Proxy health check completed:', stats);
  } catch (error) {
    console.error('[ProxyHealth] Error during proxy health check:', error);
  }

  return stats;
}

/**
 * プロキシヘルスチェックを定期的に実行（5分ごと）
 */
export function startProxyHealthMonitor() {
  console.log('[ProxyHealth] Starting proxy health monitor (interval: 5 minutes)');

  // 初回実行（起動後1分後）
  setTimeout(() => {
    checkAllProxies();
  }, 60 * 1000);

  // 5分ごとに実行
  setInterval(() => {
    checkAllProxies();
  }, 5 * 60 * 1000);
}
