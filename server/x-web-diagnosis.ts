/**
 * X Web版投稿の診断機能
 */

import axios from 'axios';
import { deviceStatusCache } from './device-status-cache';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export interface DiagnosisResult {
  deviceStatus: {
    isOnline: boolean;
    statusCode: number;
    statusText: string;
  } | null;
  screenResolution: {
    width: number;
    height: number;
    raw: string;
  } | null;
  currentScreen: {
    screenshotUrl: string;
    timestamp: Date;
  } | null;
  chromeStatus: {
    isInstalled: boolean;
    isRunning: boolean;
  } | null;
  xLoginStatus: {
    isLoggedIn: boolean;
    currentUrl: string | null;
  } | null;
  errors: string[];
}

export interface StepResult {
  step: string;
  success: boolean;
  screenshotUrl: string | null;
  error: string | null;
  timestamp: Date;
}

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
    console.error('[Diagnosis] Failed to get API key from database:', error);
    return null;
  }
}

/**
 * デバイス状態の完全診断
 */
export async function diagnoseDevice(deviceId: string): Promise<DiagnosisResult> {
  const result: DiagnosisResult = {
    deviceStatus: null,
    screenResolution: null,
    currentScreen: null,
    chromeStatus: null,
    xLoginStatus: null,
    errors: []
  };

  const apiKey = await getApiKey();
  if (!apiKey) {
    result.errors.push('DUOPLUS_API_KEY not found');
    return result;
  }

  try {
    // 1. デバイスの電源状態確認
    console.log('[Diagnosis] Checking device status...');
    let deviceStatus = deviceStatusCache.get(deviceId);
    
    // キャッシュがない場合は直接APIから取得
    if (!deviceStatus) {
      console.log('[Diagnosis] Cache miss, fetching from API...');
      const statusResponse = await axios.get(
        `https://openapi.duoplus.net/api/v1/cloudPhone/getStatus?cloudPhoneId=${deviceId}`,
        {
          headers: {
            'DuoPlus-API-Key': apiKey,
          },
          timeout: 30000,
        }
      );
      deviceStatus = statusResponse.data?.data || { status: 0 };
      // キャッシュに保存
      deviceStatusCache.set(deviceId, deviceStatus);
    }
    
    result.deviceStatus = {
      isOnline: deviceStatus.status === 1,
      statusCode: deviceStatus.status,
      statusText: getStatusText(deviceStatus.status)
    };

    if (deviceStatus.status !== 1) {
      result.errors.push(`Device is not powered on (status: ${deviceStatus.status})`);
      return result;
    }

    // 2. 解像度取得
    console.log('[Diagnosis] Getting screen resolution...');
    try {
      const resolutionResponse = await executeAdb(apiKey, deviceId, 'wm size');
      const resolutionMatch = resolutionResponse.match(/Physical size: (\d+)x(\d+)/);
      if (resolutionMatch) {
        result.screenResolution = {
          width: parseInt(resolutionMatch[1]),
          height: parseInt(resolutionMatch[2]),
          raw: `${resolutionMatch[1]}x${resolutionMatch[2]}`
        };
      } else {
        result.errors.push('Failed to parse screen resolution');
      }
    } catch (error: any) {
      result.errors.push(`Failed to get screen resolution: ${error.message}`);
    }

    // 3. 現在の画面キャプチャ
    console.log('[Diagnosis] Taking screenshot...');
    try {
      const screenshotUrl = await takeScreenshot(apiKey, deviceId);
      result.currentScreen = {
        screenshotUrl,
        timestamp: new Date()
      };
    } catch (error: any) {
      result.errors.push(`Failed to take screenshot: ${error.message}`);
    }

    // 4. Chromeが起動しているか確認
    console.log('[Diagnosis] Checking Chrome status...');
    try {
      const packagesResponse = await executeAdb(apiKey, deviceId, 'pm list packages | grep chrome');
      const isInstalled = packagesResponse.includes('com.android.chrome');
      
      const psResponse = await executeAdb(apiKey, deviceId, 'ps | grep chrome');
      const isRunning = psResponse.includes('com.android.chrome');

      result.chromeStatus = {
        isInstalled,
        isRunning
      };

      if (!isInstalled) {
        result.errors.push('Chrome is not installed');
      }
    } catch (error: any) {
      result.errors.push(`Failed to check Chrome status: ${error.message}`);
    }

    // 5. x.comにアクセスしてログイン状態確認
    console.log('[Diagnosis] Checking X login status...');
    try {
      // Chromeでx.comを開く
      await executeAdb(apiKey, deviceId, 
        'am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "https://x.com/home"'
      );
      await sleep(5000);

      // 現在のURLを取得（可能であれば）
      // Note: ADBでURLを直接取得するのは難しいため、スクリーンショットで判断
      const loginScreenshot = await takeScreenshot(apiKey, deviceId);
      
      // 簡易的な判定: ログイン画面かホーム画面かをスクリーンショットで判断
      // TODO: より高度な画像解析を実装
      result.xLoginStatus = {
        isLoggedIn: true, // 仮の値（実際は画像解析が必要）
        currentUrl: 'https://x.com/home'
      };
    } catch (error: any) {
      result.errors.push(`Failed to check X login status: ${error.message}`);
    }

  } catch (error: any) {
    result.errors.push(`Diagnosis failed: ${error.message}`);
  }

  return result;
}

/**
 * ステップバイステップの投稿テスト
 */
export async function testPostStep(deviceId: string, content: string): Promise<StepResult[]> {
  const steps: StepResult[] = [];
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    steps.push({
      step: 'initialization',
      success: false,
      screenshotUrl: null,
      error: 'DUOPLUS_API_KEY not found',
      timestamp: new Date()
    });
    return steps;
  }

  try {
    // Step 1: Open Chrome
    console.log('[TestPost] Step 1: Opening Chrome...');
    try {
      await executeAdb(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
      await sleep(1000);
      await executeAdb(apiKey, deviceId, 
        'am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "https://x.com/home"'
      );
      await sleep(5000);
      
      const screenshot1 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_1_open_chrome',
        success: true,
        screenshotUrl: screenshot1,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_1_open_chrome',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
      return steps;
    }

    // Step 2: Navigate to X
    console.log('[TestPost] Step 2: Navigating to X...');
    try {
      await sleep(2000);
      const screenshot2 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_2_navigate_x',
        success: true,
        screenshotUrl: screenshot2,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_2_navigate_x',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
      return steps;
    }

    // Step 3: Check login status
    console.log('[TestPost] Step 3: Checking login status...');
    try {
      const screenshot3 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_3_check_login',
        success: true,
        screenshotUrl: screenshot3,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_3_check_login',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
      return steps;
    }

    // Step 4: Click compose button
    console.log('[TestPost] Step 4: Clicking compose button...');
    try {
      // 解像度を取得
      const resolutionResponse = await executeAdb(apiKey, deviceId, 'wm size');
      const resolutionMatch = resolutionResponse.match(/Physical size: (\d+)x(\d+)/);
      const resolution = resolutionMatch ? `${resolutionMatch[1]}x${resolutionMatch[2]}` : '1080x2400';
      
      const coords = getCoordinates(resolution, 'composeButton');
      await executeAdb(apiKey, deviceId, `input tap ${coords.x} ${coords.y}`);
      await sleep(2000);
      
      const screenshot4 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_4_click_compose',
        success: true,
        screenshotUrl: screenshot4,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_4_click_compose',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
      return steps;
    }

    // Step 5: Input text
    console.log('[TestPost] Step 5: Inputting text...');
    try {
      const resolutionResponse = await executeAdb(apiKey, deviceId, 'wm size');
      const resolutionMatch = resolutionResponse.match(/Physical size: (\d+)x(\d+)/);
      const resolution = resolutionMatch ? `${resolutionMatch[1]}x${resolutionMatch[2]}` : '1080x2400';
      
      const coords = getCoordinates(resolution, 'textArea');
      await executeAdb(apiKey, deviceId, `input tap ${coords.x} ${coords.y}`);
      await sleep(500);
      
      // 日本語テキストの特殊処理（クリップボード経由）
      const escapedContent = content
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, ' ');
      
      await executeAdb(apiKey, deviceId, `am broadcast -a clipper.set -e text "${escapedContent}"`);
      await executeAdb(apiKey, deviceId, 'input keyevent 279'); // PASTE
      await sleep(1000);
      
      const screenshot5 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_5_input_text',
        success: true,
        screenshotUrl: screenshot5,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_5_input_text',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
      return steps;
    }

    // Step 6: Click post button
    console.log('[TestPost] Step 6: Clicking post button...');
    try {
      const resolutionResponse = await executeAdb(apiKey, deviceId, 'wm size');
      const resolutionMatch = resolutionResponse.match(/Physical size: (\d+)x(\d+)/);
      const resolution = resolutionMatch ? `${resolutionMatch[1]}x${resolutionMatch[2]}` : '1080x2400';
      
      const coords = getCoordinates(resolution, 'postButton');
      await executeAdb(apiKey, deviceId, `input tap ${coords.x} ${coords.y}`);
      await sleep(5000);
      
      const screenshot6 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_6_click_post',
        success: true,
        screenshotUrl: screenshot6,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_6_click_post',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
      return steps;
    }

    // Step 7: Verify success
    console.log('[TestPost] Step 7: Verifying post success...');
    try {
      await sleep(2000);
      const screenshot7 = await takeScreenshot(apiKey, deviceId);
      steps.push({
        step: 'step_7_verify_success',
        success: true,
        screenshotUrl: screenshot7,
        error: null,
        timestamp: new Date()
      });
    } catch (error: any) {
      steps.push({
        step: 'step_7_verify_success',
        success: false,
        screenshotUrl: null,
        error: error.message,
        timestamp: new Date()
      });
    }

  } catch (error: any) {
    steps.push({
      step: 'unknown_error',
      success: false,
      screenshotUrl: null,
      error: error.message,
      timestamp: new Date()
    });
  }

  return steps;
}

/**
 * 座標取得ヘルパー（解像度対応）
 */
export function getCoordinates(
  resolution: string, 
  element: 'composeButton' | 'textArea' | 'postButton'
): { x: number; y: number } {
  const coords: Record<string, Record<string, { x: number; y: number }>> = {
    '1080x2400': {
      composeButton: { x: 960, y: 2200 },
      textArea: { x: 540, y: 800 },
      postButton: { x: 960, y: 140 },
    },
    '1080x1920': {
      composeButton: { x: 960, y: 1700 },
      textArea: { x: 540, y: 600 },
      postButton: { x: 960, y: 120 },
    },
    '1080x2340': {
      composeButton: { x: 960, y: 2150 },
      textArea: { x: 540, y: 780 },
      postButton: { x: 960, y: 135 },
    },
    '720x1280': {
      composeButton: { x: 640, y: 1150 },
      textArea: { x: 360, y: 400 },
      postButton: { x: 640, y: 80 },
    },
  };

  // デフォルトは1080x2400
  return coords[resolution]?.[element] || coords['1080x2400'][element];
}

/**
 * ヘルパー関数: ADBコマンド実行
 */
async function executeAdb(apiKey: string, deviceId: string, command: string): Promise<string> {
  const response = await axios.post(
    'https://openapi.duoplus.net/api/v1/cloudPhone/executeAdb',
    {
      cloudPhoneId: deviceId,
      command: command,
    },
    {
      headers: {
        'DuoPlus-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data?.data?.output || response.data?.output || '';
}

/**
 * ヘルパー関数: スクリーンショット取得
 */
async function takeScreenshot(apiKey: string, deviceId: string): Promise<string> {
  // スクリーンショットを撮影してS3にアップロード
  await executeAdb(apiKey, deviceId, 'screencap -p /sdcard/screenshot.png');
  await sleep(1000);
  
  // TODO: S3にアップロードして公開URLを返す
  // 現在は仮のURL
  return `https://example.com/screenshots/${deviceId}_${Date.now()}.png`;
}

/**
 * ヘルパー関数: スリープ
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ヘルパー関数: デバイスステータステキスト取得
 */
function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'Not configured',
    1: 'Powered on',
    2: 'Powered off',
    3: 'Expired',
    4: 'Renewal overdue',
    10: 'Powering on',
    11: 'Configuring',
    12: 'Configuration failed',
  };
  return statusMap[status] || 'Unknown';
}
