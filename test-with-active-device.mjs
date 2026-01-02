import { diagnoseDevice } from './server/x-web-diagnosis.ts';
import { db } from './server/db.ts';
import { devices } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // アクティブなデバイスを取得
  const activeDevices = await db
    .select()
    .from(devices)
    .where(eq(devices.status, 1))
    .limit(1);

  if (activeDevices.length === 0) {
    console.error('❌ アクティブなデバイスが見つかりません');
    process.exit(1);
  }

  const deviceId = activeDevices[0].deviceId;
  console.log(`\n🚀 診断テスト開始: ${deviceId} (${activeDevices[0].deviceName || 'No name'})\n`);

  const result = await diagnoseDevice(deviceId);

  console.log('📊 診断結果:\n');

  if (result.deviceStatus) {
    console.log('🔌 デバイスステータス:');
    console.log(`  - オンライン: ${result.deviceStatus.isOnline ? '✅' : '❌'}`);
    console.log(`  - ステータスコード: ${result.deviceStatus.statusCode}`);
    console.log(`  - ステータス: ${result.deviceStatus.statusText}`);
  }

  if (result.screenResolution) {
    console.log('\n📱 画面解像度:');
    console.log(`  - 幅: ${result.screenResolution.width}px`);
    console.log(`  - 高さ: ${result.screenResolution.height}px`);
    console.log(`  - 形式: ${result.screenResolution.raw}`);
  }

  if (result.chromeStatus) {
    console.log('\n🌐 Chromeステータス:');
    console.log(`  - インストール済み: ${result.chromeStatus.isInstalled ? '✅' : '❌'}`);
    console.log(`  - 起動中: ${result.chromeStatus.isRunning ? '✅' : '❌'}`);
  }

  if (result.xLoginStatus) {
    console.log('\n🐦 Xログイン状態:');
    console.log(`  - ログイン済み: ${result.xLoginStatus.isLoggedIn ? '✅' : '❌'}`);
  }

  if (result.errors && result.errors.length > 0) {
    console.log('\n⚠️ エラー:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  } else {
    console.log('\n✅ エラーなし');
  }
}

main().catch(console.error);
