import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import * as db from './db';
import * as schema from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { Context } from './_core/context';

describe('Account Duplicate Check', () => {
  let testUserId1: number;
  let testUserId2: number;
  let testAccountId: number;

  beforeAll(async () => {
    // Create two test users
    const user1 = await db.db.insert(schema.users).values({
      openId: `test-duplicate-user-1-${Date.now()}`,
      name: 'Test User 1',
      email: 'test1@example.com',
      loginMethod: 'google',
      role: 'user',
    });
    testUserId1 = Number(user1[0].insertId);

    const user2 = await db.db.insert(schema.users).values({
      openId: `test-duplicate-user-2-${Date.now()}`,
      name: 'Test User 2',
      email: 'test2@example.com',
      loginMethod: 'google',
      role: 'user',
    });
    testUserId2 = Number(user2[0].insertId);

    // Create a test account for user 1
    const account = await db.db.insert(schema.accounts).values({
      userId: testUserId1,
      platform: 'twitter',
      username: `test-duplicate-${Date.now()}@example.com`,
      password: 'test-password',
      status: 'active',
    });
    testAccountId = Number(account[0].insertId);
  });

  afterAll(async () => {
    // Clean up test data
    if (testAccountId) {
      await db.db.delete(schema.accounts).where(eq(schema.accounts.id, testAccountId));
    }
    if (testUserId1) {
      await db.db.delete(schema.users).where(eq(schema.users.id, testUserId1));
    }
    if (testUserId2) {
      await db.db.delete(schema.users).where(eq(schema.users.id, testUserId2));
    }
  });

  it('should prevent duplicate account creation for the same user', async () => {
    const caller = appRouter.createCaller({
      user: {
        id: testUserId1,
        openId: `test-duplicate-user-1-${Date.now()}`,
        name: 'Test User 1',
        email: 'test1@example.com',
        loginMethod: 'google',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSignedIn: new Date().toISOString(),
      },
    } as Context);

    const account = await db.getAccountById(testAccountId);
    
    // Try to create a duplicate account with the same username and platform
    await expect(
      caller.accounts.create({
        platform: 'twitter',
        username: account!.username,
        password: 'test-password-2',
      })
    ).rejects.toThrow(/already exists/);
  });

  it('should allow same username for different users', async () => {
    const caller = appRouter.createCaller({
      user: {
        id: testUserId2,
        openId: `test-duplicate-user-2-${Date.now()}`,
        name: 'Test User 2',
        email: 'test2@example.com',
        loginMethod: 'google',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSignedIn: new Date().toISOString(),
      },
    } as Context);

    const account = await db.getAccountById(testAccountId);
    
    // User 2 should be able to create an account with the same username as User 1
    const result = await caller.accounts.create({
      platform: 'twitter',
      username: account!.username,
      password: 'test-password-3',
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');

    // Clean up the created account
    await db.db.delete(schema.accounts).where(eq(schema.accounts.id, result.id));
  });

  it('should allow same username for different platforms', async () => {
    const caller = appRouter.createCaller({
      user: {
        id: testUserId1,
        openId: `test-duplicate-user-1-${Date.now()}`,
        name: 'Test User 1',
        email: 'test1@example.com',
        loginMethod: 'google',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSignedIn: new Date().toISOString(),
      },
    } as Context);

    const account = await db.getAccountById(testAccountId);
    
    // Same user should be able to use the same username on a different platform
    const result = await caller.accounts.create({
      platform: 'instagram',
      username: account!.username,
      password: 'test-password-4',
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');

    // Clean up the created account
    await db.db.delete(schema.accounts).where(eq(schema.accounts.id, result.id));
  });
});
