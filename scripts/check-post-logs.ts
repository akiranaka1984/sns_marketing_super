import { db } from '../server/db';
import { logs, scheduledPosts, accounts } from '../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

async function checkPostLogs() {
  try {
    console.log('='.repeat(60));
    console.log('投稿ID 1のログを確認');
    console.log('='.repeat(60));
    
    // Get post details
    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, 1),
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
    console.log(`- 投稿日時: ${post.postedAt || 'なし'}`);
    console.log(`- エラー: ${post.errorMessage || 'なし'}`);
    console.log('');

    // Get account details
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, post.accountId),
    });

    if (account) {
      console.log('アカウント情報:');
      console.log(`- ユーザー名: ${account.username}`);
      console.log(`- プラットフォーム: ${account.platform}`);
      console.log(`- デバイスID: ${account.deviceId}`);
      console.log('');
    }

    // Get logs related to this account
    const accountLogs = await db.query.logs.findMany({
      where: eq(logs.accountId, post.accountId),
      orderBy: [desc(logs.createdAt)],
      limit: 10,
    });

    console.log('最近のログ:');
    if (accountLogs.length === 0) {
      console.log('ログがありません');
    } else {
      accountLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.status}] ${log.action}`);
        console.log(`   時刻: ${log.createdAt}`);
        console.log(`   詳細: ${log.details?.substring(0, 100) || 'なし'}...`);
        if (log.errorMessage) {
          console.log(`   エラー: ${log.errorMessage}`);
        }
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('次のステップ:');
    console.log('1. DuoPlusダッシュボードでデバイスs0t85を開く');
    console.log('2. Xアプリを起動');
    console.log('3. プロフィールページを開いて投稿を確認');
    console.log('4. 投稿内容が一致するか確認');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
  }
}

checkPostLogs();
