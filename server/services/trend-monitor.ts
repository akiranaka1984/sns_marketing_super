/**
 * Trend Monitor Service
 *
 * Real-time trend detection and response service for the SNS Marketing platform.
 * Detects trending topics/hashtags from buzz posts and model accounts,
 * scores their brand relevance, and generates trend-aware content responses.
 */

import { db } from "../db";
import {
  trackedTrends,
  trendResponsePosts,
  buzzPosts,
  modelAccounts,
  projects,
  agents,
  scheduledPosts,
  accounts,
  agentAccounts,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql, count, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { generateContent, buildAgentContext } from "../agent-engine";

// ============================================
// Constants
// ============================================

const LOG_PREFIX = "[TrendMonitor]";
const MONITOR_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
const HASHTAG_TRENDING_THRESHOLD = 3; // Minimum occurrences to consider trending
const RELEVANCE_THRESHOLD = 70; // Minimum score to trigger a response
const FAST_TRACK_MINUTES = 30; // Schedule trend response within 30 minutes
const TREND_EXPIRY_HOURS = 24; // Trends expire after 24 hours

let monitorInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// ============================================
// Trend Detection
// ============================================

/**
 * Detect trends from recent buzz posts (last 24h) by analyzing common hashtags/topics.
 * Groups by hashtag frequency and identifies trending ones (>3 occurrences).
 * Saves new trends to trackedTrends.
 */
export async function detectTrendsFromBuzzPosts(userId: number): Promise<number> {
  try {
    console.log(`${LOG_PREFIX} Detecting trends from buzz posts for user ${userId}`);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Fetch recent buzz posts
    const recentBuzz = await db
      .select({
        id: buzzPosts.id,
        hashtags: buzzPosts.hashtags,
        content: buzzPosts.content,
        platform: buzzPosts.platform,
        projectId: buzzPosts.projectId,
      })
      .from(buzzPosts)
      .where(
        and(
          eq(buzzPosts.userId, userId),
          gte(buzzPosts.createdAt, twentyFourHoursAgo.toISOString())
        )
      )
      .orderBy(desc(buzzPosts.createdAt));

    if (recentBuzz.length === 0) {
      console.log(`${LOG_PREFIX} No recent buzz posts found`);
      return 0;
    }

    // Count hashtag occurrences
    const hashtagCounts = new Map<string, { count: number; platform: string; projectId: number | null }>();

    for (const post of recentBuzz) {
      let hashtags: string[] = [];
      if (post.hashtags) {
        try {
          hashtags = JSON.parse(post.hashtags);
        } catch {
          // If not valid JSON, try splitting by common delimiters
          hashtags = post.hashtags.split(/[,\s#]+/).filter(Boolean);
        }
      }

      for (const tag of hashtags) {
        const normalizedTag = tag.toLowerCase().replace(/^#/, "").trim();
        if (!normalizedTag) continue;

        const existing = hashtagCounts.get(normalizedTag);
        if (existing) {
          existing.count++;
        } else {
          hashtagCounts.set(normalizedTag, {
            count: 1,
            platform: post.platform,
            projectId: post.projectId,
          });
        }
      }
    }

    // Filter to trending hashtags (above threshold)
    const trendingHashtags = Array.from(hashtagCounts.entries())
      .filter(([_, data]) => data.count >= HASHTAG_TRENDING_THRESHOLD)
      .sort((a, b) => b[1].count - a[1].count);

    let newTrendsCount = 0;

    for (const [hashtag, data] of trendingHashtags) {
      try {
        // Check if this trend already exists and is still active
        const existingTrend = await db.query.trackedTrends.findFirst({
          where: and(
            eq(trackedTrends.userId, userId),
            eq(trackedTrends.trendName, `#${hashtag}`),
            inArray(trackedTrends.status, ["detected", "evaluating", "responding"])
          ),
        });

        if (existingTrend) {
          // Update trending score for existing trend
          await db
            .update(trackedTrends)
            .set({
              trendingScore: Math.min(100, data.count * 15),
              volumeEstimate: data.count,
              updatedAt: toMySQLTimestamp(new Date()),
            })
            .where(eq(trackedTrends.id, existingTrend.id));
          continue;
        }

        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + TREND_EXPIRY_HOURS);

        // Insert new trend
        await db.insert(trackedTrends).values({
          userId,
          projectId: data.projectId,
          trendName: `#${hashtag}`,
          trendType: "hashtag",
          platform: data.platform as "twitter" | "tiktok" | "instagram" | "facebook",
          source: "buzz_analysis",
          trendingScore: Math.min(100, data.count * 15),
          volumeEstimate: data.count,
          status: "detected",
          expiresAt: expiresAt.toISOString(),
        });

        newTrendsCount++;
        console.log(`${LOG_PREFIX} New trend detected: #${hashtag} (${data.count} occurrences)`);
      } catch (error) {
        console.error(`${LOG_PREFIX} Error saving trend #${hashtag}:`, error);
      }
    }

    console.log(`${LOG_PREFIX} Detected ${newTrendsCount} new trends from buzz posts`);
    return newTrendsCount;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error detecting trends from buzz posts:`, error);
    return 0;
  }
}

/**
 * Detect trends from model accounts by analyzing topics/hashtags they are all talking about.
 * Saves new trends to trackedTrends.
 */
export async function detectTrendsFromModelAccounts(userId: number): Promise<number> {
  try {
    console.log(`${LOG_PREFIX} Detecting trends from model accounts for user ${userId}`);

    // Get active model accounts for this user
    const activeModels = await db
      .select()
      .from(modelAccounts)
      .where(
        and(
          eq(modelAccounts.userId, userId),
          eq(modelAccounts.isActive, 1)
        )
      );

    if (activeModels.length === 0) {
      console.log(`${LOG_PREFIX} No active model accounts found`);
      return 0;
    }

    const modelIds = activeModels.map((m) => m.id);

    // Get recent buzz posts from model accounts (last 24h)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const modelBuzzPosts = await db
      .select({
        id: buzzPosts.id,
        hashtags: buzzPosts.hashtags,
        content: buzzPosts.content,
        platform: buzzPosts.platform,
        modelAccountId: buzzPosts.modelAccountId,
        projectId: buzzPosts.projectId,
      })
      .from(buzzPosts)
      .where(
        and(
          eq(buzzPosts.sourceType, "model_account"),
          inArray(buzzPosts.modelAccountId, modelIds),
          gte(buzzPosts.createdAt, twentyFourHoursAgo.toISOString())
        )
      );

    if (modelBuzzPosts.length === 0) {
      console.log(`${LOG_PREFIX} No recent model account posts found`);
      return 0;
    }

    // Track hashtags per model account to find cross-account trends
    const hashtagToModels = new Map<string, Set<number>>();
    const hashtagPlatform = new Map<string, string>();
    const hashtagProjectId = new Map<string, number | null>();

    for (const post of modelBuzzPosts) {
      let hashtags: string[] = [];
      if (post.hashtags) {
        try {
          hashtags = JSON.parse(post.hashtags);
        } catch {
          hashtags = post.hashtags.split(/[,\s#]+/).filter(Boolean);
        }
      }

      for (const tag of hashtags) {
        const normalizedTag = tag.toLowerCase().replace(/^#/, "").trim();
        if (!normalizedTag) continue;

        if (!hashtagToModels.has(normalizedTag)) {
          hashtagToModels.set(normalizedTag, new Set());
        }
        if (post.modelAccountId) {
          hashtagToModels.get(normalizedTag)!.add(post.modelAccountId);
        }
        hashtagPlatform.set(normalizedTag, post.platform);
        hashtagProjectId.set(normalizedTag, post.projectId);
      }
    }

    // Identify topics that multiple model accounts are talking about
    const crossAccountTrends = Array.from(hashtagToModels.entries())
      .filter(([_, modelSet]) => modelSet.size >= 2) // At least 2 model accounts
      .sort((a, b) => b[1].size - a[1].size);

    let newTrendsCount = 0;

    for (const [hashtag, modelSet] of crossAccountTrends) {
      try {
        // Check if already tracked
        const existingTrend = await db.query.trackedTrends.findFirst({
          where: and(
            eq(trackedTrends.userId, userId),
            eq(trackedTrends.trendName, `#${hashtag}`),
            inArray(trackedTrends.status, ["detected", "evaluating", "responding"])
          ),
        });

        if (existingTrend) {
          await db
            .update(trackedTrends)
            .set({
              trendingScore: Math.min(100, modelSet.size * 25),
              volumeEstimate: modelSet.size,
              updatedAt: toMySQLTimestamp(new Date()),
            })
            .where(eq(trackedTrends.id, existingTrend.id));
          continue;
        }

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + TREND_EXPIRY_HOURS);

        const platform = hashtagPlatform.get(hashtag) || "twitter";

        await db.insert(trackedTrends).values({
          userId,
          projectId: hashtagProjectId.get(hashtag),
          trendName: `#${hashtag}`,
          trendType: "hashtag",
          platform: platform as "twitter" | "tiktok" | "instagram" | "facebook",
          source: "model_account",
          trendingScore: Math.min(100, modelSet.size * 25),
          volumeEstimate: modelSet.size,
          status: "detected",
          expiresAt: expiresAt.toISOString(),
        });

        newTrendsCount++;
        console.log(
          `${LOG_PREFIX} New model-account trend detected: #${hashtag} (${modelSet.size} model accounts)`
        );
      } catch (error) {
        console.error(`${LOG_PREFIX} Error saving model trend #${hashtag}:`, error);
      }
    }

    console.log(`${LOG_PREFIX} Detected ${newTrendsCount} new trends from model accounts`);
    return newTrendsCount;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error detecting trends from model accounts:`, error);
    return 0;
  }
}

// ============================================
// Brand Relevance Scoring
// ============================================

/**
 * Score how relevant a trend is to a project's brand/strategy.
 * Uses LLM to analyze the trend against the project's objective, strategy, and agent themes.
 * Updates trackedTrends.relevanceScore and returns the score.
 */
export async function scoreTrendRelevance(
  trendId: number,
  projectId: number
): Promise<number> {
  try {
    console.log(`${LOG_PREFIX} Scoring relevance for trend ${trendId}, project ${projectId}`);

    // Get the trend
    const trend = await db.query.trackedTrends.findFirst({
      where: eq(trackedTrends.id, trendId),
    });

    if (!trend) {
      console.error(`${LOG_PREFIX} Trend ${trendId} not found`);
      return 0;
    }

    // Get project info
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      console.error(`${LOG_PREFIX} Project ${projectId} not found`);
      return 0;
    }

    // Get project's agents and their themes
    const projectAgents = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.projectId, projectId),
          eq(agents.isActive, 1)
        )
      );

    const agentThemes = projectAgents.map((a) => a.theme).join(", ");

    // Update status to evaluating
    await db
      .update(trackedTrends)
      .set({ status: "evaluating", updatedAt: toMySQLTimestamp(new Date()) })
      .where(eq(trackedTrends.id, trendId));

    // Use LLM to score relevance
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an SNS marketing strategist. Evaluate how relevant a trending topic is to a brand's strategy. Return a JSON score.",
        },
        {
          role: "user",
          content: `Evaluate the relevance of this trend to the brand.

Trend: "${trend.trendName}" (type: ${trend.trendType}, platform: ${trend.platform})
Trending Score: ${trend.trendingScore}/100

Brand/Project Info:
- Project Name: ${project.name}
- Objective: ${project.objective}
- Description: ${project.description || "N/A"}

Agent Themes: ${agentThemes || "N/A"}

Score the relevance from 0 to 100:
- 0-30: Not relevant, unrelated to the brand
- 31-50: Marginally relevant, could stretch to fit
- 51-70: Moderately relevant, shares some themes
- 71-90: Highly relevant, directly aligns with brand
- 91-100: Perfect fit, core topic of the brand

Respond in JSON:
{
  "score": <number 0-100>,
  "reasoning": "<why this score>",
  "suggestedAngle": "<how the brand could approach this trend>"
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "trend_relevance",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "integer", description: "Relevance score 0-100" },
              reasoning: { type: "string", description: "Reasoning for the score" },
              suggestedAngle: {
                type: "string",
                description: "Suggested approach angle",
              },
            },
            required: ["score", "reasoning", "suggestedAngle"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(
      typeof messageContent === "string" ? messageContent : "{}"
    );

    const score = Math.max(0, Math.min(100, result.score || 0));

    // Update the trend with the relevance score
    await db
      .update(trackedTrends)
      .set({
        relevanceScore: score,
        status: "detected", // Reset to detected after evaluation
        updatedAt: toMySQLTimestamp(new Date()),
      })
      .where(eq(trackedTrends.id, trendId));

    console.log(
      `${LOG_PREFIX} Trend "${trend.trendName}" scored ${score}/100 for project ${projectId}: ${result.reasoning}`
    );

    return score;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error scoring trend relevance:`, error);

    // Reset status on error
    try {
      await db
        .update(trackedTrends)
        .set({ status: "detected", updatedAt: toMySQLTimestamp(new Date()) })
        .where(eq(trackedTrends.id, trendId));
    } catch {
      // Ignore cleanup error
    }

    return 0;
  }
}

// ============================================
// Trend Response
// ============================================

/**
 * Respond to a trend by generating trend-aware content and scheduling it.
 * Only responds if relevanceScore >= 70.
 * Creates a scheduledPost with fast-track timing (within 30 min).
 * Saves to trendResponsePosts and updates trend status to 'responded'.
 */
export async function respondToTrend(
  trendId: number,
  projectId: number
): Promise<{ success: boolean; scheduledPostId?: number; error?: string }> {
  try {
    console.log(`${LOG_PREFIX} Responding to trend ${trendId} for project ${projectId}`);

    // Get the trend
    const trend = await db.query.trackedTrends.findFirst({
      where: eq(trackedTrends.id, trendId),
    });

    if (!trend) {
      return { success: false, error: "Trend not found" };
    }

    // Check relevance threshold
    if (trend.relevanceScore < RELEVANCE_THRESHOLD) {
      console.log(
        `${LOG_PREFIX} Trend "${trend.trendName}" relevance ${trend.relevanceScore} below threshold ${RELEVANCE_THRESHOLD}, skipping`
      );
      return {
        success: false,
        error: `Relevance score ${trend.relevanceScore} below threshold ${RELEVANCE_THRESHOLD}`,
      };
    }

    // Update status to responding
    await db
      .update(trackedTrends)
      .set({ status: "responding", updatedAt: toMySQLTimestamp(new Date()) })
      .where(eq(trackedTrends.id, trendId));

    // Get the project's active agent
    const projectAgent = await db.query.agents.findFirst({
      where: and(
        eq(agents.projectId, projectId),
        eq(agents.isActive, 1)
      ),
      orderBy: desc(agents.createdAt),
    });

    if (!projectAgent) {
      await db
        .update(trackedTrends)
        .set({ status: "detected", updatedAt: toMySQLTimestamp(new Date()) })
        .where(eq(trackedTrends.id, trendId));
      return { success: false, error: "No active agent found for project" };
    }

    // Build agent context
    const context = await buildAgentContext(projectAgent.id);
    if (!context) {
      await db
        .update(trackedTrends)
        .set({ status: "detected", updatedAt: toMySQLTimestamp(new Date()) })
        .where(eq(trackedTrends.id, trendId));
      return { success: false, error: "Failed to build agent context" };
    }

    // Pick a target account from the agent's linked accounts
    if (context.accounts.length === 0) {
      await db
        .update(trackedTrends)
        .set({ status: "detected", updatedAt: toMySQLTimestamp(new Date()) })
        .where(eq(trackedTrends.id, trendId));
      return { success: false, error: "No accounts linked to agent" };
    }

    const targetAccount = context.accounts[0];

    // Inject trend information into the agent's theme temporarily for content generation
    const originalTheme = context.agent.theme;
    context.agent = {
      ...context.agent,
      theme: `${originalTheme}\n\n[TREND ALERT] トレンド「${trend.trendName}」が話題です。このトレンドを取り入れた投稿を作成してください。トレンドに自然に触れつつ、ブランドの視点で価値ある情報を提供してください。ハッシュタグに「${trend.trendName.replace(/^#/, "")}」を含めてください。`,
    };

    // Generate trend-aware content
    const generatedContent = await generateContent(
      context,
      undefined,
      targetAccount.id
    );

    // Ensure the trend hashtag is included
    const trendTag = trend.trendName.replace(/^#/, "");
    if (!generatedContent.hashtags.some((h) => h.toLowerCase() === trendTag.toLowerCase())) {
      generatedContent.hashtags.unshift(trendTag);
    }

    // Schedule the post with fast-track timing (within 30 minutes)
    const scheduledTime = new Date();
    scheduledTime.setMinutes(
      scheduledTime.getMinutes() + Math.floor(Math.random() * FAST_TRACK_MINUTES) + 1
    );

    const fullContent =
      generatedContent.content +
      "\n\n" +
      generatedContent.hashtags.map((h) => `#${h}`).join(" ");

    const [insertResult] = await db.insert(scheduledPosts).values({
      projectId,
      accountId: targetAccount.id,
      agentId: projectAgent.id,
      content: fullContent,
      hashtags: JSON.stringify(generatedContent.hashtags),
      scheduledTime: scheduledTime.toISOString(),
      status: "pending",
      generatedByAgent: 1,
      reviewStatus: "approved", // Fast-track: auto-approved
      contentConfidence: generatedContent.confidence,
    });

    const scheduledPostId = insertResult.insertId;

    // Save to trendResponsePosts
    await db.insert(trendResponsePosts).values({
      trendId,
      scheduledPostId,
      accountId: targetAccount.id,
    });

    // Update trend status to responded
    await db
      .update(trackedTrends)
      .set({
        status: "responded",
        respondedAt: toMySQLTimestamp(new Date()),
        updatedAt: toMySQLTimestamp(new Date()),
      })
      .where(eq(trackedTrends.id, trendId));

    console.log(
      `${LOG_PREFIX} Trend response created: trend="${trend.trendName}", scheduledPostId=${scheduledPostId}, scheduledTime=${scheduledTime.toISOString()}`
    );

    return { success: true, scheduledPostId };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error responding to trend:`, error);

    // Reset status on error
    try {
      await db
        .update(trackedTrends)
        .set({ status: "detected", updatedAt: toMySQLTimestamp(new Date()) })
        .where(eq(trackedTrends.id, trendId));
    } catch {
      // Ignore cleanup error
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Trend Monitor Scheduler
// ============================================

/**
 * Run a full trend monitoring cycle:
 * 1. Detect trends from buzz posts and model accounts
 * 2. Score relevance for each detected trend against all active projects
 * 3. Respond to high-relevance trends
 */
async function runTrendMonitorCycle(): Promise<void> {
  if (isRunning) {
    console.log(`${LOG_PREFIX} Monitor cycle already running, skipping`);
    return;
  }

  isRunning = true;
  console.log(`${LOG_PREFIX} Starting trend monitor cycle`);

  try {
    // Get all active projects and their user IDs
    const activeProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.status, "active"));

    if (activeProjects.length === 0) {
      console.log(`${LOG_PREFIX} No active projects found`);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(activeProjects.map((p) => p.userId))];

    // Step 1: Detect trends for each user
    for (const userId of userIds) {
      try {
        await detectTrendsFromBuzzPosts(userId);
        await detectTrendsFromModelAccounts(userId);
      } catch (error) {
        console.error(`${LOG_PREFIX} Error detecting trends for user ${userId}:`, error);
      }
    }

    // Step 2: Score relevance for unscored trends
    const unscoredTrends = await db
      .select()
      .from(trackedTrends)
      .where(
        and(
          eq(trackedTrends.status, "detected"),
          eq(trackedTrends.relevanceScore, 0)
        )
      );

    for (const trend of unscoredTrends) {
      // Find matching projects for this trend's user
      const userProjects = activeProjects.filter(
        (p) => p.userId === trend.userId
      );

      for (const project of userProjects) {
        // If trend already has a projectId, only score for that project
        if (trend.projectId && trend.projectId !== project.id) continue;

        try {
          await scoreTrendRelevance(trend.id, project.id);
        } catch (error) {
          console.error(
            `${LOG_PREFIX} Error scoring trend ${trend.id} for project ${project.id}:`,
            error
          );
        }
      }
    }

    // Step 3: Respond to high-relevance trends
    const highRelevanceTrends = await db
      .select()
      .from(trackedTrends)
      .where(
        and(
          eq(trackedTrends.status, "detected"),
          gte(trackedTrends.relevanceScore, RELEVANCE_THRESHOLD)
        )
      );

    for (const trend of highRelevanceTrends) {
      // Determine which project to respond with
      const targetProjectId = trend.projectId;
      if (!targetProjectId) {
        // Find the best-fitting project for this user
        const userProject = activeProjects.find(
          (p) => p.userId === trend.userId
        );
        if (!userProject) continue;

        try {
          await respondToTrend(trend.id, userProject.id);
        } catch (error) {
          console.error(
            `${LOG_PREFIX} Error responding to trend ${trend.id}:`,
            error
          );
        }
      } else {
        try {
          await respondToTrend(trend.id, targetProjectId);
        } catch (error) {
          console.error(
            `${LOG_PREFIX} Error responding to trend ${trend.id}:`,
            error
          );
        }
      }
    }

    // Expire old trends
    const expiredThreshold = new Date();
    await db
      .update(trackedTrends)
      .set({ status: "expired", updatedAt: toMySQLTimestamp(new Date()) })
      .where(
        and(
          inArray(trackedTrends.status, ["detected", "evaluating"]),
          sql`${trackedTrends.expiresAt} IS NOT NULL AND ${trackedTrends.expiresAt} < ${toMySQLTimestamp(expiredThreshold)}`
        )
      );

    console.log(`${LOG_PREFIX} Trend monitor cycle complete`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in trend monitor cycle:`, error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the trend monitor scheduler. Runs every 30 minutes.
 */
export function startTrendMonitor(): void {
  if (monitorInterval) {
    console.log(`${LOG_PREFIX} Trend monitor already running`);
    return;
  }

  console.log(
    `${LOG_PREFIX} Starting trend monitor (interval: ${MONITOR_INTERVAL_MS / 1000 / 60} minutes)`
  );

  // Run immediately
  runTrendMonitorCycle();

  // Schedule periodic runs
  monitorInterval = setInterval(() => {
    runTrendMonitorCycle();
  }, MONITOR_INTERVAL_MS);
}

/**
 * Stop the trend monitor scheduler.
 */
export function stopTrendMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log(`${LOG_PREFIX} Trend monitor stopped`);
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Get currently active trends, optionally filtered by projectId.
 */
export async function getActiveTrends(projectId?: number): Promise<
  (typeof trackedTrends.$inferSelect)[]
> {
  try {
    const conditions = [
      inArray(trackedTrends.status, ["detected", "evaluating", "responding"]),
    ];

    if (projectId !== undefined) {
      conditions.push(eq(trackedTrends.projectId, projectId));
    }

    const activeTrends = await db
      .select()
      .from(trackedTrends)
      .where(and(...conditions))
      .orderBy(desc(trackedTrends.trendingScore));

    return activeTrends;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting active trends:`, error);
    return [];
  }
}

/**
 * Get a performance report comparing trend-response posts vs normal posts for a project.
 */
export async function getTrendPerformanceReport(projectId: number): Promise<{
  totalTrendPosts: number;
  totalNormalPosts: number;
  avgTrendEngagement: number;
  avgNormalEngagement: number;
  performanceLift: number;
  trendDetails: Array<{
    trendName: string;
    postsCount: number;
    avgEngagement: number;
    respondedAt: string | null;
  }>;
}> {
  try {
    console.log(`${LOG_PREFIX} Generating trend performance report for project ${projectId}`);

    // Get all trend response posts for this project
    const trendPosts = await db
      .select({
        trendId: trendResponsePosts.trendId,
        scheduledPostId: trendResponsePosts.scheduledPostId,
        normalAvgEngagement: trendResponsePosts.normalAvgEngagement,
        trendPostEngagement: trendResponsePosts.trendPostEngagement,
        performanceLift: trendResponsePosts.performanceLift,
      })
      .from(trendResponsePosts)
      .innerJoin(
        scheduledPosts,
        eq(trendResponsePosts.scheduledPostId, scheduledPosts.id)
      )
      .where(eq(scheduledPosts.projectId, projectId));

    // Get all normal (non-trend) scheduled posts for comparison
    const trendScheduledPostIds = trendPosts
      .map((tp) => tp.scheduledPostId)
      .filter((id): id is number => id !== null);

    // Count normal posts and calculate engagement
    const normalPostsResult = await db
      .select({
        totalCount: count(),
      })
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.projectId, projectId),
          eq(scheduledPosts.status, "posted"),
          trendScheduledPostIds.length > 0
            ? sql`${scheduledPosts.id} NOT IN (${sql.join(
                trendScheduledPostIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            : sql`1=1`
        )
      );

    const totalNormalPosts = Number(normalPostsResult[0]?.totalCount ?? 0);
    const totalTrendPosts = trendPosts.length;

    // Calculate average engagements
    let avgTrendEngagement = 0;
    let avgNormalEngagement = 0;

    if (trendPosts.length > 0) {
      const totalTrendEng = trendPosts.reduce(
        (sum, tp) => sum + (tp.trendPostEngagement || 0),
        0
      );
      avgTrendEngagement = Math.round(totalTrendEng / trendPosts.length);

      const totalNormalEng = trendPosts.reduce(
        (sum, tp) => sum + (tp.normalAvgEngagement || 0),
        0
      );
      avgNormalEngagement = Math.round(totalNormalEng / trendPosts.length);
    }

    // Calculate overall performance lift
    const performanceLift =
      avgNormalEngagement > 0
        ? Math.round(
            ((avgTrendEngagement - avgNormalEngagement) / avgNormalEngagement) *
              100
          )
        : 0;

    // Get details per trend
    const trendIds = [...new Set(trendPosts.map((tp) => tp.trendId))];
    const trendDetails: Array<{
      trendName: string;
      postsCount: number;
      avgEngagement: number;
      respondedAt: string | null;
    }> = [];

    for (const trendIdVal of trendIds) {
      try {
        const trend = await db.query.trackedTrends.findFirst({
          where: eq(trackedTrends.id, trendIdVal),
        });

        if (!trend) continue;

        const trendSpecificPosts = trendPosts.filter(
          (tp) => tp.trendId === trendIdVal
        );
        const avgEng =
          trendSpecificPosts.length > 0
            ? Math.round(
                trendSpecificPosts.reduce(
                  (s, tp) => s + (tp.trendPostEngagement || 0),
                  0
                ) / trendSpecificPosts.length
              )
            : 0;

        trendDetails.push({
          trendName: trend.trendName,
          postsCount: trendSpecificPosts.length,
          avgEngagement: avgEng,
          respondedAt: trend.respondedAt,
        });
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Error fetching trend detail for ${trendIdVal}:`,
          error
        );
      }
    }

    const report = {
      totalTrendPosts,
      totalNormalPosts,
      avgTrendEngagement,
      avgNormalEngagement,
      performanceLift,
      trendDetails,
    };

    console.log(
      `${LOG_PREFIX} Performance report: ${totalTrendPosts} trend posts, ${performanceLift}% lift`
    );

    return report;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error generating trend performance report:`, error);
    return {
      totalTrendPosts: 0,
      totalNormalPosts: 0,
      avgTrendEngagement: 0,
      avgNormalEngagement: 0,
      performanceLift: 0,
      trendDetails: [],
    };
  }
}
