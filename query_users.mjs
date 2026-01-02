import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== Users with "中村" in name ===');
const [nakamuraUsers] = await connection.execute(
  "SELECT id, openId, name, email, role FROM users WHERE name LIKE ?",
  ['%中村%']
);
console.log(JSON.stringify(nakamuraUsers, null, 2));

console.log('\n=== Owner user (openId: TmCLdJCVAbQVHhTctixhKf) ===');
const [ownerUsers] = await connection.execute(
  "SELECT id, openId, name, email, role FROM users WHERE openId = ?",
  ['TmCLdJCVAbQVHhTctixhKf']
);
console.log(JSON.stringify(ownerUsers, null, 2));

console.log('\n=== All users (first 10) ===');
const [allUsers] = await connection.execute(
  "SELECT id, openId, name, email, role FROM users LIMIT 10"
);
console.log(JSON.stringify(allUsers, null, 2));

await connection.end();
