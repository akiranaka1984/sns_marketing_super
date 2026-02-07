/**
 * Playwright Session Management Router
 *
 * Provides tRPC endpoints for managing Playwright browser sessions:
 * - Login to X.com
 * - Check session health
 * - Delete session
 * - Update posting method for an account
 */

import { z } from 'zod';
import { router } from './_core/trpc';
import { protectedProcedure } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import * as dbModule from './db';
import { db as drizzleDb } from './db';
import { proxies } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  loginToX,
  checkSessionHealth,
  deleteSession,
  acquireContext,
  releaseContext,
  startScreencast,
  stopScreencast,
  setOperationStatus,
} from './playwright';

export const playwrightSessionRouter = router({
  /**
   * Login to X.com for an account using Playwright.
   * Establishes a browser session and persists cookies.
   */
  login: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await dbModule.getAccountById(input.accountId);
      if (!account || account.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or unauthorized',
        });
      }

      // Build proxy config if account has proxy
      let proxyConfig: { server: string; username?: string; password?: string } | undefined;
      if (account.proxyId) {
        const proxy = await drizzleDb.query.proxies.findFirst({
          where: eq(proxies.id, account.proxyId),
        });
        if (proxy) {
          proxyConfig = {
            server: `http://${proxy.host}:${proxy.port}`,
            username: proxy.username,
            password: proxy.password,
          };
        }
      }

      const result = await loginToX(
        account.id,
        account.username,
        account.password,
        proxyConfig
      );

      return result;
    }),

  /**
   * Check session health for an account.
   * Verifies if the stored session is still valid.
   */
  checkHealth: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await dbModule.getAccountById(input.accountId);
      if (!account || account.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or unauthorized',
        });
      }

      return await checkSessionHealth(input.accountId);
    }),

  /**
   * Delete stored session for an account.
   */
  deleteSession: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await dbModule.getAccountById(input.accountId);
      if (!account || account.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or unauthorized',
        });
      }

      await deleteSession(input.accountId);
      return { success: true };
    }),

  /**
   * Test preview: opens example.com with screencast for 5 seconds.
   * No X.com login required - useful for verifying live preview functionality.
   */
  testPreview: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await dbModule.getAccountById(input.accountId);
      if (!account || account.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or unauthorized',
        });
      }

      const context = await acquireContext(input.accountId);
      const page = await context.newPage();
      try {
        await startScreencast(input.accountId, page);
        setOperationStatus(input.accountId, 'test', 'connecting');
        // Wait for WebSocket clients to connect before navigating
        await page.waitForTimeout(1500);
        setOperationStatus(input.accountId, 'test', 'loading_page');
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        setOperationStatus(input.accountId, 'test', 'previewing');
        await page.waitForTimeout(5000);
        setOperationStatus(input.accountId, 'test', 'done');
      } finally {
        await stopScreencast(input.accountId);
        await page.close();
        // Don't call releaseContext — keep the context alive for reuse
        // and avoid destroying an existing X.com login session
      }

      return { success: true };
    }),

  /**
   * Get session status for an account.
   */
  getStatus: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const account = await dbModule.getAccountById(input.accountId);
      if (!account || account.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or unauthorized',
        });
      }

      return {
        postingMethod: (account as any).postingMethod || 'playwright',
        sessionStatus: (account as any).sessionStatus || 'needs_login',
      };
    }),
});
