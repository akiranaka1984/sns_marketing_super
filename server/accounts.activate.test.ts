import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from './routers';
import * as db from './db';

describe('Account Activation', () => {
  let testUserId: number;
  let testAccountId: number;

  beforeAll(async () => {
    // Create a test user (assuming user with ID 1 exists)
    testUserId = 1;
    
    // Create a test account with pending status
    testAccountId = await db.createAccount({
      userId: testUserId,
      platform: 'instagram',
      username: 'test_activation_account',
      password: 'test_password',
      status: 'pending',
    });
  });

  it('should activate a pending account', async () => {
    const caller = appRouter.createCaller({
      user: {
        id: testUserId,
        openId: 'test_open_id',
        name: 'Test User',
        email: 'test@example.com',
        loginMethod: 'google',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    // Activate the account
    const result = await caller.accounts.activate({ accountId: testAccountId });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify the account status is now active
    const account = await db.getAccountById(testAccountId);
    expect(account).toBeDefined();
    expect(account?.status).toBe('active');
  });

  it('should batch activate all pending accounts', async () => {
    // Create multiple pending accounts
    const pendingAccount1 = await db.createAccount({
      userId: testUserId,
      platform: 'twitter',
      username: 'test_batch_1',
      password: 'test_password',
      status: 'pending',
    });

    const pendingAccount2 = await db.createAccount({
      userId: testUserId,
      platform: 'facebook',
      username: 'test_batch_2',
      password: 'test_password',
      status: 'pending',
    });

    const caller = appRouter.createCaller({
      user: {
        id: testUserId,
        openId: 'test_open_id',
        name: 'Test User',
        email: 'test@example.com',
        loginMethod: 'google',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    // Batch activate
    const result = await caller.accounts.batchActivate();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);

    // Verify all accounts are now active
    const account1 = await db.getAccountById(pendingAccount1);
    const account2 = await db.getAccountById(pendingAccount2);
    
    expect(account1?.status).toBe('active');
    expect(account2?.status).toBe('active');
  });

  it('should not activate account belonging to another user', async () => {
    const caller = appRouter.createCaller({
      user: {
        id: 999, // Different user ID
        openId: 'other_user_open_id',
        name: 'Other User',
        email: 'other@example.com',
        loginMethod: 'google',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    // Try to activate another user's account
    await expect(
      caller.accounts.activate({ accountId: testAccountId })
    ).rejects.toThrow('Account not found or unauthorized');
  });
});
