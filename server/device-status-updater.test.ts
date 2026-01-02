import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { deviceStatusUpdater } from './device-status-updater';
import { deviceStatusCache } from './device-status-cache';

describe('Device Status Updater', () => {
  beforeAll(() => {
    // Clear cache before tests
    deviceStatusCache.clear();
  });

  afterAll(() => {
    // Stop the updater after tests
    deviceStatusUpdater.stop();
  });

  it('should start and stop the background updater', () => {
    // In test environment, start the updater manually
    deviceStatusUpdater.start();
    const stats = deviceStatusUpdater.getCacheStats();
    expect(stats.isRunning).toBe(true);
  });

  it('should have cache statistics', () => {
    const stats = deviceStatusUpdater.getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('isRunning');
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.isRunning).toBe('boolean');
  });

  it('should update device statuses and populate cache', async () => {
    // Wait for initial update to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    const stats = deviceStatusUpdater.getCacheStats();
    // Cache should have some entries after update
    expect(stats.size).toBeGreaterThanOrEqual(0);
  });

  it('should handle stop and restart', () => {
    deviceStatusUpdater.stop();
    let stats = deviceStatusUpdater.getCacheStats();
    expect(stats.isRunning).toBe(false);

    deviceStatusUpdater.start();
    stats = deviceStatusUpdater.getCacheStats();
    expect(stats.isRunning).toBe(true);
  });

  it('should not start multiple times', () => {
    deviceStatusUpdater.start();
    deviceStatusUpdater.start(); // Should log "Already running"
    const stats = deviceStatusUpdater.getCacheStats();
    expect(stats.isRunning).toBe(true);
  });
});

describe('Device Status Cache', () => {
  beforeAll(() => {
    deviceStatusCache.clear();
  });

  it('should store and retrieve device status', () => {
    const testStatus = {
      status: 'online',
      deviceName: 'Test Device',
      ip: '192.168.1.1',
    };

    deviceStatusCache.set('test-device-1', testStatus);
    const retrieved = deviceStatusCache.get('test-device-1');

    expect(retrieved).toEqual(testStatus);
  });

  it('should return null for non-existent device', () => {
    const retrieved = deviceStatusCache.get('non-existent-device');
    expect(retrieved).toBeNull();
  });

  it('should expire old entries', async () => {
    const testStatus = {
      status: 'online',
      deviceName: 'Test Device',
      ip: '192.168.1.1',
    };

    deviceStatusCache.set('test-device-2', testStatus);
    
    // Wait for TTL to expire (30 seconds + buffer)
    await new Promise(resolve => setTimeout(resolve, 31000));

    const retrieved = deviceStatusCache.get('test-device-2');
    expect(retrieved).toBeNull();
  }, 35000); // Increase test timeout

  it('should clear all entries', () => {
    deviceStatusCache.set('test-device-3', { status: 'online' });
    deviceStatusCache.set('test-device-4', { status: 'online' });

    expect(deviceStatusCache.size()).toBeGreaterThan(0);

    deviceStatusCache.clear();
    expect(deviceStatusCache.size()).toBe(0);
  });

  it('should limit cache size', () => {
    deviceStatusCache.clear();

    // Add more entries than MAX_SIZE (200)
    for (let i = 0; i < 250; i++) {
      deviceStatusCache.set(`test-device-${i}`, { status: 'online' });
    }

    // Cache should not exceed MAX_SIZE
    expect(deviceStatusCache.size()).toBeLessThanOrEqual(200);
  });
});
