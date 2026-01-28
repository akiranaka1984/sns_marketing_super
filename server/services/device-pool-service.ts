/**
 * Device Pool Service
 *
 * Manages the pool of available DuoPlus devices for account operations.
 * Provides functions for device assignment, release, and rotation.
 */

import { db } from "../db";
import { devices, accounts } from "../../drizzle/schema";
import { eq, and, isNull, asc, desc, not, sql } from "drizzle-orm";

// ============================================
// Types
// ============================================

export interface DeviceInfo {
  id: number;
  deviceId: string;
  deviceName: string | null;
  status: "available" | "busy" | "offline";
  proxyIp: string | null;
  lastUsedAt: string | null;
}

export interface DeviceAssignmentResult {
  success: boolean;
  deviceId: string | null;
  message: string;
}

// ============================================
// Core Functions
// ============================================

/**
 * Get an available device from the pool
 * Prioritizes devices that haven't been used recently
 */
export async function getAvailableDevice(): Promise<DeviceInfo | null> {
  const availableDevices = await db.select()
    .from(devices)
    .where(eq(devices.status, "available"))
    .orderBy(asc(devices.lastUsedAt))
    .limit(1);

  if (availableDevices.length === 0) {
    console.log("[DevicePool] No available devices in pool");
    return null;
  }

  return availableDevices[0] as DeviceInfo;
}

/**
 * Get device by ID
 */
export async function getDeviceById(deviceId: string): Promise<DeviceInfo | null> {
  const result = await db.select()
    .from(devices)
    .where(eq(devices.deviceId, deviceId))
    .limit(1);

  return result.length > 0 ? result[0] as DeviceInfo : null;
}

/**
 * Get device by internal ID
 */
export async function getDeviceByInternalId(id: number): Promise<DeviceInfo | null> {
  const result = await db.select()
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);

  return result.length > 0 ? result[0] as DeviceInfo : null;
}

/**
 * Get all devices with their status
 */
export async function getAllDevices(): Promise<DeviceInfo[]> {
  const result = await db.select()
    .from(devices)
    .orderBy(desc(devices.lastUsedAt));

  return result as DeviceInfo[];
}

/**
 * Get devices by status
 */
export async function getDevicesByStatus(status: "available" | "busy" | "offline"): Promise<DeviceInfo[]> {
  const result = await db.select()
    .from(devices)
    .where(eq(devices.status, status));

  return result as DeviceInfo[];
}

/**
 * Assign a device to an account
 */
export async function assignDeviceToAccount(
  accountId: number,
  deviceId: string
): Promise<DeviceAssignmentResult> {
  try {
    // Get the device to make sure it exists and is available
    const device = await getDeviceById(deviceId);

    if (!device) {
      return {
        success: false,
        deviceId: null,
        message: `Device ${deviceId} not found`
      };
    }

    if (device.status !== "available") {
      return {
        success: false,
        deviceId: null,
        message: `Device ${deviceId} is not available (status: ${device.status})`
      };
    }

    // Update device status to busy
    await db.update(devices)
      .set({
        status: "busy",
        lastUsedAt: new Date().toISOString()
      })
      .where(eq(devices.deviceId, deviceId));

    // Update account's device ID
    await db.update(accounts)
      .set({ deviceId })
      .where(eq(accounts.id, accountId));

    console.log(`[DevicePool] Assigned device ${deviceId} to account ${accountId}`);

    return {
      success: true,
      deviceId,
      message: `Successfully assigned device ${deviceId} to account ${accountId}`
    };
  } catch (error) {
    console.error("[DevicePool] Error assigning device:", error);
    return {
      success: false,
      deviceId: null,
      message: `Error assigning device: ${error}`
    };
  }
}

/**
 * Release a device back to the pool
 */
export async function releaseDevice(deviceId: string): Promise<boolean> {
  try {
    await db.update(devices)
      .set({
        status: "available",
        lastUsedAt: new Date().toISOString()
      })
      .where(eq(devices.deviceId, deviceId));

    console.log(`[DevicePool] Released device ${deviceId} to pool`);
    return true;
  } catch (error) {
    console.error("[DevicePool] Error releasing device:", error);
    return false;
  }
}

/**
 * Mark device as offline
 */
export async function markDeviceOffline(deviceId: string): Promise<boolean> {
  try {
    await db.update(devices)
      .set({ status: "offline" })
      .where(eq(devices.deviceId, deviceId));

    console.log(`[DevicePool] Marked device ${deviceId} as offline`);
    return true;
  } catch (error) {
    console.error("[DevicePool] Error marking device offline:", error);
    return false;
  }
}

/**
 * Rotate device for an account
 * Releases current device and assigns a new one
 */
export async function rotateDeviceForAccount(
  accountId: number,
  currentDeviceId?: string | null
): Promise<DeviceAssignmentResult> {
  try {
    // Release current device if specified
    if (currentDeviceId) {
      await releaseDevice(currentDeviceId);
    }

    // Get a new available device
    const newDevice = await getAvailableDevice();

    if (!newDevice) {
      return {
        success: false,
        deviceId: null,
        message: "No available devices in pool"
      };
    }

    // Assign the new device
    return await assignDeviceToAccount(accountId, newDevice.deviceId);
  } catch (error) {
    console.error("[DevicePool] Error rotating device:", error);
    return {
      success: false,
      deviceId: null,
      message: `Error rotating device: ${error}`
    };
  }
}

/**
 * Get device pool statistics
 */
export async function getDevicePoolStats(): Promise<{
  total: number;
  available: number;
  busy: number;
  offline: number;
}> {
  const allDevices = await getAllDevices();

  return {
    total: allDevices.length,
    available: allDevices.filter(d => d.status === "available").length,
    busy: allDevices.filter(d => d.status === "busy").length,
    offline: allDevices.filter(d => d.status === "offline").length
  };
}

/**
 * Find accounts without assigned devices
 */
export async function findAccountsWithoutDevices(): Promise<number[]> {
  const result = await db.select({ id: accounts.id })
    .from(accounts)
    .where(isNull(accounts.deviceId));

  return result.map(r => r.id);
}

/**
 * Auto-assign devices to accounts without devices
 * Returns number of successful assignments
 */
export async function autoAssignDevicesToAccounts(): Promise<number> {
  const accountsWithoutDevices = await findAccountsWithoutDevices();
  let successCount = 0;

  for (const accountId of accountsWithoutDevices) {
    const device = await getAvailableDevice();
    if (!device) {
      console.log("[DevicePool] No more available devices for auto-assignment");
      break;
    }

    const result = await assignDeviceToAccount(accountId, device.deviceId);
    if (result.success) {
      successCount++;
    }
  }

  console.log(`[DevicePool] Auto-assigned ${successCount} devices to accounts`);
  return successCount;
}

/**
 * Clean up stale device assignments
 * Mark devices as available if they've been busy for too long without activity
 */
export async function cleanupStaleAssignments(maxIdleHours: number = 24): Promise<number> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - maxIdleHours);

  const staleDevices = await db.select()
    .from(devices)
    .where(
      and(
        eq(devices.status, "busy"),
        sql`${devices.lastUsedAt} < ${cutoffTime.toISOString()}`
      )
    );

  let cleanedCount = 0;
  for (const device of staleDevices) {
    await releaseDevice(device.deviceId);
    cleanedCount++;
  }

  if (cleanedCount > 0) {
    console.log(`[DevicePool] Cleaned up ${cleanedCount} stale device assignments`);
  }

  return cleanedCount;
}
