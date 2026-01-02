import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { registerAccountWithRetry } from "./accountRegistration";
import { generateStrategy } from "./aiEngine";
import { automationRouter } from "./automation.routers";
import { automationRouter as newAutomationRouter } from "./routers/automation";
import { settingsRouter } from "./settings.routers";
import { projectsRouter } from "./projects.routers";
import { proxyRouter } from "./proxy.routers";
import { deviceRouter } from "./device.routers";
import { findDeviceIdByAccountName } from "./duoplus-proxy";
import { freezeRouter } from "./freeze.routers";
import { scheduledPostsRouter } from "./scheduled-posts.routers";
import { engagementRouter } from "./engagement.routers";
import { analyticsRouter } from "./analytics.routers";
import { agentsRouter } from "./agents.routers";
import { contentCollectionRouter } from "./content-collection.routers";
import { contentRewriteRouter } from "./content-rewrite.routers";
import { contentReviewRouter } from "./content-review.routers";
import { weeklyReviewRouter } from "./weekly-review.routers";
import { aiOptimizationRouter } from "./ai-optimization.routers";
import { tenantRouter } from "./tenant.routers";
import { autoContentGenerationRouter } from "./auto-content-generation.routers";
import { engagementCollectorRouter } from "./engagement-collector.routers";
import { abTestingRouter } from "./ab-testing.routers";
import { agentScheduledPostsRouter } from "./agent-scheduled-posts.routers";
import { deviceMonitorRouter } from "./device-monitor.routers";
import { debugRouter } from "./debug.routers";
import { proxyHealthRouter } from "./proxy-health.routers";
import { xWebRouter } from './x-web.routers';
import { xWebCoordinateRouter } from './x-web-coordinate.routers';
import { adbkeyboardRouter } from './adbkeyboard.routers';
import { xApiSettingsRouter } from './x-api-settings.routers';
import { interactionsRouter } from './interactions.routers';
import { interactionSettingsRouter } from './interaction-settings.routers';
import { schedulerRouter } from './scheduler.routers';
import { startScheduler, stopScheduler, isSchedulerRunning, getAllScheduledExecutions, checkAndRunScheduledAgents } from "./agent-scheduler";

export const appRouter = router({
  system: systemRouter,
  automation: automationRouter,
  newAutomation: newAutomationRouter,
  settings: settingsRouter,
  projects: projectsRouter,
  proxy: proxyRouter,
  device: deviceRouter,
  freeze: freezeRouter,
  scheduledPosts: scheduledPostsRouter,
  engagement: engagementRouter,
  analytics: analyticsRouter,
  agents: agentsRouter,
  contentCollection: contentCollectionRouter,
  contentRewrite: contentRewriteRouter,
  contentReview: contentReviewRouter,
  weeklyReview: weeklyReviewRouter,
  aiOptimization: aiOptimizationRouter,
  tenant: tenantRouter,
  autoContentGeneration: autoContentGenerationRouter,
  engagementCollector: engagementCollectorRouter,
  abTesting: abTestingRouter,
  agentScheduledPosts: agentScheduledPostsRouter,
  deviceMonitor: deviceMonitorRouter,
  debug: debugRouter,
  proxyHealth: proxyHealthRouter,
  xWeb: xWebRouter,
  xWebCoordinate: xWebCoordinateRouter,
  adbkeyboard: adbkeyboardRouter,
  xApiSettings: xApiSettingsRouter,
  interactions: interactionsRouter,
  interactionSettings: interactionSettingsRouter,
  scheduler: schedulerRouter,

  // Agent Scheduler endpoints
  agentScheduler: router({
    // Get scheduler status
    status: protectedProcedure.query(async () => {
      return {
        running: isSchedulerRunning(),
        scheduledExecutions: await getAllScheduledExecutions(),
      };
    }),

    // Start scheduler
    start: protectedProcedure.mutation(async () => {
      startScheduler();
      return { success: true, running: true };
    }),

    // Stop scheduler
    stop: protectedProcedure.mutation(async () => {
      stopScheduler();
      return { success: true, running: false };
    }),

    // Run scheduled agents manually
    runNow: protectedProcedure.mutation(async () => {
      const result = await checkAndRunScheduledAgents();
      return result;
    }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  accounts: router({
    // List all accounts for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAccountsByUserId(ctx.user.id);
    }),

    // Get account by ID
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.id);
        if (!account || account.userId !== ctx.user.id) {
          return null;
        }
        return account;
      }),

    // Create a new account
    create: protectedProcedure
      .input(z.object({
        platform: z.enum(['twitter', 'tiktok', 'instagram', 'facebook']),
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if account with same username and platform already exists for this user
        const existingAccount = await db.getAccountByUsernameAndPlatform(
          input.username,
          input.platform,
          ctx.user.id
        );
        
        if (existingAccount) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `An account with username "${input.username}" already exists for ${input.platform}. Please use a different username or update the existing account.`,
            cause: { accountId: existingAccount.id }
          });
        }

        const insertId = await db.createAccount({
          userId: ctx.user.id,
          platform: input.platform,
          username: input.username,
          password: input.password,
          status: 'active', // Changed from 'pending' to 'active' for immediate use
        });

        // Return the account ID for the frontend to use
        return { id: insertId };
      }),

    // Register an account (start the registration process)
    register: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account) {
          throw new Error('Account not found');
        }

        // Get an available device
        const device = await db.getAvailableDevice();
        if (!device) {
          throw new Error('No available devices');
        }

        // Update device status to busy
        await db.updateDeviceStatus(device.deviceId, 'busy');

        try {
          // Start registration process
          const result = await registerAccountWithRetry({
            accountId: account.id,
            deviceId: device.deviceId,
            platform: account.platform,
            username: account.username,
            password: account.password,
          });

          if (result.success) {
            await db.updateAccountStatus(account.id, 'active', device.deviceId);
          } else {
            await db.updateAccountStatus(account.id, 'failed');
          }

          return result;
        } finally {
          // Release device
          await db.updateDeviceStatus(device.deviceId, 'available');
        }
      }),

    // Update account (including xHandle)
    update: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        xHandle: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        const updateData: any = {};
        if (input.xHandle !== undefined) {
          updateData.xHandle = input.xHandle;
        }

        await db.updateAccount(input.accountId, updateData);
        return { success: true };
      }),

    // Update account device
    updateDevice: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        deviceId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        await db.updateAccount(input.accountId, { deviceId: input.deviceId });
        return { success: true };
      }),

    // Activate account (change status from pending to active)
    activate: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        await db.updateAccount(input.accountId, { status: 'active' });
        return { success: true };
      }),

    // Batch activate accounts (change all pending accounts to active)
    batchActivate: protectedProcedure
      .mutation(async ({ ctx }) => {
        const accounts = await db.getAllAccounts(ctx.user.id);
        const pendingAccounts = accounts.filter(acc => acc.status === 'pending');
        
        for (const account of pendingAccounts) {
          await db.updateAccount(account.id, { status: 'active' });
        }

        return { 
          success: true, 
          count: pendingAccounts.length,
          message: `${pendingAccounts.length}件のアカウントをアクティブ化しました`
        };
      }),

    // Delete an account
    delete: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        await db.deleteAccount(input.accountId);
        return { success: true };
      }),

    // Get account details
    get: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        return account;
      }),

    // Link account to device
    linkDevice: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        deviceId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        await db.updateAccountDeviceId(input.accountId, input.deviceId);
        return { success: true };
      }),

    // Unlink account from device
    unlinkDevice: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error('Account not found or unauthorized');
        }

        await db.updateAccountDeviceId(input.accountId, null);
        return { success: true };
      }),

    // Sync device IDs from DuoPlus
    syncDeviceIds: protectedProcedure
      .mutation(async ({ ctx }) => {
        const accounts = await db.getAccountsByUserId(ctx.user.id);
        let synced = 0;
        let failed = 0;
        let skipped = 0;
        const errors: string[] = [];

        console.log(`[Account Sync] Starting sync for ${accounts.length} accounts`);

        for (const account of accounts) {
          // Skip if device ID already exists
          if (account.deviceId) {
            console.log(`[Account Sync] Skipping account ${account.id} (${account.username}) - already has device ID: ${account.deviceId}`);
            skipped++;
            continue;
          }

          try {
            // Try to find device ID by account username
            console.log(`[Account Sync] Searching device ID for account ${account.id} (${account.username})`);
            const deviceId = await findDeviceIdByAccountName(account.username);
            
            if (deviceId) {
              // Update account with device ID
              await db.updateAccountDeviceId(account.id, deviceId);
              console.log(`[Account Sync] Updated device ID for account ${account.id}: ${deviceId}`);
              synced++;
            } else {
              console.log(`[Account Sync] No device found for account ${account.id} (${account.username})`);
              errors.push(`${account.username}: デバイスが見つかりません`);
              failed++;
            }
          } catch (error: any) {
            console.error(`[Account Sync] Error syncing account ${account.id}:`, error.message);
            errors.push(`${account.username}: ${error.message}`);
            failed++;
          }
        }

        console.log(`[Account Sync] Sync completed: ${synced} synced, ${failed} failed, ${skipped} skipped`);

        return {
          success: true,
          message: `同期完了: ${synced}件成功, ${failed}件失敗, ${skipped}件スキップ`,
          synced,
          failed,
          skipped,
          errors,
        };
      }),

    // Assign a device to an account
    assignDevice: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        deviceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          return { success: false, message: 'アカウントが見つかりません' };
        }

        if (account.deviceId) {
          return { success: false, message: 'このアカウントには既にデバイスが割り当てられています' };
        }

        try {
          let deviceIdToAssign: string;

          if (input.deviceId) {
            // Use the specified device ID
            deviceIdToAssign = input.deviceId;
          } else {
            // Get an available device from database
            const device = await db.getAvailableDevice();
            if (!device) {
              return { success: false, message: '利用可能なデバイスがありません。DuoPlusでデバイスを追加してください。' };
            }
            deviceIdToAssign = device.deviceId;
          }

          // Update account with device ID
          await db.updateAccountDeviceId(input.accountId, deviceIdToAssign);

          return {
            success: true,
            message: `デバイス ${deviceIdToAssign} を割り当てました`,
            deviceId: deviceIdToAssign,
          };
        } catch (error: any) {
          console.error('[AssignDevice] Error:', error);
          return { success: false, message: `デバイス割り当てに失敗しました: ${error.message}` };
        }
      }),
  }),

  logs: router({
    // Get logs for a specific account
    byAccount: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getLogsByAccountId(input.accountId);
      }),

    // Get recent logs
    recent: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        return await db.getRecentLogs(input.limit);
      }),
  }),

  strategies: router({
    // List all strategies for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getStrategiesByUserId(ctx.user.id);
    }),

    // Generate a new strategy
    generate: protectedProcedure
      .input(z.object({
        objective: z.string().min(1),
        accountId: z.number().optional(),
        projectId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const strategyData = await generateStrategy(input.objective);

        const strategy = await db.createStrategy({
          userId: ctx.user.id,
          accountId: input.accountId,
          projectId: input.projectId,
          objective: input.objective,
          contentType: strategyData.contentType,
          hashtags: strategyData.hashtags,
          postingSchedule: strategyData.postingSchedule,
          engagementStrategy: strategyData.engagementStrategy,
          generatedContent: strategyData.generatedContent,
        });

        return strategy;
      }),

    // Get strategy details
    get: protectedProcedure
      .input(z.object({
        strategyId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const strategy = await db.getStrategyById(input.strategyId);
        if (!strategy || strategy.userId !== ctx.user.id) {
          throw new Error('Strategy not found or unauthorized');
        }

        return strategy;
      }),
  }),

  devices: router({
    // List all devices
    list: protectedProcedure.query(async () => {
      return await db.getAllDevices();
    }),

    // Get available device count
    availableCount: protectedProcedure.query(async () => {
      const device = await db.getAvailableDevice();
      return device ? 1 : 0;
    }),
  }),

  oldAnalytics: router({
    // Get analytics for a specific account
    byAccount: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        limit: z.number().optional().default(30),
      }))
      .query(async ({ input }) => {
        return await db.getAnalyticsByAccount(input.accountId, input.limit);
      }),

    // Get latest analytics for all accounts
    latest: protectedProcedure.query(async () => {
      return await db.getLatestAnalytics();
    }),

    // Get analytics summary for an account
    summary: protectedProcedure
      .input(z.object({
        accountId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getAnalyticsSummary(input.accountId);
      }),

    // Create analytics record (for testing/manual entry)
    create: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        followersCount: z.number().default(0),
        followingCount: z.number().default(0),
        postsCount: z.number().default(0),
        engagementRate: z.number().default(0),
        likesCount: z.number().default(0),
        commentsCount: z.number().default(0),
        sharesCount: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        return await db.createAnalytics(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
