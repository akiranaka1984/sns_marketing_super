import { getSetting } from '../server/db';

async function testApiKeyLoading() {
  console.log('='.repeat(60));
  console.log('APIキー読み込みテスト');
  console.log('='.repeat(60));

  console.log('\n1. 現在の環境変数:');
  console.log(`   DUOPLUS_API_KEY: ${process.env.DUOPLUS_API_KEY}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);

  console.log('\n2. データベースから読み込み:');
  try {
    const duoplusApiKey = await getSetting('DUOPLUS_API_KEY');
    const openaiApiKey = await getSetting('OPENAI_API_KEY');
    
    console.log(`   DUOPLUS_API_KEY: ${duoplusApiKey}`);
    console.log(`   OPENAI_API_KEY: ${openaiApiKey?.substring(0, 20)}...`);
    
    console.log('\n3. 環境変数を更新:');
    if (duoplusApiKey) {
      process.env.DUOPLUS_API_KEY = duoplusApiKey;
      console.log('   ✅ DUOPLUS_API_KEY を更新しました');
    }
    if (openaiApiKey) {
      process.env.OPENAI_API_KEY = openaiApiKey;
      console.log('   ✅ OPENAI_API_KEY を更新しました');
    }
    
    console.log('\n4. 更新後の環境変数:');
    console.log(`   DUOPLUS_API_KEY: ${process.env.DUOPLUS_API_KEY}`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);
    
  } catch (error: any) {
    console.error('\n❌ エラー:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('='.repeat(60));
  process.exit(0);
}

testApiKeyLoading();
