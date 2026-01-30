/**
 * Ensure Device Ready
 *
 * Checks device status and automatically starts it if stopped.
 * Deduplicates concurrent startup requests for the same device.
 */

import { startDevice } from './device-power';
import { getDeviceStatus } from './duoplus-proxy';
import { deviceStatusCache } from './device-status-cache';

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const POLL_TIMEOUT_MS = 150_000; // 2.5 minutes
const START_RETRY_MAX = 3;
const START_RETRY_INTERVAL_MS = 10_000; // 10 seconds

// Deduplication map: prevents parallel startup attempts for the same device
const pendingStartups = new Map<string, Promise<{ ready: boolean; message: string }>>();

export async function ensureDeviceReady(deviceId: string): Promise<{
  ready: boolean;
  message: string;
}> {
  // Deduplicate: if another call is already starting this device, share its promise
  const existing = pendingStartups.get(deviceId);
  if (existing) {
    console.log(`[EnsureDeviceReady] デバイス ${deviceId} は既に起動処理中（既存Promiseを共有）`);
    return existing;
  }

  const promise = doEnsureDeviceReady(deviceId).finally(() => {
    pendingStartups.delete(deviceId);
  });

  pendingStartups.set(deviceId, promise);
  return promise;
}

async function doEnsureDeviceReady(deviceId: string): Promise<{
  ready: boolean;
  message: string;
}> {
  try {
    // Clear cache to get fresh status
    deviceStatusCache.delete(deviceId);
    const deviceStatus = await getDeviceStatus(deviceId);
    const status = deviceStatus.status;

    console.log(`[EnsureDeviceReady] デバイス状態確認: ${deviceId} status=${status} (${deviceStatus.statusText})`);

    // Status 1: Already powered on
    if (status === 1) {
      return { ready: true, message: 'デバイスは起動済みです' };
    }

    // Status 3 (expired), 4 (update pending), 12 (setup failed): Unrecoverable
    if (status === 3 || status === 4 || status === 12) {
      return {
        ready: false,
        message: `デバイスは回復不可能な状態です (status=${status}: ${deviceStatus.statusText})`,
      };
    }

    // Status 10 (starting), 11 (configuring): Already starting, just poll
    if (status === 10 || status === 11) {
      console.log(`[EnsureDeviceReady] デバイス ${deviceId} は既に起動中 (status=${status})、ポーリング開始`);
      return await pollUntilReady(deviceId);
    }

    // Status 0 (powered off), 2 (stopped): Need to start
    if (status === 0 || status === 2) {
      console.log(`[EnsureDeviceReady] デバイス起動開始: ${deviceId}`);

      // Retry startDevice up to 3 times
      let startSuccess = false;
      let lastError = '';

      for (let attempt = 1; attempt <= START_RETRY_MAX; attempt++) {
        const startResult = await startDevice(deviceId);
        if (startResult.success) {
          startSuccess = true;
          console.log(`[EnsureDeviceReady] 起動コマンド送信成功 (attempt ${attempt}/${START_RETRY_MAX})`);
          break;
        }

        lastError = startResult.message;
        console.warn(`[EnsureDeviceReady] 起動コマンド失敗 (attempt ${attempt}/${START_RETRY_MAX}): ${startResult.message}`);

        if (attempt < START_RETRY_MAX) {
          await sleep(START_RETRY_INTERVAL_MS);
        }
      }

      if (!startSuccess) {
        return {
          ready: false,
          message: `デバイス起動コマンドが${START_RETRY_MAX}回失敗: ${lastError}`,
        };
      }

      return await pollUntilReady(deviceId);
    }

    // Unknown status: try polling anyway
    console.warn(`[EnsureDeviceReady] 不明なステータス ${status}、ポーリングを試行`);
    return await pollUntilReady(deviceId);
  } catch (error: any) {
    console.error(`[EnsureDeviceReady] エラー: ${deviceId}`, error.message);
    return {
      ready: false,
      message: `デバイス状態確認エラー: ${error.message}`,
    };
  }
}

async function pollUntilReady(deviceId: string): Promise<{
  ready: boolean;
  message: string;
}> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    // Invalidate cache before polling
    deviceStatusCache.delete(deviceId);

    try {
      const deviceStatus = await getDeviceStatus(deviceId);
      console.log(`[EnsureDeviceReady] ポーリング中: ${deviceId} status=${deviceStatus.status} (${deviceStatus.statusText})`);

      if (deviceStatus.status === 1) {
        console.log(`[EnsureDeviceReady] デバイス起動完了: ${deviceId}`);
        return { ready: true, message: 'デバイスが起動しました' };
      }

      // Unrecoverable states
      if (deviceStatus.status === 3 || deviceStatus.status === 4 || deviceStatus.status === 12) {
        return {
          ready: false,
          message: `デバイスが回復不可能な状態に遷移 (status=${deviceStatus.status}: ${deviceStatus.statusText})`,
        };
      }
    } catch (error: any) {
      console.warn(`[EnsureDeviceReady] ポーリングエラー: ${error.message}`);
      // Continue polling on transient errors
    }
  }

  return {
    ready: false,
    message: `デバイス起動タイムアウト (${POLL_TIMEOUT_MS / 1000}秒)`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
