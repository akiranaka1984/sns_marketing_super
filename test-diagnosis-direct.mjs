/**
 * X Web版投稿の診断テスト（サーバー側直接実行）
 */

import { diagnoseDevice } from './server/x-web-diagnosis.ts';
import { testPostStep } from './server/x-web-diagnosis.ts';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

// テスト対象デバイスID
const TEST_DEVICE_ID = 'snap_pJciL';

async function runDiagnosisTest() {
  console.log(`\n========================================`);
  console.log(`診断テスト: ${TEST_DEVICE_ID}`);
  console.log(`========================================\n`);

  try {
    const result = await diagnoseDevice(TEST_DEVICE_ID);

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
    console.error(error.stack);
  }
}

async function runStepTest() {
  console.log(`\n========================================`);
  console.log(`ステップテスト: ${TEST_DEVICE_ID}`);
  console.log(`========================================\n`);

  try {
    const steps = await testPostStep(TEST_DEVICE_ID, 'テスト投稿 from automated test');

    console.log('📝 ステップテスト結果:\n');

    steps.forEach((step, index) => {
      console.log(`\nステップ ${index + 1}: ${step.step}`);
      console.log(`  - 成功: ${step.success ? '✅' : '❌'}`);
      if (step.screenshotUrl) {
        console.log(`  - スクリーンショット: ${step.screenshotUrl}`);
      }
      if (step.error) {
        console.log(`  - エラー: ${step.error}`);
      }
      console.log(`  - タイムスタンプ: ${step.timestamp}`);
    });

    console.log('\n========================================\n');

    // 失敗したステップを特定
    const failedSteps = steps.filter(s => !s.success);
    if (failedSteps.length > 0) {
      console.log('⚠️ 失敗したステップ:');
      failedSteps.forEach(step => {
        console.log(`  - ${step.step}: ${step.error}`);
      });
    } else {
      console.log('✅ すべてのステップが成功しました');
    }

    return steps;

  } catch (error) {
    console.error('❌ ステップテスト失敗:', error.message);
    console.error(error.stack);
  }
}

async function main() {
  console.log('🚀 X Web版投稿のテストを開始します\n');

  // 環境変数チェック
  if (!process.env.DUOPLUS_API_KEY) {
    console.error('❌ DUOPLUS_API_KEY が設定されていません');
    process.exit(1);
  }

  // 1. 診断テスト
  console.log('📋 Phase 1: 診断テスト\n');
  const diagnosisResult = await runDiagnosisTest();

  // 診断結果に基づいて次のステップを決定
  if (diagnosisResult && diagnosisResult.errors.length === 0) {
    console.log('\n✅ 診断テストが成功しました。ステップテストを実行します。\n');
    
    // 2. ステップテスト
    console.log('📋 Phase 2: ステップテスト\n');
    await runStepTest();
  } else {
    console.log('\n⚠️ 診断テストでエラーが検出されました。ステップテストはスキップします。');
    console.log('まず、検出された問題を解決してください。');
  }

  console.log('\n✅ すべてのテストが完了しました');
}

main().catch(console.error);
