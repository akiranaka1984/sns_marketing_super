import { batchInstallApp } from '../server/duoplus';

async function installInstagram() {
  console.log('=== Instagram自動インストール開始 ===\n');
  
  const deviceId = 's0t85';
  const instagramAppId = 'Ad1PD#1'; // DuoPlusのInstagramアプリID
  
  console.log(`デバイスID: ${deviceId}`);
  console.log(`アプリID: ${instagramAppId}\n`);
  
  try {
    // Instagramアプリをインストール
    console.log('Instagramアプリをインストール中...');
    await batchInstallApp([deviceId], instagramAppId);
    
    console.log('✅ インストールが完了しました！');
    console.log('\nインストールには数分かかる場合があります。');
    console.log('DuoPlusダッシュボードでインストール状況を確認してください。');
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
  }
  
  console.log('\n=== 処理完了 ===');
}

installInstagram().catch(console.error);
