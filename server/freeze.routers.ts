/**
 * Freeze Detection & Auto-Response tRPC Routers
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { freezeDetections, autoResponses } from "../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { detectFreeze, handleFreeze } from "./freeze-detection";
import { TRPCError } from "@trpc/server";

export const freezeRouter = router({
  /**
   * Get all freeze detections
   */
  getAll: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.accountId) {
        conditions.push(eq(freezeDetections.accountId, input.accountId));
      }

      const detections = await db.query.freezeDetections.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(freezeDetections.createdAt)],
        limit: input.limit,
      });

      return detections;
    }),

  /**
   * Get freeze detection by ID with auto-responses
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const detection = await db.query.freezeDetections.findFirst({
        where: eq(freezeDetections.id, input.id),
      });

      if (!detection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Freeze detection not found",
        });
      }

      const responses = await db.query.autoResponses.findMany({
        where: eq(autoResponses.freezeDetectionId, input.id),
        orderBy: [desc(autoResponses.createdAt)],
      });

      return { detection, responses };
    }),

  /**
   * Manually trigger freeze detection
   */
  detect: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        deviceId: z.string().nullable(),
        errorMessage: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await detectFreeze(
        input.accountId,
        input.deviceId,
        input.errorMessage
      );

      return result;
    }),

  /**
   * Manually trigger auto-response
   */
  handleFreeze: protectedProcedure
    .input(
      z.object({
        freezeDetectionId: z.number(),
        accountId: z.number(),
        deviceId: z.string().nullable(),
        action: z.enum(["change_ip", "switch_device", "pause_account"]),
      })
    )
    .mutation(async ({ input }) => {
      const result = await handleFreeze(
        input.freezeDetectionId,
        input.accountId,
        input.deviceId,
        input.action
      );

      return result;
    }),

  /**
   * Get freeze statistics
   */
  getStats: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const conditions = [gte(freezeDetections.createdAt, startDate)];
      if (input.accountId) {
        conditions.push(eq(freezeDetections.accountId, input.accountId));
      }

      const detections = await db.query.freezeDetections.findMany({
        where: and(...conditions),
      });

      const total = detections.length;
      const byType = {
        ip_block: detections.filter((d) => d.freezeType === "ip_block").length,
        device_block: detections.filter((d) => d.freezeType === "device_block").length,
        account_freeze: detections.filter((d) => d.freezeType === "account_freeze").length,
        unknown: detections.filter((d) => d.freezeType === "unknown").length,
      };
      const byStatus = {
        detected: detections.filter((d) => d.status === "detected").length,
        handling: detections.filter((d) => d.status === "handling").length,
        resolved: detections.filter((d) => d.status === "resolved").length,
        failed: detections.filter((d) => d.status === "failed").length,
      };

      const resolveRate =
        total > 0 ? Math.round((byStatus.resolved / total) * 100) : 0;

      return {
        total,
        byType,
        byStatus,
        resolveRate,
      };
    }),

  /**
   * Get auto-response statistics
   */
  getResponseStats: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const conditions = [gte(autoResponses.createdAt, startDate)];
      if (input.accountId) {
        conditions.push(eq(autoResponses.accountId, input.accountId));
      }

      const responses = await db.query.autoResponses.findMany({
        where: and(...conditions),
      });

      const total = responses.length;
      const byAction = {
        change_ip: responses.filter((r) => r.actionType === "change_ip").length,
        switch_device: responses.filter((r) => r.actionType === "switch_device").length,
        pause_account: responses.filter((r) => r.actionType === "pause_account").length,
        retry: responses.filter((r) => r.actionType === "retry").length,
      };
      const byStatus = {
        pending: responses.filter((r) => r.status === "pending").length,
        success: responses.filter((r) => r.status === "success").length,
        failed: responses.filter((r) => r.status === "failed").length,
      };

      const successRate =
        total > 0 ? Math.round((byStatus.success / total) * 100) : 0;

      return {
        total,
        byAction,
        byStatus,
        successRate,
      };
    }),
});
