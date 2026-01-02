/**
 * DuoPlus Device Power Management
 * Functions to start, stop, and restart devices
 * Based on official DuoPlus API documentation:
 * - Power On: POST /api/v1/cloudPhone/powerOn with { image_ids: ["xx"] }
 * - Power Off: POST /api/v1/cloudPhone/powerOff with { image_ids: ["xx"] }
 */

import { fetchWithTimeout } from './fetch-with-timeout';
import { getSetting } from './db';

// Get API settings from database (with environment variable fallback)
async function getApiSettings() {
  const duoplusApiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
  const duoplusApiUrl = process.env.DUOPLUS_API_URL || "https://openapi.duoplus.net";
  
  return {
    duoplusApiKey,
    duoplusApiUrl,
  };
}

/**
 * Start a device
 * @param deviceId Device ID (with or without snap_ prefix)
 * @returns Success status
 */
export async function startDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl;

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  // Remove snap_ prefix if present for the API call
  const cleanDeviceId = deviceId.replace(/^snap_/, '');

  console.log(`[DevicePower] Starting device: ${deviceId} (cleanId: ${cleanDeviceId})`);

  try {
    const response = await fetchWithTimeout(
      `${duoplusApiUrl}/api/v1/cloudPhone/powerOn`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DuoPlus-API-Key": duoplusApiKey,
          "Lang": "en",
        },
        body: JSON.stringify({
          image_ids: [cleanDeviceId],
        }),
      },
      30000
    );

    const data = await response.json();
    console.log(`[DevicePower] Power on response:`, JSON.stringify(data, null, 2));

    // Check response according to official API documentation
    if (data.code === 200 || data.code === 0) {
      // Check if device is in success array
      if (data.data?.success?.includes(cleanDeviceId)) {
        console.log(`[DevicePower] Device started successfully: ${deviceId}`);
        return { success: true, message: "デバイスを起動しました。起動完了まで30秒〜1分かかります。" };
      }
      // Check if device is in fail array
      if (data.data?.fail?.includes(cleanDeviceId)) {
        const failReason = data.data?.fail_reason?.[cleanDeviceId] || data.message || data.msg || "Unknown reason";
        console.error(`[DevicePower] Device in fail list: ${deviceId}, reason: ${failReason}`);
        console.error(`[DevicePower] Full API response:`, JSON.stringify(data, null, 2));
        return { success: false, message: `デバイスの起動に失敗しました: ${failReason}` };
      }
      // Success response without detailed data
      console.log(`[DevicePower] Power on command sent: ${deviceId}`);
      return { success: true, message: "デバイス起動コマンドを送信しました。起動完了まで30秒〜1分かかります。" };
    } else {
      const errorMsg = data.message || data.msg || "Unknown error";
      console.error(`[DevicePower] API error: ${errorMsg}`);
      return { success: false, message: `起動失敗: ${errorMsg}` };
    }
  } catch (error: any) {
    console.error(`[DevicePower] Error starting device: ${deviceId}`, error.message);
    return { success: false, message: `エラー: ${error.message}` };
  }
}

/**
 * Stop a device
 * @param deviceId Device ID (with or without snap_ prefix)
 * @returns Success status
 */
export async function stopDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl;

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  // Remove snap_ prefix if present for the API call
  const cleanDeviceId = deviceId.replace(/^snap_/, '');

  console.log(`[DevicePower] Stopping device: ${deviceId} (cleanId: ${cleanDeviceId})`);

  try {
    const response = await fetchWithTimeout(
      `${duoplusApiUrl}/api/v1/cloudPhone/powerOff`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DuoPlus-API-Key": duoplusApiKey,
          "Lang": "en",
        },
        body: JSON.stringify({
          image_ids: [cleanDeviceId],
        }),
      },
      30000
    );

    const data = await response.json();
    console.log(`[DevicePower] Power off response:`, JSON.stringify(data, null, 2));

    // Check response according to official API documentation
    if (data.code === 200 || data.code === 0) {
      // Check if device is in success array
      if (data.data?.success?.includes(cleanDeviceId)) {
        console.log(`[DevicePower] Device stopped successfully: ${deviceId}`);
        return { success: true, message: "デバイスを停止しました" };
      }
      // Check if device is in fail array
      if (data.data?.fail?.includes(cleanDeviceId)) {
        const failReason = data.data?.fail_reason?.[cleanDeviceId] || data.message || data.msg || "Unknown reason";
        console.error(`[DevicePower] Device in fail list: ${deviceId}, reason: ${failReason}`);
        console.error(`[DevicePower] Full API response:`, JSON.stringify(data, null, 2));
        return { success: false, message: `デバイスの停止に失敗しました: ${failReason}` };
      }
      // Success response without detailed data
      console.log(`[DevicePower] Power off command sent: ${deviceId}`);
      return { success: true, message: "デバイス停止コマンドを送信しました" };
    } else {
      const errorMsg = data.message || data.msg || "Unknown error";
      console.error(`[DevicePower] API error: ${errorMsg}`);
      return { success: false, message: `停止失敗: ${errorMsg}` };
    }
  } catch (error: any) {
    console.error(`[DevicePower] Error stopping device: ${deviceId}`, error.message);
    return { success: false, message: `エラー: ${error.message}` };
  }
}

/**
 * Restart a device
 * @param deviceId Device ID (with or without snap_ prefix)
 * @returns Success status
 */
export async function restartDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl;

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  // Remove snap_ prefix if present for the API call
  const cleanDeviceId = deviceId.replace(/^snap_/, '');

  console.log(`[DevicePower] Restarting device: ${deviceId} (cleanId: ${cleanDeviceId})`);

  try {
    const response = await fetchWithTimeout(
      `${duoplusApiUrl}/api/v1/cloudPhone/reboot`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DuoPlus-API-Key": duoplusApiKey,
          "Lang": "en",
        },
        body: JSON.stringify({
          image_ids: [cleanDeviceId],
        }),
      },
      30000
    );

    const data = await response.json();
    console.log(`[DevicePower] Reboot response:`, JSON.stringify(data, null, 2));

    // Check response according to official API documentation
    if (data.code === 200 || data.code === 0) {
      // Check if device is in success array
      if (data.data?.success?.includes(cleanDeviceId)) {
        console.log(`[DevicePower] Device restarted successfully: ${deviceId}`);
        return { success: true, message: "デバイスを再起動しました。再起動完了まで1〜2分かかります。" };
      }
      // Check if device is in fail array
      if (data.data?.fail?.includes(cleanDeviceId)) {
        const failReason = data.data?.fail_reason?.[cleanDeviceId] || data.message || data.msg || "Unknown reason";
        console.error(`[DevicePower] Device in fail list: ${deviceId}, reason: ${failReason}`);
        console.error(`[DevicePower] Full API response:`, JSON.stringify(data, null, 2));
        return { success: false, message: `デバイスの再起動に失敗しました: ${failReason}` };
      }
      // Success response without detailed data
      console.log(`[DevicePower] Reboot command sent: ${deviceId}`);
      return { success: true, message: "デバイス再起動コマンドを送信しました。再起動完了まで1〜2分かかります。" };
    } else {
      const errorMsg = data.message || data.msg || "Unknown error";
      console.error(`[DevicePower] API error: ${errorMsg}`);
      return { success: false, message: `再起動失敗: ${errorMsg}` };
    }
  } catch (error: any) {
    console.error(`[DevicePower] Error restarting device: ${deviceId}`, error.message);
    return { success: false, message: `エラー: ${error.message}` };
  }
}
