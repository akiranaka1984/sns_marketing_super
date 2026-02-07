import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { checkAccountAlerts, checkAllAccountsAlerts } from "./alertSystem";

/**
 * Automation Routers
 * tRPC endpoints for alert system
 */

export const automationRouter = router({
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
});
