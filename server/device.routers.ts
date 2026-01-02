import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDeviceStatus } from "./duoplus-proxy";
import { startDevice, stopDevice, restartDevice } from "./device-power";
import { listDevices, updateApp } from "./duoplus";

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
});
