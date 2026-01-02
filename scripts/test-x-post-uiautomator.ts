import { postToXWeb } from '../server/x-web-automation';

async function main() {
  console.log('='.repeat(60));
  console.log('UIAutomatorベースのX投稿テスト');
  console.log('='.repeat(60));
  console.log('');
  
  const deviceId = 's0t85';
  const testContent = 'テスト投稿です！UIAutomatorを使用してXに投稿しています。';
  
  console.log(`デバイスID: ${deviceId}`);
  console.log(`投稿内容: ${testContent}`);
  console.log('');
  console.log('投稿を開始します...');
  console.log('');
  
  try {
    const result = await postToXWeb(deviceId, testContent);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('テスト結果');
    console.log('='.repeat(60));
    console.log(`ステータス: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`メッセージ: ${result.message}`);
    console.log('');
    console.log('--- ステップ詳細 ---');
    console.log('');
    
    result.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step.step}`);
      console.log(`   ステータス: ${step.success ? '✅' : '❌'}`);
      if (step.details) {
        console.log(`   詳細: ${step.details}`);
      }
      console.log('');
    });
    
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log('');
      console.log('✅ X投稿が完了しました！');
      console.log('');
      console.log('次のステップ:');
      console.log('1. DuoPlusダッシュボードでデバイスs0t85の画面を確認');
      console.log('2. Xアカウントのタイムラインで投稿を確認');
      console.log('');
    } else {
      console.log('');
      console.log('❌ X投稿に失敗しました');
      console.log('');
      console.log('トラブルシューティング:');
      console.log('1. Xにログインしているか確認');
      console.log('2. デバイスが起動しているか確認');
      console.log('3. DuoPlusダッシュボードで画面を確認');
      console.log('');
    }
    
  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error('');
    console.error('スタックトレース:');
    console.error(error.stack);
    process.exit(1);
  }
}

main();
