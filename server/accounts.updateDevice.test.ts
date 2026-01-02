import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import * as db from './db';

describe('accounts.updateDevice', () => {
  let testUserId: number;
  let testAccountId: number;
  let testDeviceId: string;

  beforeAll(async () => {
    // Create test user with unique openId
    const uniqueOpenId = `test-user-device-change-${Date.now()}`;
    const user = await db.createUser({
      openId: uniqueOpenId,
      name: 'Test User for Device Change',
      email: `device-test-${Date.now()}@example.com`,
    });
    testUserId = user.id;

    // Create test account
    const accountId = await db.createAccount({
      userId: testUserId,
      platform: 'twitter',
      username: `device-test-account-${Date.now()}`,
      password: 'test-password',
      deviceId: 'old-device-id',
      status: 'active',
    });
    testAccountId = accountId;
    testDeviceId = 'new-device-id';
  });

  afterAll(async () => {
    // Cleanup
    if (testAccountId) {
      await db.deleteAccount(testAccountId);
    }
    if (testUserId) {
      await db.deleteUser(testUserId);
    }
  });

  it('should update account device successfully', async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: `test-user-device-change-${testUserId}`, name: 'Test User for Device Change' },
    });

    const result = await caller.accounts.updateDevice({
      accountId: testAccountId,
      deviceId: testDeviceId,
    });

    expect(result.success).toBe(true);

    // Verify the device was updated
    const updatedAccount = await db.getAccountById(testAccountId);
    expect(updatedAccount?.deviceId).toBe(testDeviceId);
  });

  it('should fail when updating device for non-existent account', async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: `test-user-device-change-${testUserId}`, name: 'Test User for Device Change' },
    });

    await expect(
      caller.accounts.updateDevice({
        accountId: 999999,
        deviceId: testDeviceId,
      })
    ).rejects.toThrow('Account not found or unauthorized');
  });

  it('should fail when updating device for account owned by another user', async () => {
    // Create another user with unique openId
    const anotherUser = await db.createUser({
      openId: `another-user-device-test-${Date.now()}`,
      name: 'Another User',
      email: `another-device-test-${Date.now()}@example.com`,
    });

    const caller = appRouter.createCaller({
      user: { id: anotherUser.id, openId: `another-user-device-test-${anotherUser.id}`, name: 'Another User' },
    });

    await expect(
      caller.accounts.updateDevice({
        accountId: testAccountId,
        deviceId: testDeviceId,
      })
    ).rejects.toThrow('Account not found or unauthorized');

    // Cleanup
    await db.deleteUser(anotherUser.id);
  });
});
