import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== 重複アカウントのクリーンアップ ===\n");

// 重複しているアカウントを確認
const [duplicates] = await connection.execute(`
  SELECT username, platform, COUNT(*) as cnt 
  FROM accounts 
  GROUP BY username, platform 
  HAVING cnt > 1
`);

console.log(`重複アカウント数: ${duplicates.length}組\n`);

// 各重複グループについて、最初のレコード（deviceIdがあるものを優先）を残して他を削除
for (const dup of duplicates) {
  console.log(`処理中: ${dup.username} (${dup.platform})`);
  
  // deviceIdがあるレコードを優先的に残す
  const [records] = await connection.execute(`
    SELECT id, deviceId, createdAt 
    FROM accounts 
    WHERE username = ? AND platform = ?
    ORDER BY 
      CASE WHEN deviceId IS NOT NULL THEN 0 ELSE 1 END,
      createdAt ASC
  `, [dup.username, dup.platform]);
  
  // 最初のレコードを残す
  const keepId = records[0].id;
  const deleteIds = records.slice(1).map(r => r.id);
  
  console.log(`  保持するID: ${keepId} (deviceId: ${records[0].deviceId || 'なし'})`);
  console.log(`  削除するID: ${deleteIds.join(', ')}`);
  
  if (deleteIds.length > 0) {
    // 関連するレコードを先に削除（外部キー制約がある場合）
    
    // scheduled_posts
    await connection.execute(`DELETE FROM scheduled_posts WHERE accountId IN (${deleteIds.join(',')})`);
    
    // post_analytics
    await connection.execute(`DELETE FROM post_analytics WHERE accountId IN (${deleteIds.join(',')})`);
    
    // agent_accounts
    await connection.execute(`DELETE FROM agent_accounts WHERE accountId IN (${deleteIds.join(',')})`);
    
    // project_accounts
    await connection.execute(`DELETE FROM project_accounts WHERE accountId IN (${deleteIds.join(',')})`);
    
    // analytics
    await connection.execute(`DELETE FROM analytics WHERE accountId IN (${deleteIds.join(',')})`);
    
    // 最後にアカウントを削除
    await connection.execute(`DELETE FROM accounts WHERE id IN (${deleteIds.join(',')})`);
    
    console.log(`  ${deleteIds.length}件削除しました\n`);
  }
}

// 結果を確認
const [total] = await connection.execute(`SELECT COUNT(*) as total FROM accounts`);
const [unique] = await connection.execute(`SELECT COUNT(DISTINCT username, platform) as unique_count FROM accounts`);

console.log("\n=== クリーンアップ完了 ===");
console.log(`総アカウント数: ${total[0].total}`);
console.log(`ユニークアカウント数: ${unique[0].unique_count}`);

await connection.end();
