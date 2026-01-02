import { db } from '../server/db';
import { scheduledPosts, accounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const POST_ID = 1;
const TARGET_ACCOUNT_ID = 270002; // a.muran@betrnk-junket.com with device s0t85

async function fixPostAccount() {
  try {
    console.log('='.repeat(60));
    console.log('投稿ID 1のアカウントIDを修正');
    console.log('='.repeat(60));
    
    // Get post
    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, POST_ID),
    });

    if (!post) {
      console.error('❌ 投稿が見つかりません');
      process.exit(1);
    }

    console.log('現在の投稿情報:');
    console.log(`- ID: ${post.id}`);
    console.log(`- アカウントID: ${post.accountId}`);
    console.log(`- 内容: ${post.content.substring(0, 100)}...`);
    console.log(`- ステータス: ${post.status}`);
    console.log('');

    // Get target account
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, TARGET_ACCOUNT_ID),
    });

    if (!account) {
      console.error(`❌ アカウントID ${TARGET_ACCOUNT_ID} が見つかりません`);
      process.exit(1);
    }

    console.log('新しいアカウント情報:');
    console.log(`- ID: ${account.id}`);
    console.log(`- ユーザー名: ${account.username}`);
    console.log(`- プラットフォーム: ${account.platform}`);
    console.log(`- ステータス: ${account.status}`);
    console.log(`- デバイスID: ${account.deviceId}`);
    console.log('');

    // Update post
    await db
      .update(scheduledPosts)
      .set({
        accountId: TARGET_ACCOUNT_ID,
        status: 'pending',
        errorMessage: null,
      })
      .where(eq(scheduledPosts.id, POST_ID));

    console.log('✅ 投稿のアカウントIDを修正しました！');
    console.log(`   ${post.accountId} → ${TARGET_ACCOUNT_ID}`);
    console.log('');
    console.log('次のステップ:');
    console.log('1. スケジュール投稿ページで投稿を確認');
    console.log('2. 「今すぐ実行」または「再試行」ボタンをクリック');
    console.log('3. 投稿が成功することを確認');

  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixPostAccount();
