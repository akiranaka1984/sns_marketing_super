/**
 * X Web版投稿の診断テストスクリプト
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/trpc';

// テスト対象デバイスID（データベースから取得した実際のデバイスID）
const TEST_DEVICE_IDS = [
  'snap_pJciL',  // 実際のデバイスIDに置き換える
];

async function runDiagnosisTest(deviceId) {
  console.log(`\n========================================`);
  console.log(`診断テスト: ${deviceId}`);
  console.log(`========================================\n`);

  try {
    const response = await axios.post(
      `${API_BASE_URL}/xWeb.diagnose`,
      {
        deviceId: deviceId
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const result = response.data?.result?.data;

    if (!result) {
      console.error('❌ 診断結果が取得できませんでした');
      return;
    }

    console.log('📊 診断結果:\n');

    // デバイスステータス
    if (result.deviceStatus) {
      console.log('🔌 デバイスステータス:');
      console.log(`  - オンライン: ${result.deviceStatus.isOnline ? '✅' : '❌'}`);
      console.log(`  - ステータスコード: ${result.deviceStatus.statusCode}`);
      console.log(`  - ステータス: ${result.deviceStatus.statusText}`);
    }

    // 解像度
    if (result.screenResolution) {
      console.log('\n📱 画面解像度:');
      console.log(`  - 幅: ${result.screenResolution.width}px`);
      console.log(`  - 高さ: ${result.screenResolution.height}px`);
      console.log(`  - 形式: ${result.screenResolution.raw}`);
    }

    // スクリーンショット
    if (result.currentScreen) {
      console.log('\n📸 スクリーンショット:');
      console.log(`  - URL: ${result.currentScreen.screenshotUrl}`);
      console.log(`  - タイムスタンプ: ${result.currentScreen.timestamp}`);
    }

    // Chromeステータス
    if (result.chromeStatus) {
      console.log('\n🌐 Chromeステータス:');
      console.log(`  - インストール済み: ${result.chromeStatus.isInstalled ? '✅' : '❌'}`);
      console.log(`  - 起動中: ${result.chromeStatus.isRunning ? '✅' : '❌'}`);
    }

    // Xログイン状態
    if (result.xLoginStatus) {
      console.log('\n🐦 Xログイン状態:');
      console.log(`  - ログイン済み: ${result.xLoginStatus.isLoggedIn ? '✅' : '❌'}`);
      console.log(`  - 現在のURL: ${result.xLoginStatus.currentUrl || 'N/A'}`);
    }

    // エラー
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ エラー:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ エラーなし');
    }

    console.log('\n========================================\n');

    return result;

  } catch (error) {
    console.error('❌ 診断テスト失敗:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
  }
}

async function main() {
  console.log('🚀 X Web版投稿の診断テストを開始します\n');

  for (const deviceId of TEST_DEVICE_IDS) {
    await runDiagnosisTest(deviceId);
    
    // 次のテストまで少し待機
    if (TEST_DEVICE_IDS.indexOf(deviceId) < TEST_DEVICE_IDS.length - 1) {
      console.log('次のテストまで5秒待機...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('✅ すべての診断テストが完了しました');
}

main().catch(console.error);
