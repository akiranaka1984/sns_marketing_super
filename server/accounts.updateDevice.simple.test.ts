import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';

describe('accounts.updateDevice - simple test', () => {
  it('should have updateDevice mutation', () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: 'test-user', name: 'Test User' },
    });

    expect(caller.accounts.updateDevice).toBeDefined();
  });
});
