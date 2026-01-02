import { batchInstallApp } from '../server/duoplus';

const DEVICE_ID = 's0t85';
const APPS = [
  { name: 'X (Twitter)', id: 'Ad1PD#0' },
  { name: 'Instagram', id: 'Ad1PD#1' },
  { name: 'TikTok', id: 'Ad1PD#2' },
];

async function installApps() {
  console.log('='.repeat(60));
  console.log('SNSアプリ一括インストール');
  console.log('='.repeat(60));
  console.log(`デバイスID: ${DEVICE_ID}`);
  console.log('');
  
  for (const app of APPS) {
    try {
      console.log(`[${app.name}] インストール開始...`);
      console.log(`  アプリID: ${app.id}`);
      
      await batchInstallApp([DEVICE_ID], app.id);
      
      console.log(`✅ [${app.name}] インストールリクエスト成功`);
      console.log('');
      
      // 次のアプリインストール前に少し待機
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      console.error(`❌ [${app.name}] インストール失敗:`, error.message);
      console.log('');
    }
  }
  
  console.log('='.repeat(60));
  console.log('すべてのインストールリクエストが完了しました');
  console.log('');
  console.log('注意: アプリのインストールには数分かかる場合があります。');
  console.log('DuoPlusダッシュボードで進捗を確認してください。');
  console.log('='.repeat(60));
}

installApps().catch(console.error);
