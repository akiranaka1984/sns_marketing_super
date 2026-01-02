import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { collectAccountData, collectAllAccountsData } from "./dataCollection";
import { publishPost, schedulePostsForAllAccounts } from "./postAutomation";
import { checkAccountAlerts, checkAllAccountsAlerts } from "./alertSystem";
import { listDevices, getDevice } from "./duoplus";

/**
 * Automation Routers
 * tRPC endpoints for data collection, post automation, and alert system
 */

export const automationRouter = router({
  /**
   * Data Collection Endpoints
   */
  dataCollection: router({
    // Collect data for a single account
    collectAccount: protectedProcedure
      .input(z.object({
        accountId: z.string(),
        deviceId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const success = await collectAccountData(input.accountId, input.deviceId);
        return { success };
      }),

    // Collect data for all active accounts
    collectAll: protectedProcedure
      .mutation(async () => {
        await collectAllAccountsData();
        return { success: true };
      }),
  }),

  /**
   * Post Automation Endpoints
   */
  postAutomation: router({
    // Publish a post to a specific account
    publishPost: protectedProcedure
      .input(z.object({
        accountId: z.string(),
        deviceId: z.string(),
        topic: z.string(),
        strategy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const success = await publishPost(
          input.accountId,
          input.deviceId,
          input.topic,
          input.strategy
        );
        return { success };
      }),

    // Schedule posts for all active accounts
    scheduleAll: protectedProcedure
      .mutation(async () => {
        await schedulePostsForAllAccounts();
        return { success: true };
      }),
  }),

  /**
   * Alert System Endpoints
   */
  alerts: router({
    // Check alerts for a single account
    checkAccount: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        thresholds: z.object({
          followerDropPercentage: z.number().optional(),
          engagementDropPercentage: z.number().optional(),
          checkIntervalHours: z.number().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        await checkAccountAlerts(input.accountId, input.thresholds as any);
        return { success: true };
      }),

    // Check alerts for all active accounts
    checkAll: protectedProcedure
      .input(z.object({
        thresholds: z.object({
          followerDropPercentage: z.number().optional(),
          engagementDropPercentage: z.number().optional(),
          checkIntervalHours: z.number().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        await checkAllAccountsAlerts(input.thresholds as any);
        return { success: true };
      }),
  }),

  /**
   * DuoPlus Device Management Endpoints
   */
  devices: router({
    // List all available devices
    list: protectedProcedure
      .query(async () => {
        const devices = await listDevices();
        return devices;
      }),

    // Get device by ID
    getById: protectedProcedure
      .input(z.object({
        deviceId: z.string(),
      }))
      .query(async ({ input }) => {
        const device = await getDevice(input.deviceId);
        return device;
      }),
  }),
});
