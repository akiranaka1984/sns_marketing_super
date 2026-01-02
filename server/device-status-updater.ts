/**
 * Device Status Background Updater
 * Periodically fetches device status from DuoPlus API and updates cache
 */

import { db } from './db';
import { accounts } from '../drizzle/schema';
import { getDeviceStatus } from './duoplus-proxy';
import { deviceStatusCache } from './device-status-cache';

class DeviceStatusUpdater {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private isRunning = false;

  /**
   * Start the background updater
   */
  start(): void {
    if (this.isRunning) {
      console.log('[DeviceStatusUpdater] Already running');
      return;
    }

    console.log('[DeviceStatusUpdater] Starting background updater');
    this.isRunning = true;

    // Run immediately on start
    this.updateAllDeviceStatuses().catch(error => {
      console.error('[DeviceStatusUpdater] Initial update failed:', error);
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.updateAllDeviceStatuses().catch(error => {
        console.error('[DeviceStatusUpdater] Periodic update failed:', error);
      });
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Stop the background updater
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[DeviceStatusUpdater] Stopping background updater');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Update statuses for all active devices
   */
  private async updateAllDeviceStatuses(): Promise<void> {
    try {
      console.log('[DeviceStatusUpdater] Fetching all accounts with device IDs');
      
      // Get all accounts that have device IDs (from all users)
      // Retry logic for database connection errors
      let allAccounts: any[] = [];
      let retries = 3;
      let success = false;
      
      while (retries > 0 && !success) {
        try {
          allAccounts = await db.select().from(accounts);
          success = true;
        } catch (error: any) {
          retries--;
          if (retries === 0) {
            console.error('[DeviceStatusUpdater] Failed to fetch accounts after all retries');
            throw error;
          }
          console.warn(`[DeviceStatusUpdater] Database query failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      const accountsWithDevices = allAccounts.filter((account: any) => account.deviceId);

      if (accountsWithDevices.length === 0) {
        console.log('[DeviceStatusUpdater] No accounts with device IDs found');
        return;
      }

      console.log(`[DeviceStatusUpdater] Updating status for ${accountsWithDevices.length} devices`);

      // Update statuses in parallel (with limit to avoid overwhelming the API)
      const BATCH_SIZE = 5;
      for (let i = 0; i < accountsWithDevices.length; i += BATCH_SIZE) {
        const batch = accountsWithDevices.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (account) => {
            try {
              if (!account.deviceId) return;
              
              // This will update the cache automatically
              await getDeviceStatus(account.deviceId);
              console.log(`[DeviceStatusUpdater] Updated status for device ${account.deviceId}`);
            } catch (error) {
              console.error(`[DeviceStatusUpdater] Failed to update device ${account.deviceId}:`, error);
            }
          })
        );

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < accountsWithDevices.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('[DeviceStatusUpdater] Status update completed');
    } catch (error: any) {
      console.error('[DeviceStatusUpdater] Failed to update device statuses:', error);
      // Don't throw error to prevent stopping the interval
      // Log the error and continue to next update cycle
      if (error.message && error.message.includes('ECONNRESET')) {
        console.error('[DeviceStatusUpdater] Database connection was reset. Will retry on next cycle.');
      }
    }
  }

  /**
   * Get current cache statistics
   */
  getCacheStats(): { size: number; isRunning: boolean } {
    return {
      size: deviceStatusCache.size(),
      isRunning: this.isRunning,
    };
  }
}

export const deviceStatusUpdater = new DeviceStatusUpdater();
