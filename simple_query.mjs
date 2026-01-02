import mysql from 'mysql2/promise';

try {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await conn.query("SELECT id, openId, name, email FROM users WHERE name LIKE '%中村%' OR name = 'fu' ORDER BY name");
  
  console.log('Found users:');
  rows.forEach(row => {
    console.log(`- ID: ${row.id}, OpenID: ${row.openId}, Name: ${row.name}, Email: ${row.email}`);
  });
  
  await conn.end();
} catch (error) {
  console.error('Error:', error.message);
}
