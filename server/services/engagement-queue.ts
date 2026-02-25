/**
 * Engagement Queue Service
 *
 * Manages prioritized engagement tasks:
 * - Priority queue management
 * - Follow-back rate tracking
 * - Effectiveness measurement
 * - Smart scheduling based on rate limits
 */

import { db } from "../db";
import {
  engagementTasks,
  engagementLogs,
  accounts,
  interactionSettings,
  analytics,
} from "../../drizzle/schema";
import { eq, and, desc, gte, lt, sql, asc, isNull } from "drizzle-orm";

import { createLogger } from "../utils/logger";

const logger = createLogger("engagement-queue");

// Types
export interface QueuedTask {
  id: number;
  projectId: number;
  accountId: number;
  taskType: "like" | "follow" | "comment" | "unfollow";
  targetUser: string | null;
  targetPost: string | null;
  commentText: string | null;
  priority: number; // Higher = more important
  createdAt: Date;
}

export interface QueueStats {
  pending: number;
  completedToday: number;
  failedToday: number;
  successRate: number;
}

export interface FollowBackStats {
  totalFollowed: number;
  followedBack: number;
  followBackRate: number;
  avgFollowBackDays: number;
}

/**
 * Get the next tasks to execute from the queue
 * Respects rate limits and prioritizes effectively
 */
export async function getNextTasks(
  projectId: number,
  accountId: number,
  limit: number = 5
): Promise<QueuedTask[]> {
  // Get rate limit settings
  const settings = await db.query.interactionSettings.findFirst({
    where: eq(interactionSettings.projectId, projectId),
  });

  if (!settings?.isEnabled) {
    logger.info(`[EngagementQueue] Interactions disabled for project ${projectId}`);
    return [];
  }

  // Get today's completed tasks to respect daily limits
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLogs = await db.query.engagementLogs.findMany({
    where: and(
      eq(engagementLogs.accountId, accountId),
      gte(engagementLogs.createdAt, today.toISOString())
    ),
  });

  // Count by task type
  const typeCounts: Record<string, number> = {};
  for (const log of todayLogs) {
    typeCounts[log.taskType] = (typeCounts[log.taskType] || 0) + 1;
  }

  // Determine which task types are still available
  const availableTypes: string[] = [];

  // Default daily limits (can be customized)
  const dailyLimits = {
    like: 50,
    follow: 20,
    comment: 10,
    unfollow: 30,
    retweet: 15,
  };

  for (const [type, limit] of Object.entries(dailyLimits)) {
    if ((typeCounts[type] || 0) < limit) {
      // Check if the type is enabled in settings
      const isEnabled =
        (type === "like" && settings.likeEnabled) ||
        (type === "comment" && settings.commentEnabled) ||
        (type === "follow" && settings.followEnabled) ||
        (type === "retweet" && settings.retweetEnabled) ||
        type === "unfollow";

      if (isEnabled) {
        availableTypes.push(type);
      }
    }
  }

  if (availableTypes.length === 0) {
    logger.info(`[EngagementQueue] All task types at daily limit for account ${accountId}`);
    return [];
  }

  // Get pending tasks
  const tasks = await db.query.engagementTasks.findMany({
    where: and(
      eq(engagementTasks.projectId, projectId),
      eq(engagementTasks.accountId, accountId),
      eq(engagementTasks.isActive, 1)
    ),
    orderBy: [desc(engagementTasks.createdAt)],
    limit: limit * 2, // Fetch more to filter
  });

  // Filter to available types and respect timing
  const now = Date.now();
  const validTasks: QueuedTask[] = [];

  for (const task of tasks) {
    if (!availableTypes.includes(task.taskType)) continue;

    // Check if enough time has passed since last execution
    if (task.lastExecutedAt) {
      const lastExec = new Date(task.lastExecutedAt).getTime();
      const minWait = getMinWaitTime(task.taskType, settings);
      if (now - lastExec < minWait) continue;
    }

    validTasks.push({
      id: task.id,
      projectId: task.projectId,
      accountId: task.accountId,
      taskType: task.taskType as QueuedTask["taskType"],
      targetUser: task.targetUser,
      targetPost: task.targetPost,
      commentText: task.commentText,
      priority: calculateTaskPriority(task),
      createdAt: new Date(task.createdAt),
    });

    if (validTasks.length >= limit) break;
  }

  // Sort by priority (descending)
  validTasks.sort((a, b) => b.priority - a.priority);

  return validTasks;
}

/**
 * Calculate minimum wait time (in ms) between executions of a task type
 */
function getMinWaitTime(
  taskType: string,
  settings: typeof interactionSettings.$inferSelect
): number {
  // Convert minutes to milliseconds
  const minToMs = (min: number | null | undefined) => (min || 5) * 60 * 1000;

  switch (taskType) {
    case "like":
      return minToMs(settings.likeDelayMinMin);
    case "comment":
      return minToMs(settings.commentDelayMinMin);
    case "follow":
      return minToMs(settings.followDelayMinMin);
    case "retweet":
      return minToMs(settings.retweetDelayMinMin);
    default:
      return minToMs(5);
  }
}

/**
 * Calculate priority score for a task
 * Higher priority = execute sooner
 */
function calculateTaskPriority(
  task: typeof engagementTasks.$inferSelect
): number {
  let priority = 50; // Base priority

  // Newer tasks get slight priority boost
  const age = Date.now() - new Date(task.createdAt).getTime();
  const ageHours = age / (1000 * 60 * 60);
  if (ageHours < 24) priority += 20;
  else if (ageHours < 72) priority += 10;

  // Follows are high priority (core growth mechanism)
  if (task.taskType === "follow") priority += 15;

  // Likes are quick, medium priority
  if (task.taskType === "like") priority += 10;

  // Comments take more effort, lower priority
  if (task.taskType === "comment") priority += 5;

  return Math.min(100, priority);
}

/**
 * Get queue statistics for a project/account
 */
export async function getQueueStats(
  projectId: number,
  accountId: number
): Promise<QueueStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count pending tasks
  const pendingTasks = await db
    .select({ count: sql<number>`count(*)` })
    .from(engagementTasks)
    .where(
      and(
        eq(engagementTasks.projectId, projectId),
        eq(engagementTasks.accountId, accountId),
        eq(engagementTasks.isActive, 1)
      )
    );

  // Count today's completed and failed
  const todayLogs = await db.query.engagementLogs.findMany({
    where: and(
      eq(engagementLogs.accountId, accountId),
      gte(engagementLogs.createdAt, today.toISOString())
    ),
  });

  const completedToday = todayLogs.filter((l) => l.status === "success").length;
  const failedToday = todayLogs.filter((l) => l.status === "failed").length;
  const total = completedToday + failedToday;
  const successRate = total > 0 ? (completedToday / total) * 100 : 0;

  return {
    pending: Number(pendingTasks[0]?.count || 0),
    completedToday,
    failedToday,
    successRate: Math.round(successRate),
  };
}

/**
 * Get follow-back rate statistics
 * Tracks how often our follows result in follow-backs
 */
export async function getFollowBackStats(
  accountId: number,
  daysBack: number = 30
): Promise<FollowBackStats> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Get successful follows in the period
  const follows = await db.query.engagementLogs.findMany({
    where: and(
      eq(engagementLogs.accountId, accountId),
      eq(engagementLogs.taskType, "follow"),
      eq(engagementLogs.status, "success"),
      gte(engagementLogs.createdAt, startDate.toISOString())
    ),
  });

  // Get follower count changes from analytics
  const analyticsData = await db.query.analytics.findMany({
    where: and(
      eq(analytics.accountId, accountId),
      gte(analytics.recordedAt, startDate.toISOString())
    ),
    orderBy: [asc(analytics.recordedAt)],
  });

  // Estimate follow-backs based on follower count changes
  let totalFollowerGain = 0;
  for (let i = 1; i < analyticsData.length; i++) {
    const gain = analyticsData[i].followersCount - analyticsData[i - 1].followersCount;
    if (gain > 0) totalFollowerGain += gain;
  }

  const totalFollowed = follows.length;
  // Rough estimate: assume some portion of follower gains are follow-backs
  const estimatedFollowBacks = Math.min(totalFollowerGain, Math.floor(totalFollowed * 0.3));

  return {
    totalFollowed,
    followedBack: estimatedFollowBacks,
    followBackRate: totalFollowed > 0 ? (estimatedFollowBacks / totalFollowed) * 100 : 0,
    avgFollowBackDays: 3, // Placeholder - would need more tracking
  };
}

/**
 * Mark a task as completed
 */
export async function markTaskCompleted(taskId: number): Promise<void> {
  await db
    .update(engagementTasks)
    .set({
      lastExecutedAt: new Date().toISOString(),
      isActive: 0, // Deactivate after completion
    })
    .where(eq(engagementTasks.id, taskId));
}

/**
 * Add a task to the queue
 */
export async function addToQueue(task: {
  projectId: number;
  accountId: number;
  taskType: "like" | "follow" | "comment" | "unfollow";
  targetUser?: string;
  targetPost?: string;
  commentText?: string;
  frequency?: number;
}): Promise<number> {
  const [result] = await db.insert(engagementTasks).values({
    projectId: task.projectId,
    accountId: task.accountId,
    taskType: task.taskType,
    targetUser: task.targetUser || null,
    targetPost: task.targetPost || null,
    commentText: task.commentText || null,
    frequency: task.frequency || 1,
    isActive: 1,
  });

  return (result as any).insertId;
}

/**
 * Bulk add tasks to the queue
 */
export async function bulkAddToQueue(
  tasks: Array<{
    projectId: number;
    accountId: number;
    taskType: "like" | "follow" | "comment" | "unfollow";
    targetUser?: string;
    targetPost?: string;
    commentText?: string;
  }>
): Promise<{ added: number; failed: number }> {
  let added = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      await addToQueue(task);
      added++;
    } catch (err) {
      logger.error({ err: err }, "[EngagementQueue] Failed to add task");
      failed++;
    }
  }

  return { added, failed };
}

/**
 * Clear completed tasks older than specified days
 */
export async function cleanupOldTasks(daysOld: number = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await db
    .delete(engagementTasks)
    .where(
      and(
        eq(engagementTasks.isActive, 0),
        lt(engagementTasks.updatedAt, cutoff.toISOString())
      )
    );

  return (result as any)[0]?.affectedRows || 0;
}

/**
 * Get engagement effectiveness metrics
 */
export async function getEngagementEffectiveness(
  projectId: number,
  daysBack: number = 30
): Promise<{
  likesPerformed: number;
  followsPerformed: number;
  commentsPerformed: number;
  overallSuccessRate: number;
  estimatedReach: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const logs = await db.query.engagementLogs.findMany({
    where: gte(engagementLogs.createdAt, startDate.toISOString()),
  });

  const likesPerformed = logs.filter(
    (l) => l.taskType === "like" && l.status === "success"
  ).length;
  const followsPerformed = logs.filter(
    (l) => l.taskType === "follow" && l.status === "success"
  ).length;
  const commentsPerformed = logs.filter(
    (l) => l.taskType === "comment" && l.status === "success"
  ).length;

  const totalTasks = logs.length;
  const successTasks = logs.filter((l) => l.status === "success").length;
  const overallSuccessRate = totalTasks > 0 ? (successTasks / totalTasks) * 100 : 0;

  // Estimate reach: each follow ~100 reach, like ~10, comment ~50
  const estimatedReach =
    followsPerformed * 100 + likesPerformed * 10 + commentsPerformed * 50;

  return {
    likesPerformed,
    followsPerformed,
    commentsPerformed,
    overallSuccessRate: Math.round(overallSuccessRate),
    estimatedReach,
  };
}
