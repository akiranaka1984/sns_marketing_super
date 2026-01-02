import { db } from '../server/db';
import { accounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function activateAllAccounts() {
  try {
    console.log('='.repeat(60));
    console.log('全アカウントをアクティブ化');
    console.log('='.repeat(60));
    
    // Get all accounts
    const allAccounts = await db.query.accounts.findMany();

    if (allAccounts.length === 0) {
      console.log('⚠️ アカウントが見つかりません');
      return;
    }

    console.log(`合計 ${allAccounts.length} 件のアカウントが見つかりました`);
    console.log('');

    for (const account of allAccounts) {
      console.log('---');
      console.log(`アカウントID: ${account.id}`);
      console.log(`ユーザー名: ${account.username || 'N/A'}`);
      console.log(`プラットフォーム: ${account.platform}`);
      console.log(`現在のステータス: ${account.status}`);
      console.log(`デバイスID: ${account.deviceId || '未設定'}`);

      if (account.status !== 'active') {
        // Update to active
        await db
          .update(accounts)
          .set({
            status: 'active',
          })
          .where(eq(accounts.id, account.id));

        console.log(`✅ ステータスを「${account.status}」→「active」に変更しました`);
      } else {
        console.log('✓ 既にアクティブです');
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('✅ すべてのアカウントをアクティブ化しました！');
    console.log('');
    console.log('次のステップ:');
    console.log('1. アカウント管理画面でステータスを確認');
    console.log('2. スケジュール投稿を再実行');
    console.log('3. 投稿が成功することを確認');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

activateAllAccounts();
