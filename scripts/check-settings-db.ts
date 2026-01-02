import { db } from '../server/db';
import { settings } from '../drizzle/schema';

async function checkSettings() {
  console.log('='.repeat(60));
  console.log('データベースのsettingsテーブル確認');
  console.log('='.repeat(60));

  try {
    const allSettings = await db.select().from(settings);
    
    console.log(`\n全設定数: ${allSettings.length}件\n`);
    
    for (const setting of allSettings) {
      console.log(`キー: ${setting.key}`);
      console.log(`値: ${setting.value?.substring(0, 50)}${setting.value && setting.value.length > 50 ? '...' : ''}`);
      console.log(`説明: ${setting.description || '(なし)'}`);
      console.log(`更新日時: ${setting.updatedAt}`);
      console.log('-'.repeat(60));
    }
    
    // 特にDUOPLUS_API_KEYを確認
    const duoplusKey = allSettings.find(s => s.key === 'DUOPLUS_API_KEY');
    if (duoplusKey) {
      console.log('\n✅ DUOPLUS_API_KEY が見つかりました:');
      console.log(`   完全な値: ${duoplusKey.value}`);
    } else {
      console.log('\n❌ DUOPLUS_API_KEY が見つかりません');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
  
  console.log('='.repeat(60));
  process.exit(0);
}

checkSettings();
