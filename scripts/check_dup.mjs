import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 重複しているアカウントを確認
const [duplicates] = await connection.execute(`
  SELECT username, platform, COUNT(*) as cnt 
  FROM accounts 
  GROUP BY username, platform 
  HAVING cnt > 1
  ORDER BY cnt DESC
  LIMIT 20
`);

console.log("重複アカウント一覧:");
console.table(duplicates);

// 重複の詳細を確認
const [details] = await connection.execute(`
  SELECT id, username, platform, deviceId, createdAt 
  FROM accounts 
  WHERE (username, platform) IN (
    SELECT username, platform 
    FROM accounts 
    GROUP BY username, platform 
    HAVING COUNT(*) > 1
  )
  ORDER BY username, platform, createdAt
  LIMIT 50
`);

console.log("\n重複アカウントの詳細:");
console.table(details);

await connection.end();
