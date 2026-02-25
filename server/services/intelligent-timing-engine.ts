/**
 * Intelligent Timing Engine
 *
 * Data-driven posting time optimization engine that analyzes engagement data
 * to determine optimal posting times for each account. Combines own account
 * analytics with model account behavior patterns to produce optimized
 * posting time slots for agents.
 */

import { db } from "../db";
import {
  postAnalytics,
  posts,
  postUrls,
  agents,
  agentAccounts,
  modelAccountBehaviorPatterns,
  accountModelAccounts,
  scheduledPosts,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql, avg } from "drizzle-orm";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// ==================== Type Definitions ====================

export interface HourlyEngagement {
  hour: number; // 0-23
  avgEngagementRate: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;
  sampleSize: number;
}

export interface OptimalTimeSlot {
  hour: number;
  timeLabel: string; // e.g., "09:00"
  score: number; // Composite score for ranking
  source: "own_analytics" | "model_account" | "combined";
}

export interface ModelAccountTimingData {
  modelAccountId: number;
  peakPostingHours: string[];
  bestEngagementHours: string[];
}

export interface TimingOptimizationResult {
  agentId: number;
  previousTimeSlots: string[];
  newTimeSlots: string[];
  analysis: {
    ownAccountTopHours: OptimalTimeSlot[];
    modelAccountTopHours: OptimalTimeSlot[];
    combinedTopHours: OptimalTimeSlot[];
  };
  updatedAt: string;
}

export interface TimingReport {
  accountId: number;
  projectId: number | null;
  hourlyBreakdown: HourlyEngagement[];
  topHours: OptimalTimeSlot[];
  totalPostsAnalyzed: number;
  analysisPeriodDays: number;
  recommendations: string[];
  generatedAt: string;
}

// ==================== Core Functions ====================

/**
 * Analyze optimal posting times for a given account based on historical
 * engagement data from postAnalytics. Groups data by hour-of-day and
 * returns the top 5 hours sorted by average engagement.
 */
export async function analyzeOptimalTimes(
  accountId: number,
  projectId?: number
): Promise<OptimalTimeSlot[]> {
  const LOG_PREFIX = "[TimingEngine]";

  try {
    console.log(
      `${LOG_PREFIX} Analyzing optimal times for account ${accountId}${projectId ? ` (project ${projectId})` : ""}`
    );

    // Query post analytics for this account, joined with posts to get publishedAt
    // Use recordedAt from postAnalytics as the primary timestamp,
    // falling back to publishedAt from the related post.
    const analyticsPeriodDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - analyticsPeriodDays);

    const analyticsRows = await db
      .select({
        paId: postAnalytics.id,
        postId: postAnalytics.postId,
        likesCount: postAnalytics.likesCount,
        commentsCount: postAnalytics.commentsCount,
        sharesCount: postAnalytics.sharesCount,
        viewsCount: postAnalytics.viewsCount,
        engagementRate: postAnalytics.engagementRate,
        recordedAt: postAnalytics.recordedAt,
        publishedAt: posts.publishedAt,
        postProjectId: posts.projectId,
      })
      .from(postAnalytics)
      .innerJoin(posts, eq(postAnalytics.postId, posts.id))
      .where(
        and(
          eq(postAnalytics.accountId, accountId),
          gte(postAnalytics.recordedAt, toMySQLTimestamp(cutoffDate))
        )
      )
      .orderBy(desc(postAnalytics.recordedAt));

    // If projectId is specified, further filter to that project
    const filteredRows = projectId
      ? analyticsRows.filter((row) => row.postProjectId === projectId)
      : analyticsRows;

    if (filteredRows.length === 0) {
      console.log(
        `${LOG_PREFIX} No analytics data found for account ${accountId}`
      );
      return [];
    }

    // Group by hour-of-day
    const hourlyBuckets: Map<
      number,
      {
        totalEngagement: number;
        totalLikes: number;
        totalComments: number;
        totalShares: number;
        totalViews: number;
        count: number;
      }
    > = new Map();

    for (let h = 0; h < 24; h++) {
      hourlyBuckets.set(h, {
        totalEngagement: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0,
        count: 0,
      });
    }

    for (const row of filteredRows) {
      // Prefer publishedAt from the post, fall back to recordedAt
      const timestamp = row.publishedAt || row.recordedAt;
      if (!timestamp) continue;

      const date = new Date(timestamp);
      const hour = date.getHours();
      const bucket = hourlyBuckets.get(hour)!;

      bucket.totalEngagement += row.engagementRate || 0;
      bucket.totalLikes += row.likesCount || 0;
      bucket.totalComments += row.commentsCount || 0;
      bucket.totalShares += row.sharesCount || 0;
      bucket.totalViews += row.viewsCount || 0;
      bucket.count += 1;
    }

    // Calculate averages and build scored slots
    const scoredSlots: OptimalTimeSlot[] = [];

    for (const [hour, bucket] of hourlyBuckets.entries()) {
      if (bucket.count === 0) continue;

      const avgEngagement = bucket.totalEngagement / bucket.count;
      const avgLikes = bucket.totalLikes / bucket.count;
      const avgComments = bucket.totalComments / bucket.count;
      const avgShares = bucket.totalShares / bucket.count;

      // Composite score: engagement rate weighted heavily, plus interaction bonuses
      const score =
        avgEngagement * 10 + avgLikes * 1 + avgComments * 3 + avgShares * 5;

      scoredSlots.push({
        hour,
        timeLabel: `${hour.toString().padStart(2, "0")}:00`,
        score,
        source: "own_analytics",
      });
    }

    // Sort by score descending and return top 5
    scoredSlots.sort((a, b) => b.score - a.score);
    const topSlots = scoredSlots.slice(0, 5);

    console.log(
      `${LOG_PREFIX} Top hours for account ${accountId}: ${topSlots.map((s) => s.timeLabel).join(", ")}`
    );

    return topSlots;
  } catch (error) {
    console.error(
      `[TimingEngine] Error analyzing optimal times for account ${accountId}:`,
      error
    );
    return [];
  }
}

/**
 * Cross-analyze timing data from model accounts linked to the user's accounts.
 * Extracts peakPostingHours and bestEngagementHours from behavior patterns
 * and returns aggregated optimal time recommendations.
 */
export async function crossAnalyzeWithModelAccounts(
  userId: number
): Promise<OptimalTimeSlot[]> {
  const LOG_PREFIX = "[TimingEngine]";

  try {
    console.log(
      `${LOG_PREFIX} Cross-analyzing model account timing for user ${userId}`
    );

    // Two-step approach: first find model account IDs linked to user's accounts,
    // then fetch their behavior patterns.

    // Step 1: Find the user's account-model-account links
    const modelLinks = await db
      .select({
        modelAccountId: accountModelAccounts.modelAccountId,
      })
      .from(accountModelAccounts)
      .where(
        sql`${accountModelAccounts.accountId} IN (
          SELECT id FROM accounts WHERE user_id = ${userId}
        )`
      );

    if (modelLinks.length === 0) {
      console.log(
        `${LOG_PREFIX} No model accounts linked for user ${userId}`
      );
      return [];
    }

    const modelAccountIds = [
      ...new Set(modelLinks.map((l) => l.modelAccountId)),
    ];

    // Step 2: Get behavior patterns for those model accounts
    const behaviorPatterns = await db
      .select({
        modelAccountId: modelAccountBehaviorPatterns.modelAccountId,
        peakPostingHours: modelAccountBehaviorPatterns.peakPostingHours,
        bestEngagementHours: modelAccountBehaviorPatterns.bestEngagementHours,
      })
      .from(modelAccountBehaviorPatterns)
      .where(
        sql`${modelAccountBehaviorPatterns.modelAccountId} IN (${sql.join(
          modelAccountIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    if (behaviorPatterns.length === 0) {
      console.log(
        `${LOG_PREFIX} No behavior patterns found for model accounts of user ${userId}`
      );
      return [];
    }

    // Step 3: Aggregate hours across all model accounts
    const hourScores: Map<number, { peakCount: number; engagementCount: number }> =
      new Map();

    for (let h = 0; h < 24; h++) {
      hourScores.set(h, { peakCount: 0, engagementCount: 0 });
    }

    for (const pattern of behaviorPatterns) {
      // Parse peakPostingHours (e.g., ["09", "12", "19"])
      const peakHours: string[] = pattern.peakPostingHours
        ? safeParseJson<string[]>(pattern.peakPostingHours, [])
        : [];

      for (const hourStr of peakHours) {
        const hour = parseInt(hourStr, 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          const entry = hourScores.get(hour)!;
          entry.peakCount += 1;
        }
      }

      // Parse bestEngagementHours (e.g., ["08", "12", "20"] or similar)
      const engagementHours: string[] = pattern.bestEngagementHours
        ? safeParseJson<string[]>(pattern.bestEngagementHours, [])
        : [];

      for (const hourStr of engagementHours) {
        const hour = parseInt(hourStr, 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          const entry = hourScores.get(hour)!;
          entry.engagementCount += 1;
        }
      }
    }

    // Build scored slots: engagement hours weighted more than peak posting hours
    const scoredSlots: OptimalTimeSlot[] = [];

    for (const [hour, data] of hourScores.entries()) {
      if (data.peakCount === 0 && data.engagementCount === 0) continue;

      const score = data.engagementCount * 3 + data.peakCount * 1;

      scoredSlots.push({
        hour,
        timeLabel: `${hour.toString().padStart(2, "0")}:00`,
        score,
        source: "model_account",
      });
    }

    scoredSlots.sort((a, b) => b.score - a.score);
    const topSlots = scoredSlots.slice(0, 5);

    console.log(
      `${LOG_PREFIX} Model account top hours for user ${userId}: ${topSlots.map((s) => s.timeLabel).join(", ")}`
    );

    return topSlots;
  } catch (error) {
    console.error(
      `[TimingEngine] Error cross-analyzing model accounts for user ${userId}:`,
      error
    );
    return [];
  }
}

/**
 * Optimize an agent's posting time slots by combining own account analysis
 * with model account analysis. Updates the agent's postingTimeSlots field
 * and returns the old and new time slots.
 */
export async function optimizeAgentTimingSlots(
  agentId: number
): Promise<TimingOptimizationResult | null> {
  const LOG_PREFIX = "[TimingEngine]";

  try {
    console.log(`${LOG_PREFIX} Optimizing timing slots for agent ${agentId}`);

    // 1. Get the agent
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId));

    if (!agent) {
      console.error(`${LOG_PREFIX} Agent not found: ${agentId}`);
      return null;
    }

    // Parse current time slots
    const previousTimeSlots: string[] = agent.postingTimeSlots
      ? safeParseJson<string[]>(agent.postingTimeSlots, [])
      : [];

    // 2. Get accounts linked to this agent
    const linkedAccounts = await db
      .select({
        accountId: agentAccounts.accountId,
      })
      .from(agentAccounts)
      .where(
        and(eq(agentAccounts.agentId, agentId), eq(agentAccounts.isActive, 1))
      );

    // 3. Analyze own account optimal times
    const ownAccountSlots: OptimalTimeSlot[] = [];

    for (const link of linkedAccounts) {
      const accountSlots = await analyzeOptimalTimes(
        link.accountId,
        agent.projectId ?? undefined
      );
      ownAccountSlots.push(...accountSlots);
    }

    // 4. Cross-analyze with model accounts
    const modelAccountSlots = await crossAnalyzeWithModelAccounts(agent.userId);

    // 5. Combine and deduplicate: merge own + model, with own data weighted higher
    const combinedHourScores: Map<
      number,
      { ownScore: number; modelScore: number }
    > = new Map();

    for (const slot of ownAccountSlots) {
      const existing = combinedHourScores.get(slot.hour) || {
        ownScore: 0,
        modelScore: 0,
      };
      existing.ownScore = Math.max(existing.ownScore, slot.score);
      combinedHourScores.set(slot.hour, existing);
    }

    for (const slot of modelAccountSlots) {
      const existing = combinedHourScores.get(slot.hour) || {
        ownScore: 0,
        modelScore: 0,
      };
      existing.modelScore = Math.max(existing.modelScore, slot.score);
      combinedHourScores.set(slot.hour, existing);
    }

    // Weight: own analytics = 70%, model account = 30%
    const combinedSlots: OptimalTimeSlot[] = [];

    for (const [hour, scores] of combinedHourScores.entries()) {
      const combinedScore = scores.ownScore * 0.7 + scores.modelScore * 0.3;
      combinedSlots.push({
        hour,
        timeLabel: `${hour.toString().padStart(2, "0")}:00`,
        score: combinedScore,
        source: "combined",
      });
    }

    combinedSlots.sort((a, b) => b.score - a.score);

    // 6. Determine how many time slots to keep (match agent's posting frequency)
    const slotCount = determineSlotCount(agent.postingFrequency);
    const topCombinedSlots = combinedSlots.slice(0, slotCount);

    // 7. Build new time slots array
    const newTimeSlots = topCombinedSlots.map((s) => s.timeLabel);

    // If no data available, keep existing slots
    if (newTimeSlots.length === 0) {
      console.log(
        `${LOG_PREFIX} No timing data available for agent ${agentId}, keeping existing slots`
      );
      return {
        agentId,
        previousTimeSlots,
        newTimeSlots: previousTimeSlots,
        analysis: {
          ownAccountTopHours: ownAccountSlots.slice(0, 5),
          modelAccountTopHours: modelAccountSlots.slice(0, 5),
          combinedTopHours: [],
        },
        updatedAt: new Date().toISOString(),
      };
    }

    // Sort new time slots chronologically
    newTimeSlots.sort();

    // 8. Update the agent's postingTimeSlots
    await db
      .update(agents)
      .set({
        postingTimeSlots: JSON.stringify(newTimeSlots),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    console.log(
      `${LOG_PREFIX} Updated agent ${agentId} time slots: [${previousTimeSlots.join(", ")}] -> [${newTimeSlots.join(", ")}]`
    );

    return {
      agentId,
      previousTimeSlots,
      newTimeSlots,
      analysis: {
        ownAccountTopHours: ownAccountSlots.slice(0, 5),
        modelAccountTopHours: modelAccountSlots.slice(0, 5),
        combinedTopHours: topCombinedSlots,
      },
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `[TimingEngine] Error optimizing timing for agent ${agentId}:`,
      error
    );
    return null;
  }
}

/**
 * Generate a comprehensive timing analysis report for a given account.
 * Returns hourly breakdown, top hours, total posts analyzed, and
 * human-readable recommendations.
 */
export async function getTimingReport(
  accountId: number
): Promise<TimingReport> {
  const LOG_PREFIX = "[TimingEngine]";

  try {
    console.log(
      `${LOG_PREFIX} Generating timing report for account ${accountId}`
    );

    const analysisPeriodDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - analysisPeriodDays);

    // Get analytics data joined with posts
    const analyticsRows = await db
      .select({
        likesCount: postAnalytics.likesCount,
        commentsCount: postAnalytics.commentsCount,
        sharesCount: postAnalytics.sharesCount,
        viewsCount: postAnalytics.viewsCount,
        engagementRate: postAnalytics.engagementRate,
        recordedAt: postAnalytics.recordedAt,
        publishedAt: posts.publishedAt,
        postProjectId: posts.projectId,
      })
      .from(postAnalytics)
      .innerJoin(posts, eq(postAnalytics.postId, posts.id))
      .where(
        and(
          eq(postAnalytics.accountId, accountId),
          gte(postAnalytics.recordedAt, toMySQLTimestamp(cutoffDate))
        )
      )
      .orderBy(desc(postAnalytics.recordedAt));

    // Build hourly breakdown
    const hourlyBuckets: Map<
      number,
      {
        totalEngagement: number;
        totalLikes: number;
        totalComments: number;
        totalShares: number;
        totalViews: number;
        count: number;
      }
    > = new Map();

    for (let h = 0; h < 24; h++) {
      hourlyBuckets.set(h, {
        totalEngagement: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0,
        count: 0,
      });
    }

    let projectId: number | null = null;

    for (const row of analyticsRows) {
      const timestamp = row.publishedAt || row.recordedAt;
      if (!timestamp) continue;

      if (!projectId && row.postProjectId) {
        projectId = row.postProjectId;
      }

      const date = new Date(timestamp);
      const hour = date.getHours();
      const bucket = hourlyBuckets.get(hour)!;

      bucket.totalEngagement += row.engagementRate || 0;
      bucket.totalLikes += row.likesCount || 0;
      bucket.totalComments += row.commentsCount || 0;
      bucket.totalShares += row.sharesCount || 0;
      bucket.totalViews += row.viewsCount || 0;
      bucket.count += 1;
    }

    // Build hourly breakdown array
    const hourlyBreakdown: HourlyEngagement[] = [];

    for (const [hour, bucket] of hourlyBuckets.entries()) {
      hourlyBreakdown.push({
        hour,
        avgEngagementRate:
          bucket.count > 0 ? bucket.totalEngagement / bucket.count : 0,
        avgLikes: bucket.count > 0 ? bucket.totalLikes / bucket.count : 0,
        avgComments:
          bucket.count > 0 ? bucket.totalComments / bucket.count : 0,
        avgShares: bucket.count > 0 ? bucket.totalShares / bucket.count : 0,
        avgViews: bucket.count > 0 ? bucket.totalViews / bucket.count : 0,
        sampleSize: bucket.count,
      });
    }

    // Get top hours from analyzeOptimalTimes
    const topHours = await analyzeOptimalTimes(accountId);

    // Generate recommendations
    const recommendations = generateRecommendations(
      hourlyBreakdown,
      topHours,
      analyticsRows.length
    );

    const report: TimingReport = {
      accountId,
      projectId,
      hourlyBreakdown,
      topHours,
      totalPostsAnalyzed: analyticsRows.length,
      analysisPeriodDays,
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    console.log(
      `${LOG_PREFIX} Timing report generated for account ${accountId}: ${analyticsRows.length} posts analyzed`
    );

    return report;
  } catch (error) {
    console.error(
      `[TimingEngine] Error generating timing report for account ${accountId}:`,
      error
    );

    // Return an empty report on error
    return {
      accountId,
      projectId: null,
      hourlyBreakdown: [],
      topHours: [],
      totalPostsAnalyzed: 0,
      analysisPeriodDays: 30,
      recommendations: [
        "分析データの取得中にエラーが発生しました。しばらく経ってから再度お試しください。",
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

// ==================== Helper Functions ====================

/**
 * Safely parse a JSON string, returning a default value on failure.
 */
function safeParseJson<T>(jsonStr: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Determine how many time slots to generate based on agent posting frequency.
 */
function determineSlotCount(
  frequency: string | null | undefined
): number {
  switch (frequency) {
    case "three_times_daily":
      return 3;
    case "twice_daily":
      return 2;
    case "daily":
      return 1;
    case "weekly":
      return 1;
    case "custom":
      return 3; // Default for custom
    default:
      return 3; // Default to 3 slots
  }
}

/**
 * Generate human-readable timing recommendations based on the analysis.
 */
function generateRecommendations(
  hourlyBreakdown: HourlyEngagement[],
  topHours: OptimalTimeSlot[],
  totalPosts: number
): string[] {
  const recommendations: string[] = [];

  if (totalPosts === 0) {
    recommendations.push(
      "投稿データがまだありません。投稿を続けることで、最適な投稿時間帯の分析精度が向上します。"
    );
    return recommendations;
  }

  if (totalPosts < 10) {
    recommendations.push(
      `分析対象の投稿が${totalPosts}件と少ないため、推奨結果の信頼度は限定的です。20件以上の投稿データがあると、より正確な分析が可能になります。`
    );
  }

  // Top hours recommendation
  if (topHours.length > 0) {
    const topTimeLabels = topHours.slice(0, 3).map((s) => s.timeLabel);
    recommendations.push(
      `エンゲージメントが最も高い時間帯: ${topTimeLabels.join("、")}。この時間帯に投稿することを推奨します。`
    );
  }

  // Identify time periods with highest engagement
  const morningSlots = hourlyBreakdown.filter(
    (h) => h.hour >= 6 && h.hour < 12 && h.sampleSize > 0
  );
  const afternoonSlots = hourlyBreakdown.filter(
    (h) => h.hour >= 12 && h.hour < 18 && h.sampleSize > 0
  );
  const eveningSlots = hourlyBreakdown.filter(
    (h) => h.hour >= 18 && h.hour < 24 && h.sampleSize > 0
  );
  const nightSlots = hourlyBreakdown.filter(
    (h) => (h.hour >= 0 && h.hour < 6) && h.sampleSize > 0
  );

  const periodAvgs = [
    {
      name: "朝（6-12時）",
      avg: calculatePeriodAvg(morningSlots),
      count: morningSlots.reduce((s, h) => s + h.sampleSize, 0),
    },
    {
      name: "午後（12-18時）",
      avg: calculatePeriodAvg(afternoonSlots),
      count: afternoonSlots.reduce((s, h) => s + h.sampleSize, 0),
    },
    {
      name: "夕方～夜（18-24時）",
      avg: calculatePeriodAvg(eveningSlots),
      count: eveningSlots.reduce((s, h) => s + h.sampleSize, 0),
    },
    {
      name: "深夜（0-6時）",
      avg: calculatePeriodAvg(nightSlots),
      count: nightSlots.reduce((s, h) => s + h.sampleSize, 0),
    },
  ];

  const bestPeriod = periodAvgs
    .filter((p) => p.count > 0)
    .sort((a, b) => b.avg - a.avg)[0];

  if (bestPeriod) {
    recommendations.push(
      `時間帯別では「${bestPeriod.name}」が最も高いエンゲージメントを記録しています。`
    );
  }

  // Check for time gaps - hours with no posts
  const emptyHours = hourlyBreakdown.filter(
    (h) => h.sampleSize === 0 && h.hour >= 7 && h.hour <= 22
  );
  if (emptyHours.length > 5) {
    recommendations.push(
      "投稿していない時間帯が多いため、異なる時間帯でのテスト投稿を検討してください。隠れた高パフォーマンス時間帯が見つかる可能性があります。"
    );
  }

  return recommendations;
}

/**
 * Calculate the average engagement rate for a period's hourly slots.
 */
function calculatePeriodAvg(slots: HourlyEngagement[]): number {
  if (slots.length === 0) return 0;
  const totalWeighted = slots.reduce(
    (sum, s) => sum + s.avgEngagementRate * s.sampleSize,
    0
  );
  const totalSamples = slots.reduce((sum, s) => sum + s.sampleSize, 0);
  return totalSamples > 0 ? totalWeighted / totalSamples : 0;
}
