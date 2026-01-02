import { db } from '../server/db';
import { scheduledPosts, accounts } from '../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

async function checkFailedPosts() {
  try {
    const failedPosts = await db.query.scheduledPosts.findMany({
      where: eq(scheduledPosts.status, 'failed'),
      orderBy: [desc(scheduledPosts.id)],
      limit: 10,
    });

    console.log('='.repeat(60));
    console.log('失敗したスケジュール投稿');
    console.log('='.repeat(60));
    console.log(`合計: ${failedPosts.length}件`);
    console.log('');

    for (const post of failedPosts) {
      // Get account details
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, post.accountId),
      });

      console.log('---');
      console.log(`投稿ID: ${post.id}`);
      console.log(`アカウントID: ${post.accountId}`);
      if (account) {
        console.log(`アカウント名: ${account.username || 'N/A'}`);
        console.log(`プラットフォーム: ${account.platform}`);
        console.log(`デバイスID: ${account.deviceId || '未設定'}`);
        console.log(`アカウントステータス: ${account.status}`);
      }
      console.log(`内容: ${post.content.substring(0, 100)}...`);
      console.log(`予定時刻: ${post.scheduledTime}`);
      console.log(`エラーメッセージ: ${post.errorMessage || 'なし'}`);
      console.log('');
    }

    // Check for common issues
    console.log('='.repeat(60));
    console.log('よくある問題:');
    console.log('='.repeat(60));
    
    const noDeviceIdCount = failedPosts.filter(async (post) => {
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, post.accountId),
      });
      return !account?.deviceId;
    }).length;

    const deviceOffCount = failedPosts.filter(post => 
      post.errorMessage?.includes('not powered on')
    ).length;

    const accountInactiveCount = failedPosts.filter(post => 
      post.errorMessage?.includes('Account is')
    ).length;

    console.log(`- デバイスID未設定: ${noDeviceIdCount}件`);
    console.log(`- デバイスが起動していない: ${deviceOffCount}件`);
    console.log(`- アカウントが非アクティブ: ${accountInactiveCount}件`);
    
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
  }
}

checkFailedPosts();
