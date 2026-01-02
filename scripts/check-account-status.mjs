import { db } from '../server/db.ts';
import { accounts } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const account = await db.select().from(accounts).where(eq(accounts.username, 'arnoldmuran82@gmail.com')).limit(1);

console.log('Account details:', JSON.stringify(account, null, 2));

if (account.length > 0) {
  console.log('\n=== Account Status ===');
  console.log('Username:', account[0].username);
  console.log('Platform:', account[0].platform);
  console.log('Status:', account[0].status);
  console.log('Device ID:', account[0].deviceId);
  console.log('Created At:', account[0].createdAt);
}

process.exit(0);
