/**
 * Hashtag Analyzer Service
 *
 * Analyzes hashtag performance by parsing hashtags from posts
 * and aggregating their metrics across accounts and projects.
 */

import { db } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";

/**
 * Parse hashtags from post content.
 * Extracts all #hashtag patterns and returns them without the # prefix.
 */
export function parseHashtags(content: string): string[] {
  const regex = /#([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]+)/g;
  const hashtags: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!hashtags.includes(tag)) {
      hashtags.push(tag);
    }
  }

  return hashtags;
}

/**
 * Update hashtag performance when a post gets metrics.
 *
 * For each hashtag found in the content:
 * - Upserts into the hashtagPerformance table
 * - Updates running averages using the formula: newAvg = ((oldAvg * (count-1)) + newValue) / count
 * - Updates bestPerformingPostId if this post has higher engagement
 * - Updates trendScore based on recency and performance
 */
export async function updateHashtagPerformance(
  postId: number,
  accountId: number,
  projectId: number | null,
  content: string,
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
  }
): Promise<void> {
  const hashtags = parseHashtags(content);
  if (hashtags.length === 0) return;

  for (const hashtag of hashtags) {
    // Look for an existing record for this hashtag + account + project combination
    const conditions = [
      eq(schema.hashtagPerformance.hashtag, hashtag),
    ];

    if (accountId) {
      conditions.push(eq(schema.hashtagPerformance.accountId, accountId));
    }

    if (projectId !== null) {
      conditions.push(eq(schema.hashtagPerformance.projectId, projectId));
    } else {
      conditions.push(sql`${schema.hashtagPerformance.projectId} IS NULL`);
    }

    const [existing] = await db
      .select()
      .from(schema.hashtagPerformance)
      .where(and(...conditions));

    const now = new Date().toISOString();

    if (existing) {
      const newCount = existing.usageCount + 1;
      const oldCount = existing.usageCount;

      // Calculate running averages: newAvg = ((oldAvg * (count-1)) + newValue) / count
      const newAvgLikes = Math.round(
        ((existing.avgLikes * oldCount) + metrics.likes) / newCount
      );
      const newAvgComments = Math.round(
        ((existing.avgComments * oldCount) + metrics.comments) / newCount
      );
      const newAvgShares = Math.round(
        ((existing.avgShares * oldCount) + metrics.shares) / newCount
      );
      const newAvgEngagementRate = Math.round(
        ((existing.avgEngagementRate * oldCount) + metrics.engagementRate) / newCount
      );

      // Update bestPerformingPostId if this post has higher engagement
      const bestPostId =
        metrics.engagementRate > existing.avgEngagementRate
          ? postId
          : existing.bestPerformingPostId;

      // Calculate trend score based on recency and performance
      const trendScore = calculateTrendScore(
        newAvgEngagementRate,
        newCount,
        now
      );

      await db
        .update(schema.hashtagPerformance)
        .set({
          usageCount: newCount,
          avgLikes: newAvgLikes,
          avgComments: newAvgComments,
          avgShares: newAvgShares,
          avgEngagementRate: newAvgEngagementRate,
          bestPerformingPostId: bestPostId,
          trendScore,
          lastUsedAt: now,
        })
        .where(eq(schema.hashtagPerformance.id, existing.id));
    } else {
      // Insert new hashtag performance record
      const trendScore = calculateTrendScore(
        metrics.engagementRate,
        1,
        now
      );

      await db.insert(schema.hashtagPerformance).values({
        hashtag,
        accountId,
        projectId,
        usageCount: 1,
        avgLikes: metrics.likes,
        avgComments: metrics.comments,
        avgShares: metrics.shares,
        avgEngagementRate: metrics.engagementRate,
        bestPerformingPostId: postId,
        trendScore,
        lastUsedAt: now,
      });
    }
  }
}

/**
 * Calculate a trend score (0-100) based on engagement rate, usage count, and recency.
 * Higher engagement, more usage, and more recent usage all contribute positively.
 */
function calculateTrendScore(
  avgEngagementRate: number,
  usageCount: number,
  lastUsedAt: string
): number {
  // Engagement component: normalized engagement rate (cap at 50 points)
  const engagementComponent = Math.min(avgEngagementRate / 10, 50);

  // Usage component: more usage = more reliable data (cap at 25 points)
  const usageComponent = Math.min(usageCount * 2.5, 25);

  // Recency component: more recent = higher score (cap at 25 points)
  const daysSinceLastUse =
    (Date.now() - new Date(lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyComponent = Math.max(25 - daysSinceLastUse, 0);

  return Math.round(
    Math.min(engagementComponent + usageComponent + recencyComponent, 100)
  );
}

/**
 * Get top performing hashtags for an account/project.
 */
export async function getTopHashtags(options: {
  accountId?: number;
  projectId?: number;
  limit?: number;
  sortBy?: "engagement" | "usage" | "trend";
}): Promise<
  Array<{
    hashtag: string;
    usageCount: number;
    avgLikes: number;
    avgEngagementRate: number;
    trendScore: number;
  }>
> {
  const { accountId, projectId, limit = 20, sortBy = "engagement" } = options;

  const conditions = [];
  if (accountId !== undefined) {
    conditions.push(eq(schema.hashtagPerformance.accountId, accountId));
  }
  if (projectId !== undefined) {
    conditions.push(eq(schema.hashtagPerformance.projectId, projectId));
  }

  const orderColumn =
    sortBy === "usage"
      ? desc(schema.hashtagPerformance.usageCount)
      : sortBy === "trend"
        ? desc(schema.hashtagPerformance.trendScore)
        : desc(schema.hashtagPerformance.avgEngagementRate);

  const results = await db
    .select({
      hashtag: schema.hashtagPerformance.hashtag,
      usageCount: schema.hashtagPerformance.usageCount,
      avgLikes: schema.hashtagPerformance.avgLikes,
      avgEngagementRate: schema.hashtagPerformance.avgEngagementRate,
      trendScore: schema.hashtagPerformance.trendScore,
    })
    .from(schema.hashtagPerformance)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderColumn)
    .limit(limit);

  return results;
}

/**
 * Get hashtag combination analysis - which hashtags work well together.
 *
 * Analyzes scheduledPosts and buzzPosts to find hashtag sets that co-occur
 * and correlates them with engagement metrics.
 */
export async function getHashtagCombinations(options: {
  accountId?: number;
  projectId?: number;
  limit?: number;
}): Promise<
  Array<{
    hashtags: string[];
    avgEngagementRate: number;
    usageCount: number;
  }>
> {
  const { accountId, projectId, limit = 10 } = options;

  // Gather hashtag sets from scheduled posts that have been posted
  const postConditions = [eq(schema.scheduledPosts.status, "posted")];
  if (accountId !== undefined) {
    postConditions.push(eq(schema.scheduledPosts.accountId, accountId));
  }
  if (projectId !== undefined) {
    postConditions.push(eq(schema.scheduledPosts.projectId, projectId));
  }

  const postedPosts = await db
    .select({
      id: schema.scheduledPosts.id,
      content: schema.scheduledPosts.content,
      hashtags: schema.scheduledPosts.hashtags,
    })
    .from(schema.scheduledPosts)
    .where(and(...postConditions));

  // Also gather from buzz posts
  const buzzConditions = [];
  if (projectId !== undefined) {
    buzzConditions.push(eq(schema.buzzPosts.projectId, projectId));
  }
  if (accountId !== undefined) {
    buzzConditions.push(eq(schema.buzzPosts.sourceAccountId, accountId));
  }

  const buzzPostsList = await db
    .select({
      id: schema.buzzPosts.id,
      content: schema.buzzPosts.content,
      hashtags: schema.buzzPosts.hashtags,
      likesCount: schema.buzzPosts.likesCount,
      commentsCount: schema.buzzPosts.commentsCount,
      sharesCount: schema.buzzPosts.sharesCount,
      engagementRate: schema.buzzPosts.engagementRate,
    })
    .from(schema.buzzPosts)
    .where(buzzConditions.length > 0 ? and(...buzzConditions) : undefined);

  // Build a map of hashtag combinations -> engagement data
  const combinationMap = new Map<
    string,
    { hashtags: string[]; totalEngagement: number; count: number }
  >();

  // Process scheduled posts
  for (const post of postedPosts) {
    const tags = extractHashtagsFromPost(post.content, post.hashtags);
    if (tags.length < 2) continue;

    // Get analytics for this post if available
    const [analytics] = await db
      .select()
      .from(schema.postAnalytics)
      .where(eq(schema.postAnalytics.postId, post.id))
      .orderBy(desc(schema.postAnalytics.recordedAt))
      .limit(1);

    const engagement = analytics?.engagementRate ?? 0;
    const key = tags.sort().join(",");

    const existing = combinationMap.get(key);
    if (existing) {
      existing.totalEngagement += engagement;
      existing.count += 1;
    } else {
      combinationMap.set(key, {
        hashtags: tags.sort(),
        totalEngagement: engagement,
        count: 1,
      });
    }
  }

  // Process buzz posts
  for (const post of buzzPostsList) {
    const tags = extractHashtagsFromPost(post.content, post.hashtags);
    if (tags.length < 2) continue;

    const engagement = post.engagementRate ?? 0;
    const key = tags.sort().join(",");

    const existing = combinationMap.get(key);
    if (existing) {
      existing.totalEngagement += engagement;
      existing.count += 1;
    } else {
      combinationMap.set(key, {
        hashtags: tags.sort(),
        totalEngagement: engagement,
        count: 1,
      });
    }
  }

  // Convert to result array and sort by average engagement rate
  const results = Array.from(combinationMap.values())
    .map((entry) => ({
      hashtags: entry.hashtags,
      avgEngagementRate:
        entry.count > 0
          ? Math.round(entry.totalEngagement / entry.count)
          : 0,
      usageCount: entry.count,
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, limit);

  return results;
}

/**
 * Extract hashtags from a post's content and/or hashtags JSON field.
 */
function extractHashtagsFromPost(
  content: string,
  hashtagsJson: string | null
): string[] {
  const tagsFromContent = parseHashtags(content);

  // Also parse hashtags from the JSON field if available
  if (hashtagsJson) {
    try {
      const parsed = JSON.parse(hashtagsJson);
      if (Array.isArray(parsed)) {
        for (const tag of parsed) {
          const normalized =
            typeof tag === "string"
              ? tag.replace(/^#/, "").toLowerCase()
              : "";
          if (normalized && !tagsFromContent.includes(normalized)) {
            tagsFromContent.push(normalized);
          }
        }
      }
    } catch {
      // Ignore invalid JSON
    }
  }

  return tagsFromContent;
}

/**
 * Compare own hashtags with model account hashtags.
 *
 * Returns the account's top hashtags, the model accounts' top hashtags,
 * and recommended hashtags the account hasn't used yet but model accounts
 * have found success with.
 */
export async function compareWithModelAccountHashtags(
  accountId: number,
  projectId?: number
): Promise<{
  ownTopHashtags: Array<{ hashtag: string; avgEngagement: number }>;
  modelTopHashtags: Array<{ hashtag: string; avgEngagement: number }>;
  recommended: string[];
}> {
  // Get own top hashtags
  const ownConditions = [
    eq(schema.hashtagPerformance.accountId, accountId),
  ];
  if (projectId !== undefined) {
    ownConditions.push(eq(schema.hashtagPerformance.projectId, projectId));
  }

  const ownHashtags = await db
    .select({
      hashtag: schema.hashtagPerformance.hashtag,
      avgEngagement: schema.hashtagPerformance.avgEngagementRate,
      usageCount: schema.hashtagPerformance.usageCount,
    })
    .from(schema.hashtagPerformance)
    .where(and(...ownConditions))
    .orderBy(desc(schema.hashtagPerformance.avgEngagementRate))
    .limit(20);

  const ownTopHashtags = ownHashtags.map((h) => ({
    hashtag: h.hashtag,
    avgEngagement: h.avgEngagement,
  }));

  // Find model accounts linked to this account (or project)
  const modelAccountIds: number[] = [];

  // Check account-level model account links
  const accountLinks = await db
    .select({ modelAccountId: schema.accountModelAccounts.modelAccountId })
    .from(schema.accountModelAccounts)
    .where(eq(schema.accountModelAccounts.accountId, accountId));

  for (const link of accountLinks) {
    if (!modelAccountIds.includes(link.modelAccountId)) {
      modelAccountIds.push(link.modelAccountId);
    }
  }

  // Also check project-level model account links
  if (projectId !== undefined) {
    const projectLinks = await db
      .select({ modelAccountId: schema.projectModelAccounts.modelAccountId })
      .from(schema.projectModelAccounts)
      .where(eq(schema.projectModelAccounts.projectId, projectId));

    for (const link of projectLinks) {
      if (!modelAccountIds.includes(link.modelAccountId)) {
        modelAccountIds.push(link.modelAccountId);
      }
    }
  }

  if (modelAccountIds.length === 0) {
    return {
      ownTopHashtags,
      modelTopHashtags: [],
      recommended: [],
    };
  }

  // Get buzz posts from model accounts and extract their hashtags
  const modelBuzzPosts = await db
    .select({
      content: schema.buzzPosts.content,
      hashtags: schema.buzzPosts.hashtags,
      engagementRate: schema.buzzPosts.engagementRate,
    })
    .from(schema.buzzPosts)
    .where(
      and(
        eq(schema.buzzPosts.sourceType, "model_account"),
        inArray(schema.buzzPosts.modelAccountId, modelAccountIds)
      )
    )
    .orderBy(desc(schema.buzzPosts.engagementRate))
    .limit(200);

  // Aggregate model account hashtag performance
  const modelHashtagMap = new Map<
    string,
    { totalEngagement: number; count: number }
  >();

  for (const post of modelBuzzPosts) {
    const tags = extractHashtagsFromPost(post.content, post.hashtags);
    const engagement = post.engagementRate ?? 0;

    for (const tag of tags) {
      const existing = modelHashtagMap.get(tag);
      if (existing) {
        existing.totalEngagement += engagement;
        existing.count += 1;
      } else {
        modelHashtagMap.set(tag, {
          totalEngagement: engagement,
          count: 1,
        });
      }
    }
  }

  // Sort model hashtags by average engagement
  const modelTopHashtags = Array.from(modelHashtagMap.entries())
    .map(([hashtag, data]) => ({
      hashtag,
      avgEngagement:
        data.count > 0
          ? Math.round(data.totalEngagement / data.count)
          : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 20);

  // Find recommended hashtags: model hashtags the account hasn't used
  const ownHashtagSet = new Set(ownHashtags.map((h) => h.hashtag));
  const recommended = modelTopHashtags
    .filter((h) => !ownHashtagSet.has(h.hashtag))
    .slice(0, 10)
    .map((h) => h.hashtag);

  return {
    ownTopHashtags,
    modelTopHashtags,
    recommended,
  };
}
