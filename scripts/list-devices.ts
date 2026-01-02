import { db } from '../server/db';
import { devices } from '../drizzle/schema';

async function listDevices() {
  try {
    console.log('='.repeat(60));
    console.log('利用可能なデバイス一覧');
    console.log('='.repeat(60));
    
    const allDevices = await db.query.devices.findMany();

    if (allDevices.length === 0) {
      console.log('❌ デバイスが見つかりません');
      process.exit(1);
    }

    console.log(`合計 ${allDevices.length} 台のデバイスが見つかりました:\n`);

    allDevices.forEach((device, index) => {
      console.log(`${index + 1}. デバイスID: ${device.deviceId}`);
      console.log(`   名前: ${device.name || 'なし'}`);
      console.log(`   ステータス: ${device.status}`);
      console.log(`   プロキシID: ${device.proxyId || 'なし'}`);
      console.log(`   作成日: ${device.createdAt}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('次のステップ: これらのデバイスにInstagramをインストールします');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
  }
}

listDevices();
