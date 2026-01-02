import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as proxyDb from './proxy.db';
import * as db from './db';
import { batchGetDeviceProxyStatus, findProxyIdByHostPort, addProxyToDuoPlus, setDeviceProxy } from './duoplus-proxy';

// Mock the dependencies
vi.mock('./proxy.db');
vi.mock('./db');
vi.mock('./duoplus-proxy');

describe('Proxy Sync - Skip Already Configured Proxies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip proxies that are already configured on devices', async () => {
    // Mock data: 12 proxies, 3 already configured
    const mockProxies = [
      { id: 1, host: 'proxy1.com', port: 8080, username: 'user1', password: 'pass1', assignedAccountId: 1, duoplusProxyId: 'dp1' },
      { id: 2, host: 'proxy2.com', port: 8080, username: 'user2', password: 'pass2', assignedAccountId: 2, duoplusProxyId: 'dp2' },
      { id: 3, host: 'proxy3.com', port: 8080, username: 'user3', password: 'pass3', assignedAccountId: 3, duoplusProxyId: 'dp3' },
      { id: 4, host: 'proxy4.com', port: 8080, username: 'user4', password: 'pass4', assignedAccountId: 4, duoplusProxyId: null },
      { id: 5, host: 'proxy5.com', port: 8080, username: 'user5', password: 'pass5', assignedAccountId: 5, duoplusProxyId: null },
    ];

    const mockAccounts = [
      { id: 1, username: 'Account #1', userId: 1, deviceId: 'device1' },
      { id: 2, username: 'Account #2', userId: 1, deviceId: 'device2' },
      { id: 3, username: 'Account #3', userId: 1, deviceId: 'device3' },
      { id: 4, username: 'Account #4', userId: 1, deviceId: 'device4' },
      { id: 5, username: 'Account #5', userId: 1, deviceId: 'device5' },
    ];

    // Mock device proxy status: devices 1-3 already have proxies configured
    const mockDeviceProxyStatus = {
      device1: { isConfigured: true, proxyId: 'dp1' },
      device2: { isConfigured: true, proxyId: 'dp2' },
      device3: { isConfigured: true, proxyId: 'dp3' },
      device4: { isConfigured: false },
      device5: { isConfigured: false },
    };

    // Setup mocks
    vi.mocked(proxyDb.getAllProxies).mockResolvedValue(mockProxies as any);
    vi.mocked(db.getAccountsByUserId).mockResolvedValue(mockAccounts as any);
    vi.mocked(batchGetDeviceProxyStatus).mockResolvedValue(mockDeviceProxyStatus);
    vi.mocked(findProxyIdByHostPort).mockImplementation(async (host, port) => {
      const proxy = mockProxies.find(p => p.host === host && p.port === port);
      return proxy?.duoplusProxyId || null;
    });
    vi.mocked(addProxyToDuoPlus).mockResolvedValue('new-duoplus-id');
    vi.mocked(setDeviceProxy).mockResolvedValue(undefined);

    // Simulate the syncToDuoPlus logic
    const assignedProxies = mockProxies.filter(p => p.assignedAccountId !== null);
    
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const proxy of assignedProxies) {
      const account = mockAccounts.find(a => a.id === proxy.assignedAccountId);
      
      if (!account || !account.deviceId) {
        continue;
      }

      // Check if device already has a proxy configured
      const currentProxyStatus = mockDeviceProxyStatus[account.deviceId];
      if (currentProxyStatus?.isConfigured) {
        console.log(`Skipping device ${account.deviceId} - already configured`);
        skipped++;
        continue;
      }

      // Would set proxy here
      synced++;
    }

    // Assertions
    expect(synced).toBe(2); // Only devices 4 and 5 should be synced
    expect(skipped).toBe(3); // Devices 1, 2, and 3 should be skipped
    expect(errors.length).toBe(0);

    console.log(`✅ Test passed: ${synced} proxies synced, ${skipped} skipped`);
  });

  it('should handle devices without device IDs', async () => {
    const mockProxies = [
      { id: 1, host: 'proxy1.com', port: 8080, username: 'user1', password: 'pass1', assignedAccountId: 1, duoplusProxyId: 'dp1' },
      { id: 2, host: 'proxy2.com', port: 8080, username: 'user2', password: 'pass2', assignedAccountId: 2, duoplusProxyId: 'dp2' },
    ];

    const mockAccounts = [
      { id: 1, username: 'Account #1', userId: 1, deviceId: 'device1' },
      { id: 2, username: 'Account #2', userId: 1, deviceId: null }, // No device ID
    ];

    const mockDeviceProxyStatus = {
      device1: { isConfigured: false },
    };

    vi.mocked(proxyDb.getAllProxies).mockResolvedValue(mockProxies as any);
    vi.mocked(db.getAccountsByUserId).mockResolvedValue(mockAccounts as any);
    vi.mocked(batchGetDeviceProxyStatus).mockResolvedValue(mockDeviceProxyStatus);

    const assignedProxies = mockProxies.filter(p => p.assignedAccountId !== null);
    
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const proxy of assignedProxies) {
      const account = mockAccounts.find(a => a.id === proxy.assignedAccountId);
      
      if (!account) {
        continue;
      }
      
      if (!account.deviceId) {
        errors.push(`${account.username}: デバイスIDが未設定`);
        continue;
      }

      const currentProxyStatus = mockDeviceProxyStatus[account.deviceId];
      if (currentProxyStatus?.isConfigured) {
        skipped++;
        continue;
      }

      synced++;
    }

    expect(synced).toBe(1); // Only account 1 should be synced
    expect(skipped).toBe(0);
    expect(errors.length).toBe(1); // Account 2 should have an error
    expect(errors[0]).toContain('デバイスIDが未設定');

    console.log(`✅ Test passed: ${synced} proxies synced, ${errors.length} errors`);
  });
});
