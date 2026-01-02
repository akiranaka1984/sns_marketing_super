/**
 * Device Monitor Router
 * API endpoints for device monitoring and alert management
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import {
  runMonitoringCycle,
  getMonitoringDashboard,
  getAlertHistory,
  acknowledgeAlert,
  resolveAlert,
  getOrCreateAlertSettings,
  updateAlertSettings,
} from "./device-monitor";

export const deviceMonitorRouter = router({
  // Run a monitoring cycle manually
  runMonitoringCycle: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await runMonitoringCycle(ctx.user.id);
    return result;
  }),

  // Get monitoring dashboard data
  getDashboard: protectedProcedure.query(async () => {
    return getMonitoringDashboard();
  }),

  // Get alert history
  getAlertHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input || {};
      return getAlertHistory(ctx.user.id, limit, offset);
    }),

  // Acknowledge an alert
  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input }) => {
      await acknowledgeAlert(input.alertId);
      return { success: true };
    }),

  // Resolve an alert
  resolveAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input }) => {
      await resolveAlert(input.alertId);
      return { success: true };
    }),

  // Get alert settings
  getAlertSettings: protectedProcedure.query(async ({ ctx }) => {
    return getOrCreateAlertSettings(ctx.user.id);
  }),

  // Update alert settings
  updateAlertSettings: protectedProcedure
    .input(
      z.object({
        alertType: z.string(),
        isEnabled: z.boolean().optional(),
        threshold: z.number().min(1).max(100).optional(),
        cooldownMinutes: z.number().min(1).max(1440).optional(),
        notifyOwner: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { alertType, ...settings } = input;
      await updateAlertSettings(ctx.user.id, alertType, settings);
      return { success: true };
    }),
});
