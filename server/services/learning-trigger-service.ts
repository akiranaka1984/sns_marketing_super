/**
 * Learning Trigger Service
 *
 * Automatically triggers learning from post performance metrics.
 * Evaluates both absolute thresholds and relative performance (vs account average).
 */

import { db } from "../db";
import { postUrls, postAnalytics, scheduledPosts, postPerformanceFeedback } from "../../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { TweetMetrics } from "../x-api-service";
import { addAccountLearning, LearningType, updateLearningUsage } from "./account-learning-service";

// Performance thresholds
export interface PerformanceThresholds {
  // Absolute thresholds for success/failure
  successLikes: number;
  successEngagementRate: number; // percentage * 100 (e.g., 500 = 5%)
  failureLikes: number;
  failureEngagementRate: number;
  // Relative thresholds (vs account average)
  highPerformanceMultiplier: number; // e.g., 1.5 = 150% of average
  lowPerformanceMultiplier: number; // e.g., 0.5 = 50% of average
}

// Default thresholds
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  successLikes: 50,
  successEngagementRate: 500, // 5%
  failureLikes: 5,
  failureEngagementRate: 100, // 1%
  highPerformanceMultiplier: 1.5,
  lowPerformanceMultiplier: 0.5,
};

// Performance evaluation result
export interface PerformanceEvaluation {
  shouldTriggerLearning: boolean;
  learningType: LearningType | null;
  reason: string;
  performanceLevel: 'high' | 'average' | 'low';
  metrics: {
    likes: number;
    engagementRate: number;
    impressions: number;
  };
  comparison?: {
    accountAvgLikes: number;
    accountAvgEngagementRate: number;
    likesRatio: number;
    engagementRatio: number;
  };
}

/**
 * Get account's average performance metrics
 */
export async function getAccountAverageMetrics(
  accountId: number,
  days: number = 30
): Promise<{ avgLikes: number; avgEngagementRate: number; postCount: number }> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  try {
    const analytics = await db
      .select()
      .from(postAnalytics)
      .where(
        and(
          eq(postAnalytics.accountId, accountId),
          gte(postAnalytics.recordedAt, sinceDate.toISOString())
        )
      )
      .orderBy(desc(postAnalytics.recordedAt));

    if (analytics.length === 0) {
      return { avgLikes: 0, avgEngagementRate: 0, postCount: 0 };
    }

    // Group by post to get latest analytics per post
    const postMetrics = new Map<number, typeof postAnalytics.$inferSelect>();
    for (const record of analytics) {
      if (!postMetrics.has(record.postId)) {
        postMetrics.set(record.postId, record);
      }
    }

    const metricsArray = Array.from(postMetrics.values());
    const totalLikes = metricsArray.reduce((sum, m) => sum + m.likesCount, 0);
    const totalEngagement = metricsArray.reduce((sum, m) => sum + m.engagementRate, 0);

    return {
      avgLikes: Math.round(totalLikes / metricsArray.length),
      avgEngagementRate: Math.round(totalEngagement / metricsArray.length),
      postCount: metricsArray.length,
    };
  } catch (error) {
    console.error("[LearningTrigger] Error getting account average metrics:", error);
    return { avgLikes: 0, avgEngagementRate: 0, postCount: 0 };
  }
}

/**
 * Evaluate post performance and determine if learning should be triggered
 */
export async function evaluatePerformance(
  accountId: number,
  metrics: TweetMetrics,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
): Promise<PerformanceEvaluation> {
  const likes = metrics.likeCount;
  const impressions = metrics.impressionCount;

  // Calculate engagement rate (likes + replies + retweets) / impressions * 100
  const engagementRate = impressions > 0
    ? Math.round((likes + metrics.replyCount + metrics.retweetCount) / impressions * 10000)
    : 0;

  // Get account average for comparison
  const accountAvg = await getAccountAverageMetrics(accountId);
  const hasEnoughData = accountAvg.postCount >= 5;

  let shouldTriggerLearning = false;
  let learningType: LearningType | null = null;
  let reason = '';
  let performanceLevel: PerformanceEvaluation['performanceLevel'] = 'average';

  // Check absolute thresholds first
  if (likes >= thresholds.successLikes || engagementRate >= thresholds.successEngagementRate) {
    shouldTriggerLearning = true;
    learningType = 'success_pattern';
    performanceLevel = 'high';
    reason = `High performance: ${likes} likes, ${(engagementRate / 100).toFixed(2)}% engagement`;
  } else if (likes <= thresholds.failureLikes && engagementRate <= thresholds.failureEngagementRate) {
    shouldTriggerLearning = true;
    learningType = 'failure_pattern';
    performanceLevel = 'low';
    reason = `Low performance: ${likes} likes, ${(engagementRate / 100).toFixed(2)}% engagement`;
  }

  // If absolute thresholds didn't trigger, check relative performance
  if (!shouldTriggerLearning && hasEnoughData) {
    const likesRatio = accountAvg.avgLikes > 0 ? likes / accountAvg.avgLikes : 0;
    const engagementRatio = accountAvg.avgEngagementRate > 0 ? engagementRate / accountAvg.avgEngagementRate : 0;

    if (likesRatio >= thresholds.highPerformanceMultiplier || engagementRatio >= thresholds.highPerformanceMultiplier) {
      shouldTriggerLearning = true;
      learningType = 'success_pattern';
      performanceLevel = 'high';
      reason = `Above average: ${likesRatio.toFixed(1)}x likes, ${engagementRatio.toFixed(1)}x engagement (vs ${accountAvg.avgLikes} avg likes)`;
    } else if (likesRatio <= thresholds.lowPerformanceMultiplier && engagementRatio <= thresholds.lowPerformanceMultiplier) {
      shouldTriggerLearning = true;
      learningType = 'failure_pattern';
      performanceLevel = 'low';
      reason = `Below average: ${likesRatio.toFixed(1)}x likes, ${engagementRatio.toFixed(1)}x engagement (vs ${accountAvg.avgLikes} avg likes)`;
    }
  }

  const result: PerformanceEvaluation = {
    shouldTriggerLearning,
    learningType,
    reason: reason || 'Average performance, no learning triggered',
    performanceLevel,
    metrics: {
      likes,
      engagementRate,
      impressions,
    },
  };

  if (hasEnoughData) {
    const likesRatio = accountAvg.avgLikes > 0 ? likes / accountAvg.avgLikes : 0;
    const engagementRatio = accountAvg.avgEngagementRate > 0 ? engagementRate / accountAvg.avgEngagementRate : 0;

    result.comparison = {
      accountAvgLikes: accountAvg.avgLikes,
      accountAvgEngagementRate: accountAvg.avgEngagementRate,
      likesRatio,
      engagementRatio,
    };
  }

  return result;
}

/**
 * Trigger learning from post metrics
 */
export async function triggerLearningFromMetrics(
  postUrlId: number,
  accountId: number,
  metrics: TweetMetrics,
  evaluation: PerformanceEvaluation
): Promise<number | null> {
  if (!evaluation.shouldTriggerLearning || !evaluation.learningType) {
    return null;
  }

  try {
    // Get post content for analysis
    const [postUrl] = await db
      .select()
      .from(postUrls)
      .where(eq(postUrls.id, postUrlId));

    if (!postUrl) {
      console.error(`[LearningTrigger] Post URL ${postUrlId} not found`);
      return null;
    }

    const content = postUrl.postContent || '';

    // Extract content patterns
    const hasEmoji = /[\u{1F600}-\u{1F64F}]/u.test(content);
    const hasQuestion = content.includes('?') || content.includes('\uff1f'); // ? or full-width ?
    const hasHashtag = content.includes('#');
    const contentLength = content.length;
    const hasLineBreaks = content.includes('\n');
    const hashtagCount = (content.match(/#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g) || []).length;

    // Determine title based on performance
    const isSuccess = evaluation.learningType === 'success_pattern';
    const title = isSuccess
      ? `${evaluation.metrics.likes >= 100 ? '\u9ad8' : ''}\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8\u6295\u7a3f\u30d1\u30bf\u30fc\u30f3` // High engagement post pattern
      : `\u4f4e\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8\u6295\u7a3f\u30d1\u30bf\u30fc\u30f3`; // Low engagement post pattern

    // Determine insight
    const insights: string[] = [];
    if (isSuccess) {
      if (hasEmoji) insights.push('\u7d75\u6587\u5b57\u306e\u4f7f\u7528\u304c\u52b9\u679c\u7684'); // Emoji usage effective
      if (hasQuestion) insights.push('\u8cea\u554f\u5f62\u5f0f\u304c\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8\u3092\u4fc3\u9032'); // Question format promotes engagement
      if (hasLineBreaks) insights.push('\u8aad\u307f\u3084\u3059\u3044\u6539\u884c\u69cb\u6210'); // Readable line break structure
      if (hashtagCount >= 2 && hashtagCount <= 4) insights.push('\u9069\u5207\u306a\u30cf\u30c3\u30b7\u30e5\u30bf\u30b0\u6570'); // Appropriate hashtag count
    } else {
      if (!hasEmoji) insights.push('\u7d75\u6587\u5b57\u304c\u306a\u304f\u5358\u8abf'); // No emoji, monotonous
      if (!hasQuestion) insights.push('\u30a4\u30f3\u30bf\u30e9\u30af\u30b7\u30e7\u30f3\u3092\u4fc3\u3059\u8981\u7d20\u304c\u4e0d\u8db3'); // Lacking interactive elements
      if (contentLength < 50) insights.push('\u30b3\u30f3\u30c6\u30f3\u30c4\u304c\u77ed\u3059\u304e\u308b'); // Content too short
      if (hashtagCount === 0) insights.push('\u30cf\u30c3\u30b7\u30e5\u30bf\u30b0\u306a\u3057'); // No hashtags
      if (hashtagCount > 5) insights.push('\u30cf\u30c3\u30b7\u30e5\u30bf\u30b0\u304c\u591a\u3059\u304e\u308b'); // Too many hashtags
    }

    const insight = insights.length > 0
      ? insights.join('\u3001') // Join with Japanese comma
      : (isSuccess ? '\u3053\u306e\u6295\u7a3f\u30d1\u30bf\u30fc\u30f3\u306f\u52b9\u679c\u7684\u3067\u3057\u305f' : '\u3053\u306e\u6295\u7a3f\u30d1\u30bf\u30fc\u30f3\u306f\u6539\u5584\u304c\u5fc5\u8981\u3067\u3059'); // Default insights

    // Calculate confidence based on data quality
    let confidence = isSuccess ? 70 : 60;
    if (evaluation.comparison) {
      // Stronger signal if clearly above/below average
      const multiplier = isSuccess
        ? Math.max(evaluation.comparison.likesRatio, evaluation.comparison.engagementRatio)
        : Math.min(evaluation.comparison.likesRatio, evaluation.comparison.engagementRatio);

      if (isSuccess && multiplier >= 2) confidence = 85;
      else if (isSuccess && multiplier >= 1.5) confidence = 75;
      else if (!isSuccess && multiplier <= 0.3) confidence = 75;
    }

    // Add the learning
    const learningId = await addAccountLearning({
      accountId,
      projectId: postUrl.projectId,
      learningType: evaluation.learningType,
      title,
      content: {
        pattern: {
          hasEmoji,
          hasQuestion,
          hasHashtag,
          hashtagCount,
          contentLength,
          hasLineBreaks,
          excerpt: content.substring(0, 100),
        },
        metrics: {
          likes: metrics.likeCount,
          replies: metrics.replyCount,
          retweets: metrics.retweetCount,
          impressions: metrics.impressionCount,
          engagementRate: evaluation.metrics.engagementRate,
        },
        comparison: evaluation.comparison,
        insight,
        evaluationReason: evaluation.reason,
      },
      sourceType: 'post_performance',
      sourcePostId: postUrl.scheduledPostId || undefined,
      confidence,
    });

    console.log(`[LearningTrigger] Created ${evaluation.learningType} learning (ID: ${learningId}) for account ${accountId}: ${title}`);

    // Update post performance feedback if exists
    if (postUrl.scheduledPostId) {
      try {
        await db
          .update(postPerformanceFeedback)
          .set({
            performanceScore: isSuccess ? 80 : 30,
            engagementScore: evaluation.metrics.engagementRate,
            isProcessed: 1,
            processedAt: new Date().toISOString(),
            successFactors: isSuccess ? JSON.stringify(insights) : null,
            improvementAreas: !isSuccess ? JSON.stringify(insights) : null,
          })
          .where(eq(postPerformanceFeedback.postId, postUrl.scheduledPostId));
      } catch (feedbackError) {
        console.warn(`[LearningTrigger] Could not update feedback:`, feedbackError);
      }
    }

    return learningId;
  } catch (error) {
    console.error(`[LearningTrigger] Error triggering learning:`, error);
    return null;
  }
}

/**
 * Get custom thresholds for an account (future: from DB or account settings)
 */
export function getAccountThresholds(accountId: number): PerformanceThresholds {
  // For now, return defaults
  // Future: Load from account settings or project configuration
  return { ...DEFAULT_THRESHOLDS };
}

/**
 * Update learnings used to generate a post based on its performance
 * This completes the reinforcement learning feedback loop:
 * learning → content generation → post → metrics → learning update
 */
export async function updateUsedLearningsFromPerformance(
  postUrlId: number,
  evaluation: PerformanceEvaluation
): Promise<{ updated: number; learningIds: number[] }> {
  try {
    // Get the post URL to find the scheduled post
    const [postUrl] = await db
      .select()
      .from(postUrls)
      .where(eq(postUrls.id, postUrlId));

    if (!postUrl?.scheduledPostId) {
      return { updated: 0, learningIds: [] };
    }

    // Get the scheduled post to find usedLearningIds
    const [scheduledPost] = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, postUrl.scheduledPostId));

    if (!scheduledPost?.usedLearningIds) {
      return { updated: 0, learningIds: [] };
    }

    // Parse the learning IDs
    let learningIds: number[];
    try {
      learningIds = JSON.parse(scheduledPost.usedLearningIds);
      if (!Array.isArray(learningIds) || learningIds.length === 0) {
        return { updated: 0, learningIds: [] };
      }
    } catch {
      return { updated: 0, learningIds: [] };
    }

    // Determine if the post was successful
    const wasSuccessful = evaluation.performanceLevel === 'high';

    // Update each learning's usage stats and confidence
    let updated = 0;
    for (const learningId of learningIds) {
      try {
        await updateLearningUsage(learningId, wasSuccessful);
        updated++;
        console.log(
          `[LearningTrigger] Updated learning ${learningId}: wasSuccessful=${wasSuccessful} (${evaluation.reason})`
        );
      } catch (error) {
        console.warn(`[LearningTrigger] Failed to update learning ${learningId}:`, error);
      }
    }

    if (updated > 0) {
      console.log(
        `[LearningTrigger] Feedback loop: updated ${updated}/${learningIds.length} learnings for post ${postUrlId} (performance: ${evaluation.performanceLevel})`
      );
    }

    return { updated, learningIds };
  } catch (error) {
    console.error(`[LearningTrigger] Error in feedback loop:`, error);
    return { updated: 0, learningIds: [] };
  }
}
