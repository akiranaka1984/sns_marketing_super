/**
 * ADBKeyboard Installation Routes
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from './_core/trpc';
import {
  installADBKeyboard,
  isADBKeyboardInstalled,
  getADBKeyboardStatus,
} from './adbkeyboard-installer';

export const adbkeyboardRouter = router({
  /**
   * Check if ADBKeyboard is installed on a device
   */
  checkInstallation: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .query(async ({ input }) => {
      const installed = await isADBKeyboardInstalled(input.deviceId);
      return { installed };
    }),

  /**
   * Get ADBKeyboard status (installed + enabled)
   */
  getStatus: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .query(async ({ input }) => {
      const status = await getADBKeyboardStatus(input.deviceId);
      return status;
    }),

  /**
   * Install ADBKeyboard on a device
   */
  install: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await installADBKeyboard(input.deviceId);
      return result;
    }),
});
