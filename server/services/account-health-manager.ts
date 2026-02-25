/**
 * Account Health Manager
 *
 * Manages account health scoring, warming protocols, rate limiting,
 * auto-throttling, and health monitoring for SNS automation accounts.
 *
 * Ensures accounts operate within safe limits to avoid platform bans
 * and maintains natural-looking engagement patterns.
 */

import { db } from "../db";
import {
  accountHealth,
  accounts,
  freezeDetections,
  posts,
  interactions,
  agentExecutionLogs,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// ============================================
// Types
// ============================================

export type ActionType = "post" | "like" | "comment" | "follow" | "retweet";

export type AccountPhase = "warming" | "growing" | "mature" | "cooling" | "suspended";

export interface ActionPermission {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export interface HealthScoreBreakdown {
  healthScore: number;
  loginSuccessRate: number;
  postSuccessRate: number;
  engagementNaturalnessScore: number;
  freezeRiskScore: number;
}

export interface HealthOverviewEntry {
  accountId: number;
  username: string;
  platform: string;
  healthScore: number;
  accountPhase: AccountPhase;
  isThrottled: boolean;
  isSuspended: boolean;
  postsToday: number;
  maxDailyPosts: number;
  actionsToday: number;
  maxDailyActions: number;
}

// ============================================
// Configuration
// ============================================

const HEALTH_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** Hourly limits per action type, keyed by phase */
const HOURLY_LIMITS: Record<AccountPhase, Record<ActionType, number>> = {
  warming: { post: 1, like: 3, comment: 2, follow: 2, retweet: 1 },
  growing: { post: 2, like: 10, comment: 5, follow: 5, retweet: 3 },
  mature: { post: 5, like: 20, comment: 10, follow: 10, retweet: 5 },
  cooling: { post: 1, like: 2, comment: 1, follow: 1, retweet: 1 },
  suspended: { post: 0, like: 0, comment: 0, follow: 0, retweet: 0 },
};

/** Health score weight configuration */
const HEALTH_WEIGHTS = {
  loginSuccessRate: 0.2,
  postSuccessRate: 0.3,
  engagementNaturalnessScore: 0.2,
  inverseFreezeRisk: 0.3,
} as const;

let monitorInterval: NodeJS.Timeout | null = null;
let isMonitorRunning = false;

// ============================================
// 1. Warming Protocol
// ============================================

/**
 * Initialize health record for a new account.
 * Sets the account into the 'warming' phase with conservative limits.
 */
export async function initAccountHealth(accountId: number): Promise<number> {
  console.log(`[AccountHealth] Initializing health record for account ${accountId}`);

  // Check if health record already exists
  const [existing] = await db
    .select()
    .from(accountHealth)
    .where(eq(accountHealth.accountId, accountId));

  if (existing) {
    console.log(`[AccountHealth] Health record already exists for account ${accountId} (id: ${existing.id})`);
    return existing.id;
  }

  const [result] = await db.insert(accountHealth).values({
    accountId,
    healthScore: 100,
    loginSuccessRate: 100,
    postSuccessRate: 100,
    engagementNaturalnessScore: 100,
    freezeRiskScore: 0,
    accountPhase: "warming",
    warmingStartedAt: new Date(),
    maxDailyPosts: 1,
    maxDailyActions: 10,
    postsToday: 0,
    actionsToday: 0,
    postsThisHour: 0,
    actionsThisHour: 0,
    isThrottled: 0,
    isSuspended: 0,
    totalFreezeCount: 0,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
  });

  console.log(`[AccountHealth] Created health record for account ${accountId}`);
  return result.insertId;
}

/**
 * Advance warming phase based on elapsed time since warmingStartedAt.
 * - After 7 days: 'warming' -> 'growing' (3 posts/day, 30 actions)
 * - After 14 days: 'growing' -> 'mature' (10 posts/day, 100 actions)
 */
export async function advanceWarmingPhase(accountId: number): Promise<{
  advanced: boolean;
  currentPhase: AccountPhase;
  message: string;
}> {
  const health = await getAccountHealth(accountId);
  if (!health) {
    return { advanced: false, currentPhase: "warming", message: "No health record found" };
  }

  if (health.isSuspended) {
    return { advanced: false, currentPhase: health.accountPhase as AccountPhase, message: "Account is suspended" };
  }

  if (!health.warmingStartedAt) {
    return { advanced: false, currentPhase: health.accountPhase as AccountPhase, message: "No warming start date" };
  }

  const warmingStart = new Date(health.warmingStartedAt);
  const daysSinceWarming = (Date.now() - warmingStart.getTime()) / (1000 * 60 * 60 * 24);

  const currentPhase = health.accountPhase as AccountPhase;

  // Already mature, no advancement needed
  if (currentPhase === "mature") {
    return { advanced: false, currentPhase: "mature", message: "Already at mature phase" };
  }

  // After 14 days: advance to mature
  if (daysSinceWarming >= 14 && (currentPhase === "warming" || currentPhase === "growing")) {
    await db
      .update(accountHealth)
      .set({
        accountPhase: "mature",
        maxDailyPosts: 10,
        maxDailyActions: 100,
        warmingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(accountHealth.accountId, accountId));

    console.log(`[AccountHealth] Account ${accountId} advanced to 'mature' phase (${Math.floor(daysSinceWarming)} days)`);
    return { advanced: true, currentPhase: "mature", message: "Advanced to mature phase (10 posts/day, 100 actions)" };
  }

  // After 7 days: advance to growing
  if (daysSinceWarming >= 7 && currentPhase === "warming") {
    await db
      .update(accountHealth)
      .set({
        accountPhase: "growing",
        maxDailyPosts: 3,
        maxDailyActions: 30,
        updatedAt: new Date(),
      })
      .where(eq(accountHealth.accountId, accountId));

    console.log(`[AccountHealth] Account ${accountId} advanced to 'growing' phase (${Math.floor(daysSinceWarming)} days)`);
    return { advanced: true, currentPhase: "growing", message: "Advanced to growing phase (3 posts/day, 30 actions)" };
  }

  return { advanced: false, currentPhase, message: `Still in ${currentPhase} phase (${Math.floor(daysSinceWarming)} days)` };
}

// ============================================
// 2. Rate Limiting
// ============================================

/**
 * Check if an account is permitted to perform a given action.
 * Validates against hourly and daily limits based on current phase.
 */
export async function canPerformAction(
  accountId: number,
  actionType: ActionType
): Promise<ActionPermission> {
  const health = await getAccountHealth(accountId);
  if (!health) {
    return { allowed: false, reason: "No health record found for this account" };
  }

  // Suspended accounts cannot perform any actions
  if (health.isSuspended) {
    return { allowed: false, reason: "Account is suspended" };
  }

  const phase = health.accountPhase as AccountPhase;

  // Suspended phase means no actions
  if (phase === "suspended") {
    return { allowed: false, reason: "Account is in suspended phase" };
  }

  // Check throttling
  if (health.isThrottled && health.throttleUntil) {
    const throttleEnd = new Date(health.throttleUntil);
    if (throttleEnd > new Date()) {
      const retryAfterMs = throttleEnd.getTime() - Date.now();
      return {
        allowed: false,
        reason: `Account is throttled until ${throttleEnd.toISOString()}`,
        retryAfterMs,
      };
    }
  }

  // Check daily limits
  if (actionType === "post") {
    if (health.postsToday >= health.maxDailyPosts) {
      // Calculate approximate retry time (next midnight)
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      const retryAfterMs = nextMidnight.getTime() - now.getTime();

      return {
        allowed: false,
        reason: `Daily post limit reached (${health.postsToday}/${health.maxDailyPosts})`,
        retryAfterMs,
      };
    }
  }

  if (health.actionsToday >= health.maxDailyActions) {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    const retryAfterMs = nextMidnight.getTime() - now.getTime();

    return {
      allowed: false,
      reason: `Daily action limit reached (${health.actionsToday}/${health.maxDailyActions})`,
      retryAfterMs,
    };
  }

  // Check hourly limits
  const hourlyLimit = HOURLY_LIMITS[phase][actionType];
  if (actionType === "post") {
    if (health.postsThisHour >= hourlyLimit) {
      // Calculate retry until next hour boundary
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const retryAfterMs = nextHour.getTime() - now.getTime();

      return {
        allowed: false,
        reason: `Hourly post limit reached (${health.postsThisHour}/${hourlyLimit})`,
        retryAfterMs,
      };
    }
  } else {
    if (health.actionsThisHour >= hourlyLimit) {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const retryAfterMs = nextHour.getTime() - now.getTime();

      return {
        allowed: false,
        reason: `Hourly ${actionType} limit reached (${health.actionsThisHour}/${hourlyLimit})`,
        retryAfterMs,
      };
    }
  }

  return { allowed: true };
}

/**
 * Record an action (success or failure) and update counters and streaks.
 */
export async function recordAction(
  accountId: number,
  actionType: ActionType,
  success: boolean
): Promise<void> {
  const health = await getAccountHealth(accountId);
  if (!health) {
    console.warn(`[AccountHealth] Cannot record action: no health record for account ${accountId}`);
    return;
  }

  const updateData: Record<string, unknown> = {
    actionsToday: health.actionsToday + 1,
    actionsThisHour: health.actionsThisHour + 1,
    lastActionAt: new Date(),
    updatedAt: new Date(),
  };

  if (actionType === "post") {
    updateData.postsToday = health.postsToday + 1;
    updateData.postsThisHour = health.postsThisHour + 1;
    updateData.lastPostAt = new Date();
  }

  // Update success/failure streaks
  if (success) {
    updateData.consecutiveSuccesses = health.consecutiveSuccesses + 1;
    updateData.consecutiveFailures = 0;
  } else {
    updateData.consecutiveFailures = health.consecutiveFailures + 1;
    updateData.consecutiveSuccesses = 0;
  }

  await db
    .update(accountHealth)
    .set(updateData)
    .where(eq(accountHealth.accountId, accountId));

  console.log(
    `[AccountHealth] Recorded ${actionType} (${success ? "success" : "failure"}) for account ${accountId}` +
    ` [posts: ${actionType === "post" ? (health.postsToday + 1) : health.postsToday}/${health.maxDailyPosts},` +
    ` actions: ${health.actionsToday + 1}/${health.maxDailyActions}]`
  );
}

/**
 * Reset daily counters for all accounts.
 * Should be called at midnight (00:00).
 */
export async function resetDailyCounters(): Promise<number> {
  console.log("[AccountHealth] Resetting daily counters for all accounts");

  const result = await db
    .update(accountHealth)
    .set({
      postsToday: 0,
      actionsToday: 0,
      postsThisHour: 0,
      actionsThisHour: 0,
      updatedAt: new Date(),
    });

  const affectedRows = (result as any)[0]?.affectedRows ?? 0;
  console.log(`[AccountHealth] Reset daily counters for ${affectedRows} accounts`);
  return affectedRows;
}

// ============================================
// 3. Health Scoring
// ============================================

/**
 * Calculate the composite health score for an account.
 *
 * Components:
 *  - loginSuccessRate (weight: 20%)
 *  - postSuccessRate (weight: 30%)
 *  - engagementNaturalnessScore (weight: 20%)
 *  - inverse of freezeRiskScore (weight: 30%)
 *
 * Returns a 0-100 score.
 */
export async function calculateHealthScore(accountId: number): Promise<HealthScoreBreakdown> {
  const health = await getAccountHealth(accountId);
  if (!health) {
    return {
      healthScore: 0,
      loginSuccessRate: 0,
      postSuccessRate: 0,
      engagementNaturalnessScore: 0,
      freezeRiskScore: 100,
    };
  }

  // Calculate loginSuccessRate from recent execution logs
  const loginSuccessRate = await computeLoginSuccessRate(accountId);

  // Calculate postSuccessRate from recent posts
  const postSuccessRate = await computePostSuccessRate(accountId);

  // Calculate engagementNaturalnessScore from interaction patterns
  const engagementNaturalnessScore = await computeEngagementNaturalness(accountId);

  // Calculate freezeRiskScore from freeze detections
  const freezeRiskScore = await computeFreezeRiskScore(accountId);

  // Combine into composite score
  const healthScore = Math.round(
    loginSuccessRate * HEALTH_WEIGHTS.loginSuccessRate +
    postSuccessRate * HEALTH_WEIGHTS.postSuccessRate +
    engagementNaturalnessScore * HEALTH_WEIGHTS.engagementNaturalnessScore +
    (100 - freezeRiskScore) * HEALTH_WEIGHTS.inverseFreezeRisk
  );

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, healthScore));

  // Persist the updated scores
  await db
    .update(accountHealth)
    .set({
      healthScore: clampedScore,
      loginSuccessRate,
      postSuccessRate,
      engagementNaturalnessScore,
      freezeRiskScore,
      updatedAt: new Date(),
    })
    .where(eq(accountHealth.accountId, accountId));

  console.log(
    `[AccountHealth] Score for account ${accountId}: ${clampedScore}` +
    ` (login: ${loginSuccessRate}, post: ${postSuccessRate},` +
    ` naturalness: ${engagementNaturalnessScore}, freezeRisk: ${freezeRiskScore})`
  );

  return {
    healthScore: clampedScore,
    loginSuccessRate,
    postSuccessRate,
    engagementNaturalnessScore,
    freezeRiskScore,
  };
}

/**
 * Compute login success rate from recent agent execution logs.
 */
async function computeLoginSuccessRate(accountId: number): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await db
    .select({
      status: agentExecutionLogs.status,
    })
    .from(agentExecutionLogs)
    .where(
      and(
        eq(agentExecutionLogs.accountId, accountId),
        gte(agentExecutionLogs.createdAt, toMySQLTimestamp(thirtyDaysAgo))
      )
    );

  if (logs.length === 0) return 100; // No data assumes healthy

  const successCount = logs.filter((l) => l.status === "success").length;
  return Math.round((successCount / logs.length) * 100);
}

/**
 * Compute post success rate from recent posts.
 */
async function computePostSuccessRate(accountId: number): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentPosts = await db
    .select({
      status: posts.status,
    })
    .from(posts)
    .where(
      and(
        eq(posts.accountId, accountId),
        gte(posts.createdAt, toMySQLTimestamp(thirtyDaysAgo))
      )
    );

  if (recentPosts.length === 0) return 100;

  const publishedCount = recentPosts.filter((p) => p.status === "published").length;
  const failedCount = recentPosts.filter((p) => p.status === "failed").length;
  const total = publishedCount + failedCount;

  if (total === 0) return 100;
  return Math.round((publishedCount / total) * 100);
}

/**
 * Compute engagement naturalness score based on interaction patterns.
 * Higher variance and natural-looking timing yields higher scores.
 */
async function computeEngagementNaturalness(accountId: number): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentInteractions = await db
    .select({
      executedAt: interactions.executedAt,
      status: interactions.status,
    })
    .from(interactions)
    .where(
      and(
        eq(interactions.fromAccountId, accountId),
        gte(interactions.createdAt, toMySQLTimestamp(sevenDaysAgo))
      )
    );

  if (recentInteractions.length === 0) return 100; // No activity, considered natural

  // Check for burst patterns (many actions in a short period = unnatural)
  const executionTimes = recentInteractions
    .filter((i) => i.executedAt)
    .map((i) => new Date(i.executedAt!).getTime())
    .sort((a, b) => a - b);

  if (executionTimes.length < 2) return 100;

  // Calculate intervals between consecutive actions
  const intervals: number[] = [];
  for (let i = 1; i < executionTimes.length; i++) {
    intervals.push(executionTimes[i] - executionTimes[i - 1]);
  }

  // Count very rapid actions (less than 5 seconds apart)
  const rapidActionCount = intervals.filter((interval) => interval < 5000).length;
  const rapidRatio = rapidActionCount / intervals.length;

  // Higher rapid ratio = less natural
  // 0 rapid actions = 100 score, all rapid = 20 score
  const naturalnessScore = Math.round(100 - rapidRatio * 80);
  return Math.max(0, Math.min(100, naturalnessScore));
}

/**
 * Compute freeze risk score from recent freeze detections.
 */
async function computeFreezeRiskScore(accountId: number): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentFreezes = await db
    .select()
    .from(freezeDetections)
    .where(
      and(
        eq(freezeDetections.accountId, accountId),
        gte(freezeDetections.createdAt, toMySQLTimestamp(thirtyDaysAgo))
      )
    );

  if (recentFreezes.length === 0) return 0; // No freezes = no risk

  // More recent and more frequent freezes increase risk
  const now = Date.now();
  let riskScore = 0;

  for (const freeze of recentFreezes) {
    const freezeTime = new Date(freeze.createdAt).getTime();
    const daysAgo = (now - freezeTime) / (1000 * 60 * 60 * 24);

    // Recent freezes contribute more to risk
    // A freeze today contributes ~20 points, one from 30 days ago ~2 points
    const recencyWeight = Math.max(1, 20 - (daysAgo * 0.6));

    // Higher confidence detections contribute more
    const confidenceWeight = (freeze.confidence || 50) / 100;

    riskScore += recencyWeight * confidenceWeight;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(riskScore)));
}

// ============================================
// 4. Auto-Throttling
// ============================================

/**
 * Check the account's health score and apply throttling as needed.
 *
 * - Score < 60: Throttle 50% (halve maxDailyPosts and maxDailyActions)
 * - Score < 40: Suspend automation
 * - Score < 20: Full suspend + create escalation alert
 */
export async function checkAndThrottle(accountId: number): Promise<{
  action: "none" | "throttle" | "suspend" | "escalate";
  healthScore: number;
  message: string;
}> {
  const scoreBreakdown = await calculateHealthScore(accountId);
  const health = await getAccountHealth(accountId);

  if (!health) {
    return { action: "none", healthScore: 0, message: "No health record found" };
  }

  const { healthScore } = scoreBreakdown;

  // Score < 20: Full suspend + escalation
  if (healthScore < 20) {
    // Determine base limits for the phase to use as reference
    const baseLimits = getBaseLimitsForPhase(health.accountPhase as AccountPhase);

    await db
      .update(accountHealth)
      .set({
        isSuspended: 1,
        suspendedReason: `Health score critically low: ${healthScore}`,
        isThrottled: 1,
        throttleReason: `Auto-suspended: health score ${healthScore} < 20`,
        maxDailyPosts: 0,
        maxDailyActions: 0,
        updatedAt: new Date(),
      })
      .where(eq(accountHealth.accountId, accountId));

    // Create escalation alert via agent execution log
    await db.insert(agentExecutionLogs).values({
      agentId: 0, // System-generated
      accountId,
      executionType: "analysis",
      status: "failed",
      inputData: JSON.stringify({
        type: "health_escalation",
        healthScore,
        breakdown: scoreBreakdown,
      }),
      outputData: JSON.stringify({
        action: "full_suspend",
        reason: `Critical health score: ${healthScore}`,
      }),
      errorMessage: `[ESCALATION] Account ${accountId} health critically low (${healthScore}/100). Manual review required.`,
    });

    console.log(`[AccountHealth] ESCALATION: Account ${accountId} fully suspended (score: ${healthScore})`);
    return {
      action: "escalate",
      healthScore,
      message: `Full suspend + escalation alert created (score: ${healthScore})`,
    };
  }

  // Score < 40: Suspend automation
  if (healthScore < 40) {
    await db
      .update(accountHealth)
      .set({
        isSuspended: 1,
        suspendedReason: `Health score low: ${healthScore}`,
        isThrottled: 1,
        throttleReason: `Auto-suspended: health score ${healthScore} < 40`,
        maxDailyPosts: 0,
        maxDailyActions: 0,
        updatedAt: new Date(),
      })
      .where(eq(accountHealth.accountId, accountId));

    console.log(`[AccountHealth] Account ${accountId} suspended (score: ${healthScore})`);
    return {
      action: "suspend",
      healthScore,
      message: `Automation suspended (score: ${healthScore})`,
    };
  }

  // Score < 60: Throttle 50%
  if (healthScore < 60) {
    const baseLimits = getBaseLimitsForPhase(health.accountPhase as AccountPhase);
    const throttledPosts = Math.max(1, Math.floor(baseLimits.maxDailyPosts / 2));
    const throttledActions = Math.max(5, Math.floor(baseLimits.maxDailyActions / 2));

    await db
      .update(accountHealth)
      .set({
        isThrottled: 1,
        throttleReason: `Auto-throttled: health score ${healthScore} < 60`,
        maxDailyPosts: throttledPosts,
        maxDailyActions: throttledActions,
        isSuspended: 0,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(accountHealth.accountId, accountId));

    console.log(`[AccountHealth] Account ${accountId} throttled 50% (score: ${healthScore}, posts: ${throttledPosts}, actions: ${throttledActions})`);
    return {
      action: "throttle",
      healthScore,
      message: `Throttled 50% (score: ${healthScore}, posts: ${throttledPosts}/day, actions: ${throttledActions}/day)`,
    };
  }

  // Score >= 60: no throttling needed, but don't auto-unthrottle here
  return { action: "none", healthScore, message: `Health score OK (${healthScore})` };
}

/**
 * Remove throttle and restore normal limits when health score recovers above 70.
 */
export async function unthrottle(accountId: number): Promise<{
  success: boolean;
  message: string;
}> {
  const health = await getAccountHealth(accountId);
  if (!health) {
    return { success: false, message: "No health record found" };
  }

  if (!health.isThrottled && !health.isSuspended) {
    return { success: false, message: "Account is not throttled or suspended" };
  }

  // Verify score is above 70 before unthrottling
  const scoreBreakdown = await calculateHealthScore(accountId);
  if (scoreBreakdown.healthScore < 70) {
    return {
      success: false,
      message: `Health score ${scoreBreakdown.healthScore} is below 70 threshold for unthrottling`,
    };
  }

  const baseLimits = getBaseLimitsForPhase(health.accountPhase as AccountPhase);

  await db
    .update(accountHealth)
    .set({
      isThrottled: 0,
      throttleReason: null,
      throttleUntil: null,
      isSuspended: 0,
      suspendedReason: null,
      maxDailyPosts: baseLimits.maxDailyPosts,
      maxDailyActions: baseLimits.maxDailyActions,
      updatedAt: new Date(),
    })
    .where(eq(accountHealth.accountId, accountId));

  console.log(`[AccountHealth] Account ${accountId} unthrottled (score: ${scoreBreakdown.healthScore})`);
  return {
    success: true,
    message: `Unthrottled successfully (score: ${scoreBreakdown.healthScore}, posts: ${baseLimits.maxDailyPosts}/day, actions: ${baseLimits.maxDailyActions}/day)`,
  };
}

/**
 * Get base daily limits for a given phase (without throttling).
 */
function getBaseLimitsForPhase(phase: AccountPhase): {
  maxDailyPosts: number;
  maxDailyActions: number;
} {
  switch (phase) {
    case "warming":
      return { maxDailyPosts: 1, maxDailyActions: 10 };
    case "growing":
      return { maxDailyPosts: 3, maxDailyActions: 30 };
    case "mature":
      return { maxDailyPosts: 10, maxDailyActions: 100 };
    case "cooling":
      return { maxDailyPosts: 1, maxDailyActions: 5 };
    case "suspended":
      return { maxDailyPosts: 0, maxDailyActions: 0 };
    default:
      return { maxDailyPosts: 1, maxDailyActions: 10 };
  }
}

// ============================================
// 5. Health Monitor (Scheduler)
// ============================================

/**
 * Start the account health monitor.
 * Runs every 15 minutes to check all active accounts,
 * update their health scores, and apply throttling as needed.
 */
export function startAccountHealthMonitor(): void {
  if (monitorInterval) {
    console.log("[AccountHealth] Health monitor already running");
    return;
  }

  console.log(`[AccountHealth] Starting health monitor (interval: ${HEALTH_CHECK_INTERVAL_MS / 1000 / 60} minutes)`);

  // Run immediately
  runHealthCheckCycle();

  // Schedule periodic runs
  monitorInterval = setInterval(() => {
    runHealthCheckCycle();
  }, HEALTH_CHECK_INTERVAL_MS);
}

/**
 * Stop the account health monitor.
 */
export function stopAccountHealthMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[AccountHealth] Health monitor stopped");
  }
}

/**
 * Run a single health check cycle for all active accounts.
 */
async function runHealthCheckCycle(): Promise<void> {
  if (isMonitorRunning) {
    console.log("[AccountHealth] Health check cycle already running, skipping");
    return;
  }

  isMonitorRunning = true;

  try {
    // Get all accounts that have a health record
    const healthRecords = await db
      .select({
        accountId: accountHealth.accountId,
        isSuspended: accountHealth.isSuspended,
        isThrottled: accountHealth.isThrottled,
        healthScore: accountHealth.healthScore,
      })
      .from(accountHealth);

    console.log(`[AccountHealth] Running health check for ${healthRecords.length} accounts`);

    for (const record of healthRecords) {
      try {
        // Advance warming phase if applicable
        await advanceWarmingPhase(record.accountId);

        // Calculate and update health score
        const result = await checkAndThrottle(record.accountId);

        // If previously throttled/suspended and score is now above 70, unthrottle
        if (
          (record.isThrottled || record.isSuspended) &&
          result.healthScore >= 70 &&
          result.action === "none"
        ) {
          await unthrottle(record.accountId);
        }
      } catch (error) {
        console.error(`[AccountHealth] Error checking account ${record.accountId}:`, error);
      }
    }

    console.log("[AccountHealth] Health check cycle completed");
  } catch (error) {
    console.error("[AccountHealth] Error in health check cycle:", error);
  } finally {
    isMonitorRunning = false;
  }
}

// ============================================
// 6. Integration Helpers
// ============================================

/**
 * Get the health record for a specific account.
 */
export async function getAccountHealth(accountId: number) {
  const [health] = await db
    .select()
    .from(accountHealth)
    .where(eq(accountHealth.accountId, accountId));

  return health ?? null;
}

/**
 * Get health overview for all accounts (optionally filtered by userId).
 */
export async function getHealthOverview(userId?: number): Promise<HealthOverviewEntry[]> {
  let query;

  if (userId !== undefined) {
    query = db
      .select({
        accountId: accountHealth.accountId,
        username: accounts.username,
        platform: accounts.platform,
        healthScore: accountHealth.healthScore,
        accountPhase: accountHealth.accountPhase,
        isThrottled: accountHealth.isThrottled,
        isSuspended: accountHealth.isSuspended,
        postsToday: accountHealth.postsToday,
        maxDailyPosts: accountHealth.maxDailyPosts,
        actionsToday: accountHealth.actionsToday,
        maxDailyActions: accountHealth.maxDailyActions,
      })
      .from(accountHealth)
      .innerJoin(accounts, eq(accountHealth.accountId, accounts.id))
      .where(eq(accounts.userId, userId))
      .orderBy(accountHealth.healthScore);
  } else {
    query = db
      .select({
        accountId: accountHealth.accountId,
        username: accounts.username,
        platform: accounts.platform,
        healthScore: accountHealth.healthScore,
        accountPhase: accountHealth.accountPhase,
        isThrottled: accountHealth.isThrottled,
        isSuspended: accountHealth.isSuspended,
        postsToday: accountHealth.postsToday,
        maxDailyPosts: accountHealth.maxDailyPosts,
        actionsToday: accountHealth.actionsToday,
        maxDailyActions: accountHealth.maxDailyActions,
      })
      .from(accountHealth)
      .innerJoin(accounts, eq(accountHealth.accountId, accounts.id))
      .orderBy(accountHealth.healthScore);
  }

  const results = await query;

  return results.map((r) => ({
    accountId: r.accountId,
    username: r.username,
    platform: r.platform,
    healthScore: r.healthScore,
    accountPhase: r.accountPhase as AccountPhase,
    isThrottled: !!r.isThrottled,
    isSuspended: !!r.isSuspended,
    postsToday: r.postsToday,
    maxDailyPosts: r.maxDailyPosts,
    actionsToday: r.actionsToday,
    maxDailyActions: r.maxDailyActions,
  }));
}

/**
 * Quick boolean check: is this account healthy enough for automation?
 * Returns true if the account is not suspended and has a health score >= 40.
 */
export async function isAccountHealthy(accountId: number): Promise<boolean> {
  const health = await getAccountHealth(accountId);
  if (!health) return false;

  return !health.isSuspended && health.healthScore >= 40;
}
