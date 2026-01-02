import { publishPost } from '../server/scheduled-posts';
import { db } from '../server/db';
import { scheduledPosts, accounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const POST_ID = 1;

async function retryPost() {
  try {
    console.log('='.repeat(60));
    console.log('投稿ID 1を再試行');
    console.log('='.repeat(60));
    
    // Get post details
    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, POST_ID),
    });

    if (!post) {
      console.error('❌ 投稿が見つかりません');
      process.exit(1);
    }

    console.log('投稿情報:');
    console.log(`- ID: ${post.id}`);
    console.log(`- アカウントID: ${post.accountId}`);
    console.log(`- 内容: ${post.content.substring(0, 100)}...`);
    console.log(`- ステータス: ${post.status}`);
    console.log(`- エラー: ${post.errorMessage || 'なし'}`);
    console.log('');

    // Get account details
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, post.accountId),
    });

    if (!account) {
      console.error('❌ アカウントが見つかりません');
      process.exit(1);
    }

    console.log('アカウント情報:');
    console.log(`- ID: ${account.id}`);
    console.log(`- ユーザー名: ${account.username}`);
    console.log(`- プラットフォーム: ${account.platform}`);
    console.log(`- ステータス: ${account.status}`);
    console.log(`- デバイスID: ${account.deviceId || '未設定'}`);
    console.log('');

    if (account.status !== 'active') {
      console.error(`❌ アカウントステータスが「${account.status}」です`);
      console.log('アカウントを「active」に変更してください');
      process.exit(1);
    }

    if (!account.deviceId) {
      console.error('❌ デバイスIDが設定されていません');
      process.exit(1);
    }

    // Reset status to pending
    console.log('ステータスを「pending」にリセット...');
    await db
      .update(scheduledPosts)
      .set({
        status: 'pending',
        errorMessage: null,
      })
      .where(eq(scheduledPosts.id, POST_ID));

    console.log('投稿を実行中...');
    console.log('');

    // Publish post
    const result = await publishPost(POST_ID);

    console.log('='.repeat(60));
    if (result.success) {
      console.log('✅ 投稿に成功しました！');
    } else {
      console.log('❌ 投稿に失敗しました');
      console.log(`エラー: ${result.message}`);
    }
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

retryPost();
