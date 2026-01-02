/**
 * X Web版投稿の自動修正機能
 */

import axios from 'axios';
import { diagnoseDevice, DiagnosisResult } from './x-web-diagnosis';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export interface AutoFixResult {
  success: boolean;
  fixedIssues: string[];
  remainingIssues: string[];
  actions: FixAction[];
  finalDiagnosis?: DiagnosisResult;
}

export interface FixAction {
  issue: string;
  action: string;
  success: boolean;
  error?: string;
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
    console.error('[AutoFix] Failed to get API key from database:', error);
    return null;
  }
}

/**
 * 診断結果に基づいて問題を自動修正
 */
export async function autoFixDevice(deviceId: string): Promise<AutoFixResult> {
  const result: AutoFixResult = {
    success: false,
    fixedIssues: [],
    remainingIssues: [],
    actions: []
  };

  const apiKey = await getApiKey();
  if (!apiKey) {
    result.remainingIssues.push('DUOPLUS_API_KEY not found');
    return result;
  }

  try {
    console.log('[AutoFix] Step 1: Running initial diagnosis...');
    const initialDiagnosis = await diagnoseDevice(deviceId);

    // 問題1: デバイスの電源がオフ
    if (initialDiagnosis.deviceStatus && !initialDiagnosis.deviceStatus.isOnline) {
      console.log('[AutoFix] Issue detected: Device is powered off');
      const powerOnResult = await fixDevicePowerOff(apiKey, deviceId);
      result.actions.push(powerOnResult);
      
      if (powerOnResult.success) {
        result.fixedIssues.push('Device powered on');
        // 電源オン後、起動を待つ
        console.log('[AutoFix] Waiting for device to boot...');
        await sleep(30000); // 30秒待機
      } else {
        result.remainingIssues.push('Failed to power on device');
      }
    }

    // 問題2: Chromeがインストールされていない
    if (initialDiagnosis.chromeStatus && !initialDiagnosis.chromeStatus.isInstalled) {
      console.log('[AutoFix] Issue detected: Chrome is not installed');
      result.actions.push({
        issue: 'Chrome not installed',
        action: 'Cannot auto-install Chrome',
        success: false,
        error: 'Chrome installation requires manual intervention',
        timestamp: new Date()
      });
      result.remainingIssues.push('Chrome is not installed (manual installation required)');
    }

    // 問題3: Chromeが起動していない
    if (initialDiagnosis.chromeStatus && 
        initialDiagnosis.chromeStatus.isInstalled && 
        !initialDiagnosis.chromeStatus.isRunning) {
      console.log('[AutoFix] Issue detected: Chrome is not running');
      const chromeStartResult = await fixChromeNotRunning(apiKey, deviceId);
      result.actions.push(chromeStartResult);
      
      if (chromeStartResult.success) {
        result.fixedIssues.push('Chrome started');
      } else {
        result.remainingIssues.push('Failed to start Chrome');
      }
    }

    // 問題4: Xにログインしていない
    if (initialDiagnosis.xLoginStatus && !initialDiagnosis.xLoginStatus.isLoggedIn) {
      console.log('[AutoFix] Issue detected: Not logged in to X');
      result.actions.push({
        issue: 'Not logged in to X',
        action: 'Manual login required',
        success: false,
        error: 'Automatic login is not possible due to Play Integrity API restrictions',
        timestamp: new Date()
      });
      result.remainingIssues.push('Not logged in to X (manual login required via DuoPlus dashboard)');
    }

    // 問題5: 画面が予期しない状態
    console.log('[AutoFix] Resetting screen state to home...');
    const resetScreenResult = await fixScreenState(apiKey, deviceId);
    result.actions.push(resetScreenResult);
    
    if (resetScreenResult.success) {
      result.fixedIssues.push('Screen reset to home');
    }

    // 最終診断を実行
    console.log('[AutoFix] Step 2: Running final diagnosis...');
    await sleep(5000);
    const finalDiagnosis = await diagnoseDevice(deviceId);
    result.finalDiagnosis = finalDiagnosis;

    // 成功判定
    result.success = result.remainingIssues.length === 0 && finalDiagnosis.errors.length === 0;

    console.log('[AutoFix] Auto-fix completed');
    console.log(`[AutoFix] Fixed issues: ${result.fixedIssues.length}`);
    console.log(`[AutoFix] Remaining issues: ${result.remainingIssues.length}`);

  } catch (error: any) {
    console.error('[AutoFix] Error:', error);
    result.remainingIssues.push(`Auto-fix failed: ${error.message}`);
  }

  return result;
}

/**
 * 修正1: デバイスの電源をオンにする
 */
async function fixDevicePowerOff(apiKey: string, deviceId: string): Promise<FixAction> {
  const action: FixAction = {
    issue: 'Device powered off',
    action: 'Power on device',
    success: false,
    timestamp: new Date()
  };

  try {
    console.log('[AutoFix] Powering on device...');
    const response = await axios.post(
      'https://openapi.duoplus.net/api/v1/cloudPhone/powerOn',
      {
        cloudPhoneIds: [deviceId]
      },
      {
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (response.data?.code === 0 || response.data?.success) {
      action.success = true;
      console.log('[AutoFix] Device powered on successfully');
    } else {
      action.error = response.data?.message || 'Unknown error';
      console.error('[AutoFix] Failed to power on device:', action.error);
    }
  } catch (error: any) {
    action.error = error.message;
    console.error('[AutoFix] Error powering on device:', error);
  }

  return action;
}

/**
 * 修正2: Chromeを起動する
 */
async function fixChromeNotRunning(apiKey: string, deviceId: string): Promise<FixAction> {
  const action: FixAction = {
    issue: 'Chrome not running',
    action: 'Start Chrome',
    success: false,
    timestamp: new Date()
  };

  try {
    console.log('[AutoFix] Starting Chrome...');
    await executeAdb(apiKey, deviceId, 
      'am start -n com.android.chrome/com.google.android.apps.chrome.Main'
    );
    await sleep(3000);
    
    action.success = true;
    console.log('[AutoFix] Chrome started successfully');
  } catch (error: any) {
    action.error = error.message;
    console.error('[AutoFix] Error starting Chrome:', error);
  }

  return action;
}

/**
 * 修正3: 画面状態をリセット（ホーム画面に戻す）
 */
async function fixScreenState(apiKey: string, deviceId: string): Promise<FixAction> {
  const action: FixAction = {
    issue: 'Screen in unexpected state',
    action: 'Reset to home screen',
    success: false,
    timestamp: new Date()
  };

  try {
    console.log('[AutoFix] Resetting screen to home...');
    
    // ホーム画面に戻る
    await executeAdb(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(1000);
    
    // 最近使ったアプリをクリア
    await executeAdb(apiKey, deviceId, 'input keyevent KEYCODE_APP_SWITCH');
    await sleep(500);
    await executeAdb(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(500);
    
    action.success = true;
    console.log('[AutoFix] Screen reset successfully');
  } catch (error: any) {
    action.error = error.message;
    console.error('[AutoFix] Error resetting screen:', error);
  }

  return action;
}

/**
 * 診断→自動修正→投稿のワークフロー
 */
export async function diagnoseAndFixBeforePost(deviceId: string): Promise<{
  canPost: boolean;
  diagnosis: DiagnosisResult;
  autoFixResult?: AutoFixResult;
  message: string;
}> {
  console.log('[Workflow] Starting diagnose and fix workflow...');

  // 初回診断
  const initialDiagnosis = await diagnoseDevice(deviceId);

  // 問題がなければそのまま投稿可能
  if (initialDiagnosis.errors.length === 0) {
    return {
      canPost: true,
      diagnosis: initialDiagnosis,
      message: 'Device is ready for posting'
    };
  }

  // 問題があれば自動修正を試みる
  console.log('[Workflow] Issues detected, attempting auto-fix...');
  const autoFixResult = await autoFixDevice(deviceId);

  // 修正後の状態を確認
  const canPost = autoFixResult.success && 
                  autoFixResult.remainingIssues.length === 0 &&
                  autoFixResult.finalDiagnosis?.errors.length === 0;

  let message = '';
  if (canPost) {
    message = 'Device is ready for posting after auto-fix';
  } else if (autoFixResult.remainingIssues.length > 0) {
    message = `Cannot post: ${autoFixResult.remainingIssues.join(', ')}`;
  } else {
    message = 'Auto-fix completed but device may still have issues';
  }

  return {
    canPost,
    diagnosis: autoFixResult.finalDiagnosis || initialDiagnosis,
    autoFixResult,
    message
  };
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
 * ヘルパー関数: スリープ
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
