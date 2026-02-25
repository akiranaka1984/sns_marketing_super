/**
 * Target Discovery Service
 *
 * Discovers potential target users for engagement based on:
 * - Model account followers
 * - Users who engaged with our posts
 * - Users posting with industry hashtags
 */

import { db } from "../db";
import {
  modelAccounts,
  accountModelAccounts,
  engagementTasks,
  engagementLogs,
  postUrls,
  accounts,
  projects,
} from "../../drizzle/schema";
import { eq, and, desc, gte, sql, inArray, notInArray } from "drizzle-orm";
import {
  getXUserId,
  getXUserProfile,
  getLatestTweetsWithMetrics,
} from "../x-api-service";
import { createLogger } from "../utils/logger";

const logger = createLogger("target-discovery");

// Types
export interface TargetUser {
  username: string;
  userId?: string;
  source: "model_follower" | "post_engager" | "hashtag_user" | "manual";
  relevanceScore: number; // 0-100
  followersCount?: number;
  bio?: string;
  discoveredAt: Date;
  modelAccountId?: number; // If discovered from a model account
}

export interface DiscoveryResult {
  success: boolean;
  targets: TargetUser[];
  error?: string;
}

/**
 * Discover potential targets from model accounts' followers
 * Uses X API to fetch follower data
 */
export async function discoverFromModelAccounts(
  projectId: number,
  limit: number = 20
): Promise<DiscoveryResult> {
  try {
    // Get model accounts linked to this project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return { success: false, targets: [], error: "Project not found" };
    }

    // Get accounts in this project and their linked model accounts
    const projectAccounts = await db.query.projectAccounts.findMany({
      where: eq(projects.id, projectId),
    });

    const accountIds = projectAccounts.map((pa) => pa.accountId);

    if (accountIds.length === 0) {
      return { success: false, targets: [], error: "No accounts in project" };
    }

    // Get model accounts linked to these accounts
    const modelAccountLinks = await db.query.accountModelAccounts.findMany({
      where: inArray(accountModelAccounts.accountId, accountIds),
    });

    const modelAccountIds = modelAccountLinks.map(
      (link) => link.modelAccountId
    );

    if (modelAccountIds.length === 0) {
      return { success: false, targets: [], error: "No model accounts linked" };
    }

    // Fetch model account details
    const modelAccountsData = await db.query.modelAccounts.findMany({
      where: inArray(modelAccounts.id, modelAccountIds),
    });

    const targets: TargetUser[] = [];

    // For each model account, analyze their recent posts to find engaged users
    for (const ma of modelAccountsData) {
      const username = ma.username.replace(/^@/, "");

      try {
        // Get recent tweets from model account with engagement metrics
        const tweets = await getLatestTweetsWithMetrics(username, 10);

        // Extract usernames from replies (most engaged users)
        // Note: X API doesn't directly provide engager usernames in basic tier
        // Instead, we add the model account as a follow target
        targets.push({
          username: username,
          source: "model_follower",
          relevanceScore: 90, // High relevance for model accounts themselves
          followersCount: ma.followersCount ?? undefined,
          bio: ma.bio ?? undefined,
          discoveredAt: new Date(),
          modelAccountId: ma.id,
        });

        logger.info(
          `[TargetDiscovery] Added model account as target: @${username}`
        );
      } catch (err) {
        logger.warn(`[TargetDiscovery] Failed to fetch data for @${username}:`, err);
      }
    }

    return { success: true, targets: targets.slice(0, limit) };
  } catch (err: any) {
    logger.error("[TargetDiscovery] Discovery from model accounts failed:", err);
    return { success: false, targets: [], error: err.message };
  }
}

/**
 * Discover users who engaged with our posts
 * These are high-value targets for follow-back
 */
export async function discoverFromPostEngagers(
  projectId: number,
  limit: number = 20
): Promise<DiscoveryResult> {
  try {
    // Get recent posts from this project
    const recentPosts = await db.query.postUrls.findMany({
      where: eq(postUrls.projectId, projectId),
      orderBy: [desc(postUrls.createdAt)],
      limit: 20,
    });

    if (recentPosts.length === 0) {
      return { success: true, targets: [], error: "No posts found for project" };
    }

    const targets: TargetUser[] = [];

    // Extract usernames from post URLs
    for (const post of recentPosts) {
      // The user who posted is a potential target for reciprocal engagement
      targets.push({
        username: post.username,
        source: "post_engager",
        relevanceScore: 75, // Moderate relevance
        discoveredAt: new Date(),
      });
    }

    // Deduplicate by username
    const uniqueTargets = Array.from(
      new Map(targets.map((t) => [t.username.toLowerCase(), t])).values()
    );

    return { success: true, targets: uniqueTargets.slice(0, limit) };
  } catch (err: any) {
    logger.error("[TargetDiscovery] Discovery from post engagers failed:", err);
    return { success: false, targets: [], error: err.message };
  }
}

/**
 * Discover users posting with relevant hashtags
 */
export async function discoverFromHashtags(
  hashtags: string[],
  limit: number = 20
): Promise<DiscoveryResult> {
  try {
    // Note: Full hashtag search requires Search API access
    // For now, return a placeholder indicating the feature needs API setup
    logger.info(`[TargetDiscovery] Hashtag discovery requested for: ${hashtags.join(", ")}`);

    // This would use the searchTrendingHashtag function when implemented
    return {
      success: true,
      targets: [],
      error: "Hashtag discovery requires X API Search access",
    };
  } catch (err: any) {
    logger.error("[TargetDiscovery] Discovery from hashtags failed:", err);
    return { success: false, targets: [], error: err.message };
  }
}

/**
 * Get users we've already followed (to avoid duplicate follows)
 */
export async function getAlreadyFollowedUsers(
  accountId: number
): Promise<string[]> {
  const followLogs = await db.query.engagementLogs.findMany({
    where: and(
      eq(engagementLogs.accountId, accountId),
      eq(engagementLogs.taskType, "follow"),
      eq(engagementLogs.status, "success")
    ),
  });

  return followLogs
    .map((log) => log.targetUser)
    .filter((u): u is string => u !== null);
}

/**
 * Combined discovery: merge targets from multiple sources
 */
export async function discoverTargets(
  projectId: number,
  options: {
    includeModelFollowers?: boolean;
    includePostEngagers?: boolean;
    includeHashtags?: string[];
    limit?: number;
    excludeAlreadyFollowed?: number; // accountId to check
  } = {}
): Promise<DiscoveryResult> {
  const {
    includeModelFollowers = true,
    includePostEngagers = true,
    includeHashtags = [],
    limit = 50,
    excludeAlreadyFollowed,
  } = options;

  let allTargets: TargetUser[] = [];

  // Gather targets from various sources
  if (includeModelFollowers) {
    const modelResult = await discoverFromModelAccounts(projectId, limit);
    if (modelResult.success) {
      allTargets.push(...modelResult.targets);
    }
  }

  if (includePostEngagers) {
    const engagerResult = await discoverFromPostEngagers(projectId, limit);
    if (engagerResult.success) {
      allTargets.push(...engagerResult.targets);
    }
  }

  if (includeHashtags.length > 0) {
    const hashtagResult = await discoverFromHashtags(includeHashtags, limit);
    if (hashtagResult.success) {
      allTargets.push(...hashtagResult.targets);
    }
  }

  // Deduplicate by username
  const uniqueTargets = Array.from(
    new Map(allTargets.map((t) => [t.username.toLowerCase(), t])).values()
  );

  // Exclude already followed users if requested
  let filteredTargets = uniqueTargets;
  if (excludeAlreadyFollowed) {
    const alreadyFollowed = await getAlreadyFollowedUsers(excludeAlreadyFollowed);
    const alreadyFollowedSet = new Set(
      alreadyFollowed.map((u) => u.toLowerCase())
    );
    filteredTargets = uniqueTargets.filter(
      (t) => !alreadyFollowedSet.has(t.username.toLowerCase())
    );
  }

  // Sort by relevance score (descending)
  filteredTargets.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    success: true,
    targets: filteredTargets.slice(0, limit),
  };
}

/**
 * Score a potential target user based on various factors
 */
export function scoreTarget(profile: {
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  hasAvatar?: boolean;
  hasBio?: boolean;
}): number {
  let score = 50; // Base score

  // Followers/Following ratio (prefer balanced accounts)
  if (profile.followersCount && profile.followingCount) {
    const ratio = profile.followersCount / (profile.followingCount || 1);
    if (ratio >= 0.5 && ratio <= 2) {
      score += 15; // Balanced account
    } else if (ratio > 2) {
      score += 10; // Popular account (less likely to follow back)
    }
  }

  // Activity level
  if (profile.tweetsCount) {
    if (profile.tweetsCount > 100) score += 10;
    if (profile.tweetsCount > 1000) score += 5;
  }

  // Profile completeness
  if (profile.hasAvatar) score += 5;
  if (profile.hasBio) score += 10;

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Add discovered targets to engagement queue
 */
export async function queueTargetsForEngagement(
  projectId: number,
  accountId: number,
  targets: TargetUser[],
  taskType: "follow" | "like" | "comment" = "follow"
): Promise<{ queued: number; skipped: number }> {
  let queued = 0;
  let skipped = 0;

  // Get already queued targets for this account
  const existingTasks = await db.query.engagementTasks.findMany({
    where: and(
      eq(engagementTasks.projectId, projectId),
      eq(engagementTasks.accountId, accountId),
      eq(engagementTasks.taskType, taskType),
      eq(engagementTasks.isActive, 1)
    ),
  });

  const existingUsernames = new Set(
    existingTasks.map((t) => t.targetUser?.toLowerCase())
  );

  for (const target of targets) {
    const username = target.username.toLowerCase();

    if (existingUsernames.has(username)) {
      skipped++;
      continue;
    }

    try {
      await db.insert(engagementTasks).values({
        projectId,
        accountId,
        taskType,
        targetUser: target.username,
        frequency: 1, // Execute once
        isActive: 1,
      });
      queued++;
    } catch (err) {
      logger.error(`[TargetDiscovery] Failed to queue target ${target.username}:`, err);
      skipped++;
    }
  }

  return { queued, skipped };
}
