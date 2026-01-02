import { listDevices } from '../server/duoplus';

async function fetchDevices() {
  try {
    console.log('='.repeat(60));
    console.log('DuoPlus APIからデバイス一覧を取得');
    console.log('='.repeat(60));
    
    const devices = await listDevices();

    if (!devices || devices.length === 0) {
      console.log('❌ デバイスが見つかりません');
      process.exit(1);
    }

    console.log(`合計 ${devices.length} 台のデバイスが見つかりました:\n`);

    devices.forEach((device: any, index: number) => {
      console.log(`${index + 1}. デバイスID: ${device.id}`);
      console.log(`   名前: ${device.name || 'なし'}`);
      console.log(`   ステータス: ${device.status || 'なし'}`);
      console.log(`   モデル: ${device.model || 'なし'}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('次のステップ: これらのデバイスにInstagramをインストールします');

    return devices;

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fetchDevices();
