/**
 * Funnel Tracker Service
 *
 * Tracks conversion funnel stages from impression to engagement
 * to follow to conversion. Aggregates data from postAnalytics
 * and engagementLogs into funnelEvents for visualization.
 */

import { db } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, inArray, gte, lte, count } from "drizzle-orm";

const FUNNEL_STAGES = ['impression', 'engagement', 'profile_visit', 'follow', 'conversion'] as const;
type FunnelEventType = typeof FUNNEL_STAGES[number];

/**
 * Record a funnel event
 */
export async function recordFunnelEvent(event: {
  accountId: number;
  projectId?: number;
  eventType: FunnelEventType;
  postId?: number;
  sourceType?: string;
  value?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  await db.insert(schema.funnelEvents).values({
    accountId: event.accountId,
    projectId: event.projectId ?? null,
    eventType: event.eventType,
    postId: event.postId ?? null,
    sourceType: event.sourceType ?? null,
    value: event.value ?? 0,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Aggregate postAnalytics data into funnel events.
 * Called periodically to populate funnel from existing metrics.
 */
export async function aggregatePostAnalyticsToFunnel(
  accountId: number,
  projectId?: number,
  since?: Date
): Promise<{ impressions: number; engagements: number }> {
  const conditions = [eq(schema.postAnalytics.accountId, accountId)];
  if (since) {
    conditions.push(gte(schema.postAnalytics.recordedAt, since.toISOString()));
  }

  const rows = await db
    .select({
      totalImpressions: sql<number>`COALESCE(SUM(${schema.postAnalytics.impressionsCount}), 0)`,
      totalLikes: sql<number>`COALESCE(SUM(${schema.postAnalytics.likesCount}), 0)`,
      totalComments: sql<number>`COALESCE(SUM(${schema.postAnalytics.commentsCount}), 0)`,
      totalShares: sql<number>`COALESCE(SUM(${schema.postAnalytics.sharesCount}), 0)`,
    })
    .from(schema.postAnalytics)
    .where(and(...conditions));

  const row = rows[0];
  const impressions = Number(row?.totalImpressions ?? 0);
  const engagements = Number(row?.totalLikes ?? 0) + Number(row?.totalComments ?? 0) + Number(row?.totalShares ?? 0);

  if (impressions > 0) {
    await recordFunnelEvent({
      accountId,
      projectId,
      eventType: 'impression',
      sourceType: 'post_analytics_aggregation',
      value: impressions,
      metadata: { aggregatedSince: since?.toISOString() ?? null },
    });
  }

  if (engagements > 0) {
    await recordFunnelEvent({
      accountId,
      projectId,
      eventType: 'engagement',
      sourceType: 'post_analytics_aggregation',
      value: engagements,
      metadata: {
        likes: Number(row?.totalLikes ?? 0),
        comments: Number(row?.totalComments ?? 0),
        shares: Number(row?.totalShares ?? 0),
        aggregatedSince: since?.toISOString() ?? null,
      },
    });
  }

  return { impressions, engagements };
}

/**
 * Aggregate engagement logs into funnel (follow events)
 */
export async function aggregateEngagementToFunnel(
  accountId: number,
  projectId?: number,
  since?: Date
): Promise<{ follows: number }> {
  const conditions = [
    eq(schema.engagementLogs.accountId, accountId),
    eq(schema.engagementLogs.taskType, 'follow'),
    eq(schema.engagementLogs.status, 'success'),
  ];
  if (since) {
    conditions.push(gte(schema.engagementLogs.createdAt, since.toISOString()));
  }

  const rows = await db
    .select({
      followCount: sql<number>`COUNT(*)`,
    })
    .from(schema.engagementLogs)
    .where(and(...conditions));

  const follows = Number(rows[0]?.followCount ?? 0);

  if (follows > 0) {
    await recordFunnelEvent({
      accountId,
      projectId,
      eventType: 'follow',
      sourceType: 'engagement_log_aggregation',
      value: follows,
      metadata: { aggregatedSince: since?.toISOString() ?? null },
    });
  }

  return { follows };
}

/**
 * Get funnel data for visualization
 */
export async function getFunnelData(options: {
  accountId?: number;
  projectId?: number;
  startDate: string;
  endDate: string;
}): Promise<{
  stages: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  timeSeries: Array<{
    date: string;
    impressions: number;
    engagements: number;
    follows: number;
    conversions: number;
  }>;
}> {
  // Build filter conditions
  const conditions = [
    gte(schema.funnelEvents.recordedAt, options.startDate),
    lte(schema.funnelEvents.recordedAt, options.endDate),
  ];
  if (options.accountId) {
    conditions.push(eq(schema.funnelEvents.accountId, options.accountId));
  }
  if (options.projectId) {
    conditions.push(eq(schema.funnelEvents.projectId, options.projectId));
  }

  // Aggregate counts per event type
  const stageCounts = await db
    .select({
      eventType: schema.funnelEvents.eventType,
      total: sql<number>`COALESCE(SUM(${schema.funnelEvents.value}), 0)`,
    })
    .from(schema.funnelEvents)
    .where(and(...conditions))
    .groupBy(schema.funnelEvents.eventType);

  // Build stage map for easy lookup
  const stageMap = new Map<string, number>();
  for (const row of stageCounts) {
    stageMap.set(row.eventType, Number(row.total));
  }

  // Build ordered stages with conversion percentages
  const stages: Array<{ stage: string; count: number; percentage: number }> = [];
  for (let i = 0; i < FUNNEL_STAGES.length; i++) {
    const stage = FUNNEL_STAGES[i];
    const stageCount = stageMap.get(stage) ?? 0;
    const previousCount = i > 0 ? (stages[i - 1]?.count ?? 0) : stageCount;
    const percentage = previousCount > 0 ? Math.round((stageCount / previousCount) * 10000) / 100 : 0;

    stages.push({
      stage,
      count: stageCount,
      percentage: i === 0 ? 100 : percentage,
    });
  }

  // Aggregate time series grouped by date
  const timeSeriesRows = await db
    .select({
      date: sql<string>`DATE(${schema.funnelEvents.recordedAt})`,
      eventType: schema.funnelEvents.eventType,
      total: sql<number>`COALESCE(SUM(${schema.funnelEvents.value}), 0)`,
    })
    .from(schema.funnelEvents)
    .where(and(...conditions))
    .groupBy(sql`DATE(${schema.funnelEvents.recordedAt})`, schema.funnelEvents.eventType)
    .orderBy(sql`DATE(${schema.funnelEvents.recordedAt})`);

  // Pivot time series rows into date-keyed records
  const dateMap = new Map<string, {
    impressions: number;
    engagements: number;
    follows: number;
    conversions: number;
  }>();

  for (const row of timeSeriesRows) {
    const dateStr = String(row.date);
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, { impressions: 0, engagements: 0, follows: 0, conversions: 0 });
    }
    const entry = dateMap.get(dateStr)!;
    const value = Number(row.total);

    switch (row.eventType) {
      case 'impression':
        entry.impressions = value;
        break;
      case 'engagement':
        entry.engagements = value;
        break;
      case 'profile_visit':
        // profile_visit is tracked in stages but not as a separate time series column
        break;
      case 'follow':
        entry.follows = value;
        break;
      case 'conversion':
        entry.conversions = value;
        break;
    }
  }

  const timeSeries = Array.from(dateMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));

  return { stages, timeSeries };
}

/**
 * Get post-level funnel contribution
 */
export async function getPostFunnelContribution(options: {
  accountId?: number;
  projectId?: number;
  limit?: number;
}): Promise<Array<{
  postId: number;
  impressions: number;
  engagements: number;
  conversionRate: number;
}>> {
  const limit = options.limit ?? 20;

  // Build filter conditions - only include events with a postId
  const conditions = [sql`${schema.funnelEvents.postId} IS NOT NULL`];
  if (options.accountId) {
    conditions.push(eq(schema.funnelEvents.accountId, options.accountId));
  }
  if (options.projectId) {
    conditions.push(eq(schema.funnelEvents.projectId, options.projectId));
  }

  // Get per-post, per-eventType aggregated values
  const rows = await db
    .select({
      postId: schema.funnelEvents.postId,
      eventType: schema.funnelEvents.eventType,
      total: sql<number>`COALESCE(SUM(${schema.funnelEvents.value}), 0)`,
    })
    .from(schema.funnelEvents)
    .where(and(...conditions))
    .groupBy(schema.funnelEvents.postId, schema.funnelEvents.eventType);

  // Pivot into per-post records
  const postMap = new Map<number, { impressions: number; engagements: number }>();
  for (const row of rows) {
    const postId = row.postId!;
    if (!postMap.has(postId)) {
      postMap.set(postId, { impressions: 0, engagements: 0 });
    }
    const entry = postMap.get(postId)!;
    const value = Number(row.total);

    if (row.eventType === 'impression') {
      entry.impressions = value;
    } else if (row.eventType === 'engagement') {
      entry.engagements = value;
    }
  }

  // Convert to array and calculate conversion rates
  const results = Array.from(postMap.entries())
    .map(([postId, data]) => ({
      postId,
      impressions: data.impressions,
      engagements: data.engagements,
      conversionRate: data.impressions > 0
        ? Math.round((data.engagements / data.impressions) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);

  return results;
}
