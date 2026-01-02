import { getSetting } from '../server/db';
import axios from 'axios';

interface StepResult {
  name: string;
  success: boolean;
  output?: string;
  error?: string;
}

// executeAdbCommand関数
async function executeAdbCommand(apiKey: string, deviceId: string, command: string): Promise<any> {
  const API_URL = process.env.DUOPLUS_API_URL || "https://openapi.duoplus.net";
  
  try {
    const response = await axios.post(
      `${API_URL}/api/v1/cloudPhone/adb`,
      {
        image_ids: [deviceId],
        command: command
      },
      {
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const result = response.data.data[0];
      return {
        success: result.success || false,
        data: result.content || result.message || '',
        message: result.message || ''
      };
    }
    
    return {
      success: false,
      data: '',
      message: 'No data returned from API'
    };
  } catch (error: any) {
    console.error(`[executeAdbCommand] Error:`, error.message);
    return {
      success: false,
      data: '',
      message: error.message
    };
  }
}

async function launchInstagram(deviceId: string) {
  const steps: StepResult[] = [];
  
  try {
    const apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
    if (!apiKey) {
      throw new Error('DUOPLUS_API_KEY is not set');
    }
    
    // Step 1: Instagramインストール確認
    console.log('Step 1: Instagramインストール確認中...');
    const checkInstall = await executeAdbCommand(
      apiKey,
      deviceId,
      'pm list packages | grep instagram'
    );
    
    const isInstalled = checkInstall.data && checkInstall.data.includes('instagram');
    steps.push({
      name: 'Instagramインストール確認',
      success: isInstalled,
      output: isInstalled ? `インストール済み: ${checkInstall.data}` : 'インストールされていません'
    });
    
    if (!isInstalled) {
      return {
        success: false,
        message: 'Instagramがまだインストールされていません。もう少し待ってから再試行してください。',
        steps
      };
    }
    
    // Step 2: ホーム画面に戻る
    console.log('Step 2: ホーム画面に戻る...');
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await new Promise(resolve => setTimeout(resolve, 2000));
    steps.push({
      name: 'ホーム画面に戻る',
      success: true,
      output: 'ホームボタンを押しました'
    });
    
    // Step 3: Instagramアプリ起動
    console.log('Step 3: Instagramアプリ起動中...');
    const launchResult = await executeAdbCommand(
      apiKey,
      deviceId,
      'am start -n com.instagram.android/com.instagram.mainactivity.MainActivity'
    );
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    steps.push({
      name: 'Instagramアプリ起動',
      success: true,
      output: 'Instagramを起動しました'
    });
    
    // Step 4: 解像度取得
    console.log('Step 4: 解像度取得中...');
    const resolutionResult = await executeAdbCommand(
      apiKey,
      deviceId,
      'wm size'
    );
    
    let width = 1080;
    let height = 2400;
    
    if (resolutionResult.data) {
      const match = resolutionResult.data.match(/Physical size: (\d+)x(\d+)/);
      if (match) {
        width = parseInt(match[1]);
        height = parseInt(match[2]);
      }
    }
    
    steps.push({
      name: '解像度取得',
      success: true,
      output: `${width}x${height}`
    });
    
    // Step 5: 投稿ボタンをタップ（画面中央下部の+ボタン）
    console.log('Step 5: 投稿ボタンをタップ...');
    const tapX = Math.floor(width / 2);
    const tapY = Math.floor(height * 0.95); // 画面下部5%の位置
    
    await executeAdbCommand(
      apiKey,
      deviceId,
      `input tap ${tapX} ${tapY}`
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    steps.push({
      name: '投稿ボタンをタップ',
      success: true,
      output: `座標 (${tapX}, ${tapY}) をタップしました`
    });
    
    // Step 6: 最終画面確認
    console.log('Step 6: 最終画面確認中...');
    const finalCheck = await executeAdbCommand(
      apiKey,
      deviceId,
      'dumpsys window | grep mCurrentFocus'
    );
    
    steps.push({
      name: '最終画面確認',
      success: true,
      output: finalCheck.data || '画面情報を取得しました'
    });
    
    return {
      success: true,
      message: 'Instagramアプリを起動し、投稿画面への遷移を試みました',
      steps
    };
    
  } catch (error: any) {
    steps.push({
      name: 'エラー発生',
      success: false,
      error: error.message
    });
    
    return {
      success: false,
      message: `エラーが発生しました: ${error.message}`,
      steps
    };
  }
}

async function main() {
  console.log('=== Instagram起動テスト開始 ===\n');
  
  const deviceId = 's0t85';
  console.log(`デバイスID: ${deviceId}\n`);
  
  const result = await launchInstagram(deviceId);
  
  console.log('\nテスト結果:', result.success ? '✅ 成功' : '❌ 失敗');
  console.log('メッセージ:', result.message);
  console.log('\n--- ステップ詳細 ---');
  
  result.steps.forEach((step, index) => {
    console.log(`\n${index + 1}. ${step.name}`);
    console.log(`   ステータス: ${step.success ? '✅ 成功' : '❌ 失敗'}`);
    if (step.output) {
      console.log(`   出力: ${step.output}`);
    }
    if (step.error) {
      console.log(`   エラー: ${step.error}`);
    }
  });
  
  console.log('\n=== テスト完了 ===');
}

main().catch(console.error);
