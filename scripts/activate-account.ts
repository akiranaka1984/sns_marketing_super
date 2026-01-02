import { db } from '../server/db';
import { accounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const ACCOUNT_ID = 1; // a.muran@betrnk-junket.com

async function activateAccount() {
  try {
    console.log('='.repeat(60));
    console.log('アカウントをアクティブ化');
    console.log('='.repeat(60));
    
    // Get current account status
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, ACCOUNT_ID),
    });

    if (!account) {
      console.error('❌ アカウントが見つかりません');
      process.exit(1);
    }

    console.log('現在のアカウント情報:');
    console.log(`- ID: ${account.id}`);
    console.log(`- ユーザー名: ${account.username}`);
    console.log(`- プラットフォーム: ${account.platform}`);
    console.log(`- 現在のステータス: ${account.status}`);
    console.log(`- デバイスID: ${account.deviceId || '未設定'}`);
    console.log('');

    if (account.status === 'active') {
      console.log('✅ このアカウントは既にアクティブです');
      return;
    }

    // Update status to active
    await db
      .update(accounts)
      .set({
        status: 'active',
      })
      .where(eq(accounts.id, ACCOUNT_ID));

    console.log('✅ ステータスを「アクティブ」に変更しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. アカウント管理画面でステータスを確認');
    console.log('2. スケジュール投稿を再実行');
    console.log('3. 投稿が成功することを確認');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

activateAccount();
