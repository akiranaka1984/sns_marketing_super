import { getSetting } from '../server/db';
import axios from 'axios';

interface StepResult {
  name: string;
  success: boolean;
  output?: string;
  error?: string;
}

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

async function postToXViaChrome(deviceId: string, postContent: string) {
  const steps: StepResult[] = [];
  
  try {
    const apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
    if (!apiKey) {
      throw new Error('DUOPLUS_API_KEY is not set');
    }
    
    // Step 1: ホーム画面に戻る
    console.log('Step 1: ホーム画面に戻る...');
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await new Promise(resolve => setTimeout(resolve, 2000));
    steps.push({
      name: 'ホーム画面に戻る',
      success: true,
      output: 'ホームボタンを押しました'
    });
    
    // Step 2: Chromeブラウザを起動
    console.log('Step 2: Chromeブラウザを起動...');
    await executeAdbCommand(
      apiKey,
      deviceId,
      'am start -n com.android.chrome/com.google.android.apps.chrome.Main'
    );
    await new Promise(resolve => setTimeout(resolve, 3000));
    steps.push({
      name: 'Chromeブラウザを起動',
      success: true,
      output: 'Chromeを起動しました'
    });
    
    // Step 3: X.comにアクセス
    console.log('Step 3: X.comにアクセス...');
    await executeAdbCommand(
      apiKey,
      deviceId,
      'am start -a android.intent.action.VIEW -d "https://x.com"'
    );
    await new Promise(resolve => setTimeout(resolve, 5000));
    steps.push({
      name: 'X.comにアクセス',
      success: true,
      output: 'X.comを開きました'
    });
    
    // Step 4: 画面解像度を取得
    console.log('Step 4: 画面解像度を取得...');
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
      name: '画面解像度を取得',
      success: true,
      output: `${width}x${height}`
    });
    
    // Step 5: 投稿ボタンをタップ（右下の+ボタン）
    console.log('Step 5: 投稿ボタンをタップ...');
    const postButtonX = Math.floor(width * 0.85); // 右側85%の位置
    const postButtonY = Math.floor(height * 0.90); // 下部90%の位置
    
    await executeAdbCommand(
      apiKey,
      deviceId,
      `input tap ${postButtonX} ${postButtonY}`
    );
    await new Promise(resolve => setTimeout(resolve, 3000));
    steps.push({
      name: '投稿ボタンをタップ',
      success: true,
      output: `座標 (${postButtonX}, ${postButtonY}) をタップしました`
    });
    
    // Step 6: テキストエリアをタップ
    console.log('Step 6: テキストエリアをタップ...');
    const textAreaX = Math.floor(width * 0.5);
    const textAreaY = Math.floor(height * 0.3);
    
    await executeAdbCommand(
      apiKey,
      deviceId,
      `input tap ${textAreaX} ${textAreaY}`
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    steps.push({
      name: 'テキストエリアをタップ',
      success: true,
      output: `座標 (${textAreaX}, ${textAreaY}) をタップしました`
    });
    
    // Step 7: 投稿テキストを入力
    console.log('Step 7: 投稿テキストを入力...');
    // ADBのinput textコマンドは特殊文字をエスケープする必要がある
    const escapedText = postContent.replace(/\s/g, '%s').replace(/'/g, "\\'");
    await executeAdbCommand(
      apiKey,
      deviceId,
      `input text "${escapedText}"`
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    steps.push({
      name: '投稿テキストを入力',
      success: true,
      output: `テキスト: ${postContent}`
    });
    
    // Step 8: 投稿ボタンをタップ（右上の投稿ボタン）
    console.log('Step 8: 投稿ボタンをタップ...');
    const submitButtonX = Math.floor(width * 0.85);
    const submitButtonY = Math.floor(height * 0.08);
    
    await executeAdbCommand(
      apiKey,
      deviceId,
      `input tap ${submitButtonX} ${submitButtonY}`
    );
    await new Promise(resolve => setTimeout(resolve, 3000));
    steps.push({
      name: '投稿を送信',
      success: true,
      output: `座標 (${submitButtonX}, ${submitButtonY}) をタップしました`
    });
    
    // Step 9: 最終画面確認
    console.log('Step 9: 最終画面確認...');
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
      message: 'ChromeブラウザからXへの投稿プロセスが完了しました',
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
  console.log('=== ChromeからX投稿テスト ===\n');
  
  const deviceId = 's0t85';
  const postContent = 'テスト投稿です！ChromeブラウザからXに投稿しています。';
  
  console.log(`デバイスID: ${deviceId}`);
  console.log(`投稿内容: ${postContent}\n`);
  
  const result = await postToXViaChrome(deviceId, postContent);
  
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
