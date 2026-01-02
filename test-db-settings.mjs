import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { settings } from './drizzle/schema.ts';

const connection = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(connection, { mode: 'default' });

async function test() {
  try {
    console.log('Testing database connection...');
    const result = await db.select().from(settings).where(eq(settings.key, 'DUOPLUS_API_KEY'));
    console.log('DUOPLUS_API_KEY result:', result);
    
    const openaiResult = await db.select().from(settings).where(eq(settings.key, 'OPENAI_API_KEY'));
    console.log('OPENAI_API_KEY result:', openaiResult);
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await connection.end();
    process.exit(1);
  }
}

test();
