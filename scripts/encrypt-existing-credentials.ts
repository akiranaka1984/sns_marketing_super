/**
 * Migration script: Encrypt existing plaintext credentials
 *
 * Run with: npx tsx scripts/encrypt-existing-credentials.ts
 *
 * This script encrypts:
 * - accounts.password
 * - proxies credentials (host, port, username, password)
 * - settings table API keys
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema';
import { encrypt, isEncrypted } from '../server/utils/encryption';

async function main() {
  const connection = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: 'default' });

  console.log('Starting credential encryption migration...\n');

  // 1. Encrypt account passwords
  const accounts = await db.select().from(schema.accounts);
  let accountsEncrypted = 0;
  for (const account of accounts) {
    if (account.password && !isEncrypted(account.password)) {
      await db
        .update(schema.accounts)
        .set({ password: encrypt(account.password) })
        .where(eq(schema.accounts.id, account.id));
      accountsEncrypted++;
    }
  }
  console.log(`Encrypted ${accountsEncrypted}/${accounts.length} account passwords`);

  // 2. Encrypt proxy credentials
  const proxies = await db.select().from(schema.proxies);
  let proxiesEncrypted = 0;
  for (const proxy of proxies) {
    const updates: Record<string, string> = {};
    if (proxy.username && !isEncrypted(proxy.username)) {
      updates.username = encrypt(proxy.username);
    }
    if (proxy.password && !isEncrypted(proxy.password)) {
      updates.password = encrypt(proxy.password);
    }
    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.proxies)
        .set(updates)
        .where(eq(schema.proxies.id, proxy.id));
      proxiesEncrypted++;
    }
  }
  console.log(`Encrypted ${proxiesEncrypted}/${proxies.length} proxy credentials`);

  // 3. Encrypt sensitive settings (API keys)
  const sensitiveKeys = ['OPENAI_API_KEY', 'X_API_BEARER_TOKEN', 'X_API_KEY', 'X_API_SECRET'];
  const settings = await db.select().from(schema.settings);
  let settingsEncrypted = 0;
  for (const setting of settings) {
    if (
      sensitiveKeys.includes(setting.key) &&
      setting.value &&
      !isEncrypted(setting.value)
    ) {
      await db
        .update(schema.settings)
        .set({ value: encrypt(setting.value) })
        .where(eq(schema.settings.key, setting.key));
      settingsEncrypted++;
    }
  }
  console.log(`Encrypted ${settingsEncrypted} sensitive settings`);

  console.log('\nEncryption migration complete!');
  await connection.end();
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
