import { db } from '../server/db';
import { apiSettings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function checkApiKey() {
  console.log('='.repeat(60));
  console.log('DuoPlus APIキー確認');
  console.log('='.repeat(60));

  // 環境変数から確認
  const envKey = process.env.DUOPLUS_API_KEY;
  if (envKey) {
    console.log('\n環境変数 DUOPLUS_API_KEY:');
    console.log('  先頭20文字:', envKey.substring(0, 20) + '...');
    console.log('  完全なキー:', envKey);
  } else {
    console.log('\n環境変数 DUOPLUS_API_KEY: 未設定');
  }

  // データベースから確認
  const settings = await db.select().from(apiSettings).where(eq(apiSettings.key, 'duoplus_api_key'));
  if (settings.length > 0) {
    const dbKey = settings[0].value;
    console.log('\nデータベース (api_settings):');
    console.log('  先頭20文字:', dbKey.substring(0, 20) + '...');
    console.log('  完全なキー:', dbKey);
    
    // 一致確認
    if (envKey === dbKey) {
      console.log('\n✅ 環境変数とデータベースのAPIキーは一致しています');
    } else {
      console.log('\n⚠️  環境変数とデータベースのAPIキーが異なります');
    }
  } else {
    console.log('\nデータベース (api_settings): APIキーが見つかりません');
  }

  console.log('='.repeat(60));
}

checkApiKey().then(() => process.exit(0)).catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
