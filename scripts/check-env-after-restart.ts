// サーバー起動時の環境変数確認スクリプト
console.log('='.repeat(60));
console.log('サーバー起動後の環境変数確認');
console.log('='.repeat(60));

console.log('\nDUOPLUS_API_KEY:');
console.log(`  値: ${process.env.DUOPLUS_API_KEY}`);

console.log('\nOPENAI_API_KEY:');
console.log(`  値: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);

console.log('='.repeat(60));
