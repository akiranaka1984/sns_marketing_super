import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { strategies } from './drizzle/schema.ts';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const allStrategies = await db.select().from(strategies);

console.log('Total strategies:', allStrategies.length);
console.log('\n--- Strategy Details ---');
allStrategies.forEach((strategy, index) => {
  console.log(`\n[${index + 1}] Strategy ID: ${strategy.id}`);
  console.log(`Project ID: ${strategy.projectId}`);
  console.log(`Objective: ${strategy.objective?.substring(0, 100)}...`);
  console.log(`Engagement Strategy Type: ${typeof strategy.engagementStrategy}`);
  console.log(`Engagement Strategy (first 200 chars):`);
  console.log(strategy.engagementStrategy?.substring(0, 200));
});

await connection.end();
