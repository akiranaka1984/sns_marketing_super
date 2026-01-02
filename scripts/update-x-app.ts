import { updateApp } from '../server/duoplus';

const DEVICE_ID = 's0t85';
const X_APP_ID = 'Ad1PD#0';

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Xアプリアップデートスクリプト');
    console.log('='.repeat(60));
    console.log(`デバイスID: ${DEVICE_ID}`);
    console.log(`アプリID: ${X_APP_ID}`);
    console.log('');
    
    console.log('アップデート処理を開始します...');
    console.log('');
    
    await updateApp(DEVICE_ID, X_APP_ID);
    
    console.log('');
    console.log('✅ アップデートが完了しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. DuoPlusダッシュボードでデバイスs0t85を確認');
    console.log('2. Xアプリを起動して動作確認');
    console.log('3. アップデート要求メッセージが表示されないことを確認');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error('');
    console.error('トラブルシューティング:');
    console.error('1. DuoPlus APIキーが正しく設定されているか確認');
    console.error('2. デバイスs0t85が起動しているか確認');
    console.error('3. DuoPlusダッシュボードで手動アップデートを試す');
    process.exit(1);
  }
}

main();
