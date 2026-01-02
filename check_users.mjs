import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { like } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('=== All users with "中村" in name ===');
const users = await db.select().from(schema.users).where(like(schema.users.name, '%中村%'));
console.log(JSON.stringify(users, null, 2));

console.log('\n=== Owner user (TmCLdJCVAbQVHhTctixhKf) ===');
const ownerUsers = await db.select().from(schema.users).where(schema.users.openId.eq('TmCLdJCVAbQVHhTctixhKf'));
console.log(JSON.stringify(ownerUsers, null, 2));

await connection.end();
