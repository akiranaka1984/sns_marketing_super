import { db } from '../server/db';
import { accounts, scheduledPosts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function checkAccount() {
  try {
    console.log('='.repeat(60));
    console.log('アカウントID 1の情報を確認');
    console.log('='.repeat(60));
    
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, 1),
    });

    if (!account) {
      console.log('❌ アカウントID 1は存在しません');
      console.log('');
      
      // Check which account IDs exist
      const allAccounts = await db.query.accounts.findMany({
        limit: 10,
      });

      console.log(`データベースには ${allAccounts.length} 件のアカウントがあります:`);
      allAccounts.forEach(a => {
        console.log(`- ID: ${a.id}, Username: ${a.username || 'N/A'}, Platform: ${a.platform}, Status: ${a.status}, DeviceID: ${a.deviceId || '未設定'}`);
      });

      // Check scheduled posts
      console.log('');
      console.log('スケジュール投稿を確認:');
      const posts = await db.query.scheduledPosts.findMany({
        limit: 5,
      });

      posts.forEach(p => {
        console.log(`- 投稿ID: ${p.id}, アカウントID: ${p.accountId}, ステータス: ${p.status}`);
      });

    } else {
      console.log('✅ アカウントID 1が見つかりました:');
      console.log(`- ID: ${account.id}`);
      console.log(`- ユーザー名: ${account.username || 'N/A'}`);
      console.log(`- プラットフォーム: ${account.platform}`);
      console.log(`- ステータス: ${account.status}`);
      console.log(`- デバイスID: ${account.deviceId || '未設定'}`);
    }

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
  }
}

checkAccount();
