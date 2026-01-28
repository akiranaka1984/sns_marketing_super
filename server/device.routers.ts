import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDeviceStatus } from "./duoplus-proxy";
import { startDevice, stopDevice, restartDevice } from "./device-power";
import { listDevices, updateApp } from "./duoplus";
import {
  getAllDevices,
  getDeviceById,
  getDevicePoolStats,
  assignDeviceToAccount,
  releaseDevice,
  rotateDeviceForAccount,
  autoAssignDevicesToAccounts,
  cleanupStaleAssignments
} from "./services/device-pool-service";
import { db } from "./db";
import { accounts, devices } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const deviceRouter = router({
  /**
   * Get device status
   */
  getStatus: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const status = await getDeviceStatus(input.deviceId);
        return status;
      } catch (error: any) {
        throw new Error(`Failed to get device status: ${error.message}`);
      }
    }),

  /**
   * Start a device (power on)
   */
  start: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await startDevice(input.deviceId);
    }),

  /**
   * Stop a device (power off)
   */
  stop: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await stopDevice(input.deviceId);
    }),

  /**
   * Restart a device
   */
  restart: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await restartDevice(input.deviceId);
    }),

  /**
   * List all DuoPlus devices
   */
  listDuoPlusDevices: protectedProcedure
    .query(async () => {
      try {
        const devices = await listDevices();
        return devices.map((device) => ({
          deviceId: device.id,
          name: device.name || device.remark || device.id,
          status: device.status === 1 ? "running" : device.status === 2 ? "stopped" : "unknown",
          os: device.os,
          ip: device.ip,
          area: device.area,
          expiredAt: device.expired_at,
        }));
      } catch (error: any) {
        console.error("[Device] Failed to list DuoPlus devices:", error);
        return [];
      }
    }),

  /**
   * Update an app on a device (uninstall and reinstall)
   */
  updateApp: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      appId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await updateApp(input.deviceId, input.appId);
        return { success: true, message: `Successfully updated app ${input.appId}` };
      } catch (error: any) {
        console.error(`[Device] Failed to update app ${input.appId}:`, error);
        throw new Error(`Failed to update app: ${error.message}`);
      }
    }),

  // ============================================
  // Device Pool Management APIs
  // ============================================

  /**
   * Get device pool with stats and device list
   */
  getDevicePool: protectedProcedure
    .query(async () => {
      try {
        const stats = await getDevicePoolStats();
        const deviceList = await getAllDevices();

        // Get account assignments
        const accountList = await db.select({
          id: accounts.id,
          username: accounts.username,
          deviceId: accounts.deviceId,
        }).from(accounts);

        const accountMap = new Map(
          accountList.map(a => [a.deviceId, a.username])
        );

        const devicesWithAssignment = deviceList.map(device => ({
          ...device,
          assignedAccount: accountMap.get(device.deviceId) || null,
        }));

        return {
          stats,
          devices: devicesWithAssignment,
        };
      } catch (error: any) {
        console.error("[Device] Failed to get device pool:", error);
        throw new Error(`Failed to get device pool: ${error.message}`);
      }
    }),

  /**
   * Assign an account to a device
   */
  assignAccountToDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      accountId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        await assignDeviceToAccount(input.accountId, input.deviceId);
        return { success: true };
      } catch (error: any) {
        console.error("[Device] Failed to assign account to device:", error);
        throw new Error(`Failed to assign account: ${error.message}`);
      }
    }),

  /**
   * Release a device from its assigned account
   */
  releaseDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await releaseDevice(input.deviceId);
        return { success: true };
      } catch (error: any) {
        console.error("[Device] Failed to release device:", error);
        throw new Error(`Failed to release device: ${error.message}`);
      }
    }),

  /**
   * Rotate device for an account (get a new device)
   */
  rotateDevice: protectedProcedure
    .input(z.object({
      accountId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await rotateDeviceForAccount(input.accountId);
        return result;
      } catch (error: any) {
        console.error("[Device] Failed to rotate device:", error);
        throw new Error(`Failed to rotate device: ${error.message}`);
      }
    }),

  /**
   * Auto-assign devices to accounts that don't have one
   */
  autoAssignDevices: protectedProcedure
    .mutation(async () => {
      try {
        const result = await autoAssignDevicesToAccounts();
        return result;
      } catch (error: any) {
        console.error("[Device] Failed to auto-assign devices:", error);
        throw new Error(`Failed to auto-assign devices: ${error.message}`);
      }
    }),

  /**
   * Cleanup stale device assignments
   */
  cleanupAssignments: protectedProcedure
    .mutation(async () => {
      try {
        const cleaned = await cleanupStaleAssignments();
        return { cleaned };
      } catch (error: any) {
        console.error("[Device] Failed to cleanup assignments:", error);
        throw new Error(`Failed to cleanup: ${error.message}`);
      }
    }),

  /**
   * Get a specific device by ID
   */
  getDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const device = await getDeviceById(input.deviceId);
        if (!device) {
          throw new Error("Device not found");
        }

        // Get assigned account if any
        const assignedAccount = await db.select({
          id: accounts.id,
          username: accounts.username,
          platform: accounts.platform,
        })
        .from(accounts)
        .where(eq(accounts.deviceId, input.deviceId))
        .limit(1);

        return {
          ...device,
          assignedAccount: assignedAccount[0] || null,
        };
      } catch (error: any) {
        console.error("[Device] Failed to get device:", error);
        throw new Error(`Failed to get device: ${error.message}`);
      }
    }),

  /**
   * Get pool statistics only
   */
  getPoolStats: protectedProcedure
    .query(async () => {
      try {
        return await getDevicePoolStats();
      } catch (error: any) {
        console.error("[Device] Failed to get pool stats:", error);
        throw new Error(`Failed to get stats: ${error.message}`);
      }
    }),
});
