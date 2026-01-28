/**
 * KPI Tracking Router
 *
 * Provides APIs for tracking and managing project KPIs
 * - Set KPI targets
 * - Update progress (for scheduled execution)
 * - Get dashboard data
 * - Get history
 */

import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import {
  projectKpiTracking,
  projects,
  posts,
  postAnalytics,
  accounts,
  projectAccounts,
  analytics,
} from "../drizzle/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";

// Valid metric types
const metricTypes = [
  'followers',
  'engagement_rate',
  'impressions',
  'clicks',
  'conversions',
  'posts_count',
  'avg_likes',
] as const;

type MetricType = typeof metricTypes[number];

// KPI target input schema
const kpiTargetSchema = z.object({
  metricType: z.enum(metricTypes),
  targetValue: z.number().min(0),
  targetDeadline: z.string().datetime().optional(),
});

export const kpiTrackingRouter = router({
  /**
   * Set KPI targets for a project
   */
  setTargets: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        targets: z.array(kpiTargetSchema),
      })
    )
    .mutation(async ({ input }) => {
      const { projectId, targets } = input;

      // Verify project exists
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        throw new Error("Project not found");
      }

      const results = [];

      for (const target of targets) {
        // Check if a target for this metric already exists
        const existing = await db.query.projectKpiTracking.findFirst({
          where: and(
            eq(projectKpiTracking.projectId, projectId),
            eq(projectKpiTracking.metricType, target.metricType)
          ),
        });

        if (existing) {
          // Update existing target
          await db
            .update(projectKpiTracking)
            .set({
              targetValue: target.targetValue.toString(),
              targetDeadline: target.targetDeadline || null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(projectKpiTracking.id, existing.id));

          results.push({ ...existing, updated: true });
        } else {
          // Insert new target
          const [inserted] = await db.insert(projectKpiTracking).values({
            projectId,
            metricType: target.metricType,
            targetValue: target.targetValue.toString(),
            targetDeadline: target.targetDeadline || null,
            currentValue: "0",
            progressPercentage: "0",
          });

          results.push({ id: inserted.insertId, created: true });
        }
      }

      return { success: true, results };
    }),

  /**
   * Update KPI progress for a project (typically called by scheduler)
   */
  updateProgress: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { projectId } = input;

      // Get all KPI targets for this project
      const kpiTargets = await db.query.projectKpiTracking.findMany({
        where: eq(projectKpiTracking.projectId, projectId),
      });

      if (kpiTargets.length === 0) {
        return { success: true, message: "No KPI targets found" };
      }

      // Get project's accounts through the junction table
      const projectAccountLinks = await db.query.projectAccounts.findMany({
        where: and(
          eq(projectAccounts.projectId, projectId),
          eq(projectAccounts.isActive, 1)
        ),
      });

      const accountIds = projectAccountLinks.map((pa) => pa.accountId);

      // Get full account data
      let projectAccountsData: (typeof accounts.$inferSelect)[] = [];
      if (accountIds.length > 0) {
        projectAccountsData = await db.query.accounts.findMany({
          where: sql`${accounts.id} IN (${accountIds.join(",")})`,
        });
      }

      // Calculate current metrics
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get recent posts for this project
      const recentPosts = await db.query.posts.findMany({
        where: and(
          eq(posts.projectId, projectId),
          eq(posts.status, "published"),
          gte(posts.publishedAt, thirtyDaysAgo.toISOString())
        ),
      });

      const postIds = recentPosts.map((p) => p.id);

      // Get analytics for recent posts
      let postAnalyticsData: any[] = [];
      if (postIds.length > 0) {
        postAnalyticsData = await db.query.postAnalytics.findMany({
          where: sql`${postAnalytics.postId} IN (${postIds.length > 0 ? postIds.join(",") : "0"})`,
          orderBy: desc(postAnalytics.recordedAt),
        });
      }

      // Calculate metrics
      // Get followers count from latest account-level analytics for each account
      let totalFollowers = 0;
      for (const account of projectAccountsData) {
        const latestAnalytic = await db.query.analytics.findFirst({
          where: eq(analytics.accountId, account.id),
          orderBy: desc(analytics.recordedAt),
        });
        if (latestAnalytic) {
          totalFollowers += latestAnalytic.followersCount || 0;
        }
      }
      const totalPosts = recentPosts.length;
      const totalLikes = postAnalyticsData.reduce(
        (sum, a) => sum + (a.likesCount || 0),
        0
      );
      const totalImpressions = postAnalyticsData.reduce(
        (sum, a) => sum + (a.viewsCount || 0),
        0
      );
      const avgLikes = totalPosts > 0 ? totalLikes / totalPosts : 0;
      const avgEngagement =
        totalImpressions > 0 ? (totalLikes / totalImpressions) * 100 : 0;

      // Update each KPI target
      const updates = [];
      for (const kpi of kpiTargets) {
        let currentValue = 0;

        switch (kpi.metricType) {
          case "followers":
            currentValue = totalFollowers;
            break;
          case "posts_count":
            currentValue = totalPosts;
            break;
          case "avg_likes":
            currentValue = avgLikes;
            break;
          case "impressions":
            currentValue = totalImpressions;
            break;
          case "engagement_rate":
            currentValue = avgEngagement;
            break;
          case "clicks":
            // Would need click tracking implementation
            currentValue = 0;
            break;
          case "conversions":
            // Would need conversion tracking implementation
            currentValue = 0;
            break;
        }

        const targetValue = parseFloat(kpi.targetValue || "0");
        const progressPercentage =
          targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;

        // Check if on track based on deadline
        let onTrack = true;
        if (kpi.targetDeadline) {
          const deadlineDate = new Date(kpi.targetDeadline);
          const totalDays =
            (deadlineDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
          if (totalDays > 0) {
            // Calculate expected progress based on time elapsed
            const daysSinceStart = 30; // Assume 30 days tracking window
            const expectedProgress = Math.min(
              100,
              ((daysSinceStart - totalDays) / daysSinceStart) * 100
            );
            onTrack = progressPercentage >= expectedProgress * 0.8; // Within 80% of expected
          }
        }

        // Update value history
        let valueHistory: { date: string; value: number }[] = [];
        if (kpi.valueHistory) {
          try {
            valueHistory = JSON.parse(kpi.valueHistory);
          } catch (e) {
            valueHistory = [];
          }
        }
        valueHistory.push({
          date: now.toISOString(),
          value: currentValue,
        });
        // Keep only last 90 entries
        if (valueHistory.length > 90) {
          valueHistory = valueHistory.slice(-90);
        }

        await db
          .update(projectKpiTracking)
          .set({
            currentValue: currentValue.toString(),
            progressPercentage: progressPercentage.toFixed(2),
            onTrack: onTrack ? 1 : 0,
            valueHistory: JSON.stringify(valueHistory),
            recordedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          })
          .where(eq(projectKpiTracking.id, kpi.id));

        updates.push({
          metricType: kpi.metricType,
          currentValue,
          targetValue,
          progressPercentage: progressPercentage.toFixed(2),
          onTrack,
        });
      }

      return { success: true, updates };
    }),

  /**
   * Get KPI dashboard data for a project
   */
  getDashboard: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const { projectId } = input;

      // Get all KPI targets for this project
      const kpiTargets = await db.query.projectKpiTracking.findMany({
        where: eq(projectKpiTracking.projectId, projectId),
        orderBy: desc(projectKpiTracking.updatedAt),
      });

      // Format for dashboard display
      const dashboard = kpiTargets.map((kpi) => {
        let valueHistory: { date: string; value: number }[] = [];
        if (kpi.valueHistory) {
          try {
            valueHistory = JSON.parse(kpi.valueHistory);
          } catch (e) {
            valueHistory = [];
          }
        }

        const targetValue = parseFloat(kpi.targetValue || "0");
        const currentValue = parseFloat(kpi.currentValue || "0");
        const progressPercentage = parseFloat(kpi.progressPercentage || "0");

        // Calculate projected value based on trend
        let projectedValue = currentValue;
        if (valueHistory.length >= 2 && kpi.targetDeadline) {
          const recentHistory = valueHistory.slice(-7);
          if (recentHistory.length >= 2) {
            const firstValue = recentHistory[0].value;
            const lastValue = recentHistory[recentHistory.length - 1].value;
            const daysDiff =
              (new Date(recentHistory[recentHistory.length - 1].date).getTime() -
                new Date(recentHistory[0].date).getTime()) /
              (24 * 60 * 60 * 1000);
            if (daysDiff > 0) {
              const dailyGrowth = (lastValue - firstValue) / daysDiff;
              const daysUntilDeadline =
                (new Date(kpi.targetDeadline).getTime() - Date.now()) /
                (24 * 60 * 60 * 1000);
              projectedValue = currentValue + dailyGrowth * daysUntilDeadline;
            }
          }
        }

        return {
          id: kpi.id,
          metricType: kpi.metricType,
          targetValue,
          currentValue,
          progressPercentage,
          projectedValue: Math.max(0, projectedValue),
          onTrack: kpi.onTrack ?? true,
          targetDeadline: kpi.targetDeadline,
          valueHistory: valueHistory.slice(-30), // Last 30 data points
          lastUpdated: kpi.recordedAt || kpi.updatedAt,
        };
      });

      // Calculate overall health score
      const onTrackCount = dashboard.filter((d) => d.onTrack).length;
      const healthScore =
        dashboard.length > 0
          ? Math.round((onTrackCount / dashboard.length) * 100)
          : 100;

      // Get metric labels for display
      const metricLabels: Record<MetricType, string> = {
        followers: "フォロワー数",
        engagement_rate: "エンゲージメント率",
        impressions: "インプレッション数",
        clicks: "クリック数",
        conversions: "コンバージョン数",
        posts_count: "投稿数",
        avg_likes: "平均いいね数",
      };

      return {
        projectId,
        dashboard: dashboard.map((d) => ({
          ...d,
          label: metricLabels[d.metricType as MetricType] || d.metricType,
        })),
        healthScore,
        totalKpis: dashboard.length,
        onTrackKpis: onTrackCount,
      };
    }),

  /**
   * Get KPI history for a specific metric
   */
  getHistory: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        metricType: z.enum(metricTypes),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const { projectId, metricType, days } = input;

      const kpi = await db.query.projectKpiTracking.findFirst({
        where: and(
          eq(projectKpiTracking.projectId, projectId),
          eq(projectKpiTracking.metricType, metricType)
        ),
      });

      if (!kpi) {
        return { history: [], message: "KPI not found" };
      }

      let valueHistory: { date: string; value: number }[] = [];
      if (kpi.valueHistory) {
        try {
          valueHistory = JSON.parse(kpi.valueHistory);
        } catch (e) {
          valueHistory = [];
        }
      }

      // Filter to requested days
      const cutoffDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      ).toISOString();
      const filteredHistory = valueHistory.filter((h) => h.date >= cutoffDate);

      return {
        metricType,
        targetValue: parseFloat(kpi.targetValue || "0"),
        currentValue: parseFloat(kpi.currentValue || "0"),
        progressPercentage: parseFloat(kpi.progressPercentage || "0"),
        history: filteredHistory,
      };
    }),

  /**
   * Delete a KPI target
   */
  deleteTarget: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        metricType: z.enum(metricTypes),
      })
    )
    .mutation(async ({ input }) => {
      const { projectId, metricType } = input;

      const result = await db
        .delete(projectKpiTracking)
        .where(
          and(
            eq(projectKpiTracking.projectId, projectId),
            eq(projectKpiTracking.metricType, metricType)
          )
        );

      return { success: true, deleted: true };
    }),
});
