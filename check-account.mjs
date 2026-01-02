import { db } from './server/db.ts';
import { accounts } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const result = await db.select().from(accounts).where(eq(accounts.username, 'arnold@bkkeyforceservices.ph'));
console.log(JSON.stringify(result, null, 2));
