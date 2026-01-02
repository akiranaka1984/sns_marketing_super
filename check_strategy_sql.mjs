import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute('SELECT id, projectId, objective, LEFT(engagementStrategy, 300) as engagementStrategy FROM strategies LIMIT 5');

console.log('Total strategies:', rows.length);
rows.forEach((row, index) => {
  console.log(`\n[${index + 1}] Strategy ID: ${row.id}`);
  console.log(`Project ID: ${row.projectId}`);
  console.log(`Objective: ${row.objective?.substring(0, 100)}`);
  console.log(`Engagement Strategy (first 300 chars):`);
  console.log(row.engagementStrategy);
});

await connection.end();
