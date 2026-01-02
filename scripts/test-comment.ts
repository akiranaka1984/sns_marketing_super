import { executeComment } from '../server/comment-service';

async function testComment() {
  console.log('=== コメント機能テスト ===\n');

  // テストパラメータ
  const testUrl = 'https://x.com/muran95271/status/1870642082476765461';
  const deviceId = 's0t85';
  const accountId = 270002;
  const commentText = 'Great post! 素晴らしい投稿ですね！';

  console.log('テストパラメータ:');
  console.log(`- 投稿URL: ${testUrl}`);
  console.log(`- デバイスID: ${deviceId}`);
  console.log(`- アカウントID: ${accountId}`);
  console.log(`- コメント: ${commentText}`);
  console.log('');

  try {
    console.log('コメントを実行中...');
    const result = await executeComment(deviceId, testUrl, commentText);

    console.log('\n✅ コメント実行結果:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 コメントが正常に実行されました！');
      if (result.screenshotUrl) {
        console.log(`スクリーンショット: ${result.screenshotUrl}`);
      }
    } else {
      console.log('\n❌ コメント実行に失敗しました');
      console.log(`エラー: ${result.message}`);
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

testComment();
