import { executeLike } from '../server/like-service.js';

async function testLike() {
  console.log('=== いいね機能テスト ===\n');

  // テストパラメータ
  const testUrl = 'https://x.com/muran95271/status/1870642082476765461';
  const deviceId = 's0t85';
  const accountId = 270002;

  console.log('テストパラメータ:');
  console.log(`- 投稿URL: ${testUrl}`);
  console.log(`- デバイスID: ${deviceId}`);
  console.log(`- アカウントID: ${accountId}`);
  console.log('');

  try {
    console.log('いいねを実行中...');
    const result = await executeLike(testUrl, deviceId, accountId);

    console.log('\n✅ いいね実行結果:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 いいねが正常に実行されました！');
      if (result.screenshotUrl) {
        console.log(`スクリーンショット: ${result.screenshotUrl}`);
      }
    } else {
      console.log('\n❌ いいね実行に失敗しました');
      console.log(`エラー: ${result.message}`);
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    process.exit(1);
  }
}

testLike();
