import { tap, wait, pressBack } from '../server/duoplus';
import axios from 'axios';

const DEVICE_ID = 's0t85';
const X_PACKAGE_NAME = 'com.twitter.android';

/**
 * Google Play経由でXアプリをアップデート
 */
async function updateXViaPlayStore() {
  try {
    console.log('='.repeat(60));
    console.log('Google Play経由でXアプリをアップデート');
    console.log('='.repeat(60));
    console.log(`デバイスID: ${DEVICE_ID}`);
    console.log(`パッケージ名: ${X_PACKAGE_NAME}`);
    console.log('');
    
    // Step 1: Google Playを起動してXアプリのページを開く
    console.log('Step 1: Google PlayでXアプリのページを開きます...');
    const playStoreUrl = `market://details?id=${X_PACKAGE_NAME}`;
    await executeAdb(DEVICE_ID, `am start -a android.intent.action.VIEW -d "${playStoreUrl}"`);
    await wait(5000); // Google Playの読み込みを待つ
    
    // Step 2: 「更新」ボタンをタップ
    console.log('Step 2: 「更新」ボタンをタップします...');
    // Google Playの「更新」ボタンの座標（画面中央やや上）
    // 実際の座標は画面サイズによって異なる可能性があります
    await tap(DEVICE_ID, 540, 800); // 1080x1920の場合の推定座標
    await wait(2000);
    
    // Step 3: アップデートの完了を待つ
    console.log('Step 3: アップデートの完了を待ちます...');
    console.log('（この処理には数分かかる場合があります）');
    await wait(30000); // 30秒待機（実際のアップデート時間は異なる可能性あり）
    
    // Step 4: ホームに戻る
    console.log('Step 4: ホーム画面に戻ります...');
    await pressBack(DEVICE_ID);
    await wait(1000);
    await pressBack(DEVICE_ID);
    
    console.log('');
    console.log('✅ アップデート処理が完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. DuoPlusダッシュボードでデバイスs0t85を確認');
    console.log('2. Xアプリを起動して動作確認');
    console.log('3. アップデート要求メッセージが表示されないことを確認');
    console.log('');
    console.log('⚠️ 注意: アップデートに時間がかかる場合があります。');
    console.log('   「更新」ボタンが表示されない場合は、既に最新版です。');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error('');
    console.error('トラブルシューティング:');
    console.error('1. DuoPlusダッシュボードで手動でGoogle Playを開く');
    console.error('2. Xアプリを検索して「更新」ボタンをタップ');
    console.error('3. アップデート完了後、Xアプリを起動して確認');
    process.exit(1);
  }
}

// ADB executeコマンドのヘルパー関数
async function executeAdb(deviceId: string, command: string): Promise<void> {
  const apiKey = process.env.DUOPLUS_API_KEY || '';
  
  await axios.post('https://openapi.duoplus.net/api/v1/cloudPhone/executeAdb', {
    cloudPhoneId: deviceId,
    command: command,
  }, {
    headers: {
      'DuoPlus-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });
}

updateXViaPlayStore();
