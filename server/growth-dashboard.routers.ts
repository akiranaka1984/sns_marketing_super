/**
 * Growth Dashboard Router
 *
 * システムの動作状況と成果を可視化するためのAPIエンドポイント
 */

import { router, protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import { db } from './db';
import {
  growthLoopState,
  growthLoopActions,
  projectKpiTracking,
  accountHealth,
  contentCalendar,
  trackedTrends,
  campaigns,
  conversionEvents,
  projects,
  agents,
  accounts,
  posts,
  postAnalytics,
  scheduledPosts,
} from '../drizzle/schema';
import { eq, and, gte, desc, sql, count, lte } from 'drizzle-orm';

export const growthDashboardRouter = router({
  /**
   * Get KPI summary for a project - real-time metrics
   */
  getKPISummary: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const { projectId } = input;

      // Get KPI tracking records
      const kpis = await db.query.projectKpiTracking.findMany({
        where: eq(projectKpiTracking.projectId, projectId),
        orderBy: [desc(projectKpiTracking.updatedAt)],
      });

      // Get recent post stats (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const recentPosts = await db
        .select({
          totalPosts: count(),
          avgLikes: sql<number>`COALESCE(AVG(${posts.likesCount}), 0)`,
          avgComments: sql<number>`COALESCE(AVG(${posts.commentsCount}), 0)`,
          avgShares: sql<number>`COALESCE(AVG(${posts.sharesCount}), 0)`,
        })
        .from(posts)
        .where(
          and(
            eq(posts.projectId, projectId),
            eq(posts.status, 'published'),
            gte(posts.publishedAt, weekAgo.toISOString())
          )
        );

      // Get total scheduled posts
      const pendingPosts = await db
        .select({ count: count() })
        .from(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.projectId, projectId),
            eq(scheduledPosts.status, 'pending')
          )
        );

      return {
        kpis: kpis.map(kpi => ({
          metricType: kpi.metricType,
          targetValue: Number(kpi.targetValue) || 0,
          currentValue: Number(kpi.currentValue) || 0,
          progressPercentage: Number(kpi.progressPercentage) || 0,
          onTrack: kpi.onTrack === 1,
        })),
        recentStats: {
          totalPosts: recentPosts[0]?.totalPosts || 0,
          avgLikes: Math.round(Number(recentPosts[0]?.avgLikes) || 0),
          avgComments: Math.round(Number(recentPosts[0]?.avgComments) || 0),
          avgShares: Math.round(Number(recentPosts[0]?.avgShares) || 0),
        },
        pendingPostsCount: pendingPosts[0]?.count || 0,
      };
    }),

  /**
   * Get growth loop status - is the loop running, recent actions, next action
   */
  getGrowthLoopStatus: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const { projectId } = input;

      // Get loop state
      const state = await db.query.growthLoopState.findFirst({
        where: eq(growthLoopState.projectId, projectId),
      });

      // Get recent actions (last 20)
      const recentActions = await db.query.growthLoopActions.findMany({
        where: eq(growthLoopActions.projectId, projectId),
        orderBy: [desc(growthLoopActions.createdAt)],
        limit: 20,
      });

      // Get pending actions count
      const pendingActions = await db
        .select({ count: count() })
        .from(growthLoopActions)
        .where(
          and(
            eq(growthLoopActions.projectId, projectId),
            eq(growthLoopActions.status, 'pending')
          )
        );

      return {
        isRunning: state?.isRunning === 1,
        lastKpiCheck: state?.lastKpiCheckAt || null,
        lastStrategyEvaluation: state?.lastStrategyEvaluationAt || null,
        lastFullReview: state?.lastFullReviewAt || null,
        currentStrategyScore: state?.currentStrategyScore || 0,
        consecutiveDeclines: state?.consecutiveDeclines || 0,
        escalationNeeded: state?.escalationNeeded === 1,
        escalationReason: state?.escalationReason || null,
        recentActions: recentActions.map(a => ({
          id: a.id,
          actionType: a.actionType,
          description: a.description,
          status: a.status,
          executionMode: a.executionMode,
          createdAt: a.createdAt,
          executedAt: a.executedAt,
        })),
        pendingActionsCount: pendingActions[0]?.count || 0,
      };
    }),

  /**
   * Approve or reject a pending growth loop action
   */
  reviewAction: protectedProcedure
    .input(z.object({
      actionId: z.number(),
      approved: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const { actionId, approved } = input;

      await db.update(growthLoopActions)
        .set({
          status: approved ? 'approved' : 'rejected',
          approvedAt: approved ? new Date().toISOString() : undefined,
        })
        .where(eq(growthLoopActions.id, actionId));

      return { success: true };
    }),

  /**
   * Get ROI metrics per campaign
   */
  getROIMetrics: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const { projectId } = input;

      const projectCampaigns = await db.query.campaigns.findMany({
        where: eq(campaigns.projectId, projectId),
        orderBy: [desc(campaigns.updatedAt)],
      });

      return projectCampaigns.map(c => ({
        id: c.id,
        name: c.name,
        goal: c.goal,
        status: c.status,
        budget: Number(c.budget) || 0,
        revenue: Number(c.revenue) || 0,
        roi: Number(c.roi) || 0,
        startDate: c.startDate,
        endDate: c.endDate,
      }));
    }),

  /**
   * Get account health overview
   */
  getAccountHealthOverview: protectedProcedure
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;

      // Get all accounts for user
      const userAccounts = userId
        ? await db.query.accounts.findMany({
            where: eq(accounts.userId, userId),
          })
        : [];

      const accountIds = userAccounts.map(a => a.id);
      if (accountIds.length === 0) return [];

      // Get health records
      const healthRecords = await db.query.accountHealth.findMany();

      // Map health to accounts
      return userAccounts.map(account => {
        const health = healthRecords.find(h => h.accountId === account.id);
        return {
          accountId: account.id,
          username: account.username,
          platform: account.platform,
          status: account.status,
          healthScore: health?.healthScore ?? null,
          accountPhase: health?.accountPhase ?? 'unknown',
          isThrottled: health?.isThrottled === 1,
          isSuspended: health?.isSuspended === 1,
          maxDailyPosts: health?.maxDailyPosts ?? 0,
          postsToday: health?.postsToday ?? 0,
          actionsToday: health?.actionsToday ?? 0,
          consecutiveFailures: health?.consecutiveFailures ?? 0,
          lastActionAt: health?.lastActionAt ?? null,
        };
      });
    }),

  /**
   * Get active trends
   */
  getActiveTrends: protectedProcedure
    .input(z.object({ projectId: z.number().optional() }).optional())
    .query(async ({ ctx }) => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const trends = await db.query.trackedTrends.findMany({
        where: and(
          gte(trackedTrends.detectedAt, dayAgo.toISOString()),
        ),
        orderBy: [desc(trackedTrends.relevanceScore)],
        limit: 20,
      });

      return trends.map(t => ({
        id: t.id,
        trendName: t.trendName,
        trendType: t.trendType,
        platform: t.platform,
        relevanceScore: t.relevanceScore,
        trendingScore: t.trendingScore,
        status: t.status,
        detectedAt: t.detectedAt,
      }));
    }),

  /**
   * Get content calendar preview (next 7 days)
   */
  getCalendarPreview: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const { projectId } = input;
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const entries = await db.query.contentCalendar.findMany({
        where: and(
          eq(contentCalendar.projectId, projectId),
          gte(contentCalendar.scheduledDate, now.toISOString()),
          lte(contentCalendar.scheduledDate, weekLater.toISOString())
        ),
        orderBy: [contentCalendar.scheduledDate],
      });

      return entries.map(e => ({
        id: e.id,
        scheduledDate: e.scheduledDate,
        timeSlot: e.timeSlot,
        contentType: e.contentType,
        topic: e.topic,
        status: e.status,
      }));
    }),

  /**
   * Generate AI report (summary of recent performance)
   */
  generateReport: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
    }))
    .query(async ({ input }) => {
      const { projectId, period } = input;

      const daysBack = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Gather metrics
      const publishedPosts = await db
        .select({
          totalPosts: count(),
          avgLikes: sql<number>`COALESCE(AVG(${posts.likesCount}), 0)`,
          avgComments: sql<number>`COALESCE(AVG(${posts.commentsCount}), 0)`,
          totalLikes: sql<number>`COALESCE(SUM(${posts.likesCount}), 0)`,
          totalComments: sql<number>`COALESCE(SUM(${posts.commentsCount}), 0)`,
          totalShares: sql<number>`COALESCE(SUM(${posts.sharesCount}), 0)`,
        })
        .from(posts)
        .where(
          and(
            eq(posts.projectId, projectId),
            eq(posts.status, 'published'),
            gte(posts.publishedAt, startDate.toISOString())
          )
        );

      // Growth loop actions in period
      const loopActions = await db
        .select({ count: count() })
        .from(growthLoopActions)
        .where(
          and(
            eq(growthLoopActions.projectId, projectId),
            gte(growthLoopActions.createdAt, startDate.toISOString())
          )
        );

      const stats = publishedPosts[0] || { totalPosts: 0, avgLikes: 0, avgComments: 0, totalLikes: 0, totalComments: 0, totalShares: 0 };

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        metrics: {
          totalPosts: stats.totalPosts,
          avgLikes: Math.round(Number(stats.avgLikes)),
          avgComments: Math.round(Number(stats.avgComments)),
          totalEngagement: Number(stats.totalLikes) + Number(stats.totalComments) + Number(stats.totalShares),
        },
        automationActions: loopActions[0]?.count || 0,
      };
    }),
});
