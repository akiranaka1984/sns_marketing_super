import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 重複しているアカウントを確認
const [duplicates] = await connection.execute(`
  SELECT username, platform, COUNT(*) as cnt 
  FROM accounts 
  GROUP BY username, platform 
  HAVING cnt > 1
  ORDER BY cnt DESC
`);

console.log("重複アカウント一覧:");
console.table(duplicates);

// 総アカウント数
const [total] = await connection.execute(`SELECT COUNT(*) as total FROM accounts`);
console.log("\n総アカウント数:", total[0].total);

// 重複を除いたユニークなアカウント数
const [unique] = await connection.execute(`SELECT COUNT(DISTINCT username, platform) as unique_count FROM accounts`);
console.log("ユニークアカウント数:", unique[0].unique_count);

await connection.end();
