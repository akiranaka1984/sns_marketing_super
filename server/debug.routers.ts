/**
 * Debug Router
 * Provides debugging endpoints for testing Instagram posting process
 */

import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { debugInstagramPost } from "./debug-instagram-post";
import { debugXWebPost } from "./debug-x-web";

export const debugRouter = router({
  /**
   * Debug Instagram post with step-by-step screenshots
   */
  instagramPost: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().min(1, "Device ID is required"),
        content: z.string().min(1, "Content is required"),
        mediaUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { deviceId, content, mediaUrl } = input;
      
      console.log(`[DebugRouter] Starting debug Instagram post for device: ${deviceId}`);
      
      const result = await debugInstagramPost(deviceId, content, mediaUrl);
      
      console.log(`[DebugRouter] Debug Instagram post completed:`, {
        success: result.success,
        failedAt: result.failedAt,
        stepsCount: result.steps.length,
        deviceResolution: result.deviceResolution,
      });
      
      return result;
    }),

  /**
   * Debug X web posting with step-by-step screenshots
   */
  xWebPost: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().min(1, "Device ID is required"),
        content: z.string().min(1, "Content is required"),
        mediaUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { deviceId, content, mediaUrl } = input;
      
      console.log(`[DebugRouter] Starting debug X web post for device: ${deviceId}`);
      
      const result = await debugXWebPost(deviceId, content, mediaUrl);
      
      console.log(`[DebugRouter] Debug X web post completed:`, {
        success: result.success,
        loginStatus: result.loginStatus,
        screenshotsCount: result.screenshots.length,
      });
      
      return result;
    }),
});
