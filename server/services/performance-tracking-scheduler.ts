/**
 * Performance Tracking Scheduler
 *
 * Schedules and executes engagement tracking jobs at specific intervals
 * after a post is published (1h, 24h, 48h, 72h).
 */

import { db } from "../db";
import { engagementTrackingJobs, postUrls, postAnalytics, scheduledPosts } from "../../drizzle/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import { getTweetMetrics, extractTweetIdFromUrl, TweetMetrics } from "../x-api-service";
import { triggerLearningFromMetrics, evaluatePerformance, updateUsedLearningsFromPerformance } from "./learning-trigger-service";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Tracking intervals in hours
export const TRACKING_INTERVALS = ['1h', '24h', '48h', '72h'] as const;
export type TrackingType = typeof TRACKING_INTERVALS[number];

// Interval durations in milliseconds
const INTERVAL_MS: Record<TrackingType, number> = {
  '1h': 1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
};

/**
 * Schedule tracking jobs for a new post
 * Creates jobs for all tracking intervals (1h, 24h, 48h, 72h)
 */
export async function scheduleTrackingJobs(
  postUrlId: number,
  postUrl: string,
  accountId: number,
  projectId?: number
): Promise<{ success: boolean; jobsCreated: number; error?: string }> {
  try {
    // Extract tweet ID from URL
    const tweetId = extractTweetIdFromUrl(postUrl);
    if (!tweetId) {
      console.error(`[PerformanceTracker] Failed to extract tweet ID from: ${postUrl}`);
      return { success: false, jobsCreated: 0, error: "Invalid post URL format" };
    }

    const now = new Date();
    let jobsCreated = 0;

    // Create jobs for each tracking interval
    for (const trackingType of TRACKING_INTERVALS) {
      const scheduledAt = new Date(now.getTime() + INTERVAL_MS[trackingType]);

      await db.insert(engagementTrackingJobs).values({
        postUrlId,
        tweetId,
        accountId,
        projectId: projectId || null,
        trackingType,
        scheduledAt: toMySQLTimestamp(scheduledAt),
        status: 'pending',
      });

      jobsCreated++;
      console.log(`[PerformanceTracker] Scheduled ${trackingType} tracking job for tweet ${tweetId} at ${scheduledAt.toISOString()}`);
    }

    return { success: true, jobsCreated };
  } catch (error) {
    console.error("[PerformanceTracker] Error scheduling tracking jobs:", error);
    return { success: false, jobsCreated: 0, error: String(error) };
  }
}

/**
 * Process a single tracking job
 */
export async function processTrackingJob(jobId: number): Promise<{
  success: boolean;
  metrics?: TweetMetrics;
  learningTriggered?: boolean;
  error?: string;
}> {
  try {
    // Get the job
    const [job] = await db
      .select()
      .from(engagementTrackingJobs)
      .where(eq(engagementTrackingJobs.id, jobId));

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      return { success: false, error: `Job already ${job.status}` };
    }

    // Mark as processing
    await db
      .update(engagementTrackingJobs)
      .set({ status: 'processing' })
      .where(eq(engagementTrackingJobs.id, jobId));

    console.log(`[PerformanceTracker] Processing ${job.trackingType} job for tweet ${job.tweetId}`);

    // Fetch metrics from X API
    const metrics = await getTweetMetrics(job.tweetId);

    if (!metrics) {
      // Retry logic
      const newRetryCount = (job.retryCount || 0) + 1;
      const maxRetries = 3;

      if (newRetryCount < maxRetries) {
        // Schedule retry in 10 minutes
        const retryAt = new Date(Date.now() + 10 * 60 * 1000);
        await db
          .update(engagementTrackingJobs)
          .set({
            status: 'pending',
            retryCount: newRetryCount,
            scheduledAt: toMySQLTimestamp(retryAt),
            errorMessage: "Failed to fetch metrics, retrying...",
          })
          .where(eq(engagementTrackingJobs.id, jobId));

        return { success: false, error: "Failed to fetch metrics, scheduled retry" };
      } else {
        await db
          .update(engagementTrackingJobs)
          .set({
            status: 'failed',
            retryCount: newRetryCount,
            executedAt: toMySQLTimestamp(new Date()),
            errorMessage: "Failed to fetch metrics after max retries",
          })
          .where(eq(engagementTrackingJobs.id, jobId));

        return { success: false, error: "Failed to fetch metrics after max retries" };
      }
    }

    // Save metrics to post_analytics
    await saveMetricsToAnalytics(job, metrics);

    // Trigger learning for 24h tracking (primary learning point)
    let learningTriggered = false;
    if (job.trackingType === '24h') {
      try {
        const evaluation = await evaluatePerformance(job.accountId, metrics);
        if (evaluation.shouldTriggerLearning) {
          await triggerLearningFromMetrics(job.postUrlId, job.accountId, metrics, evaluation);
          learningTriggered = true;
          console.log(`[PerformanceTracker] Learning triggered for post ${job.postUrlId}: ${evaluation.reason}`);
        }

        // Feedback loop: update learnings used to generate this post
        const feedbackResult = await updateUsedLearningsFromPerformance(job.postUrlId, evaluation);
        if (feedbackResult.updated > 0) {
          console.log(`[PerformanceTracker] Feedback loop: updated ${feedbackResult.updated} learnings for post ${job.postUrlId}`);
        }
      } catch (learningError) {
        console.error(`[PerformanceTracker] Learning trigger failed:`, learningError);
      }
    }

    // Mark job as completed
    await db
      .update(engagementTrackingJobs)
      .set({
        status: 'completed',
        executedAt: toMySQLTimestamp(new Date()),
        metrics: JSON.stringify(metrics),
        learningTriggered: learningTriggered ? 1 : 0,
      })
      .where(eq(engagementTrackingJobs.id, jobId));

    console.log(`[PerformanceTracker] Completed ${job.trackingType} job for tweet ${job.tweetId}: likes=${metrics.likeCount}, impressions=${metrics.impressionCount}`);

    return { success: true, metrics, learningTriggered };
  } catch (error) {
    console.error(`[PerformanceTracker] Error processing job ${jobId}:`, error);

    await db
      .update(engagementTrackingJobs)
      .set({
        status: 'failed',
        executedAt: toMySQLTimestamp(new Date()),
        errorMessage: String(error),
      })
      .where(eq(engagementTrackingJobs.id, jobId));

    return { success: false, error: String(error) };
  }
}

/**
 * Save metrics to post_analytics table
 */
async function saveMetricsToAnalytics(
  job: typeof engagementTrackingJobs.$inferSelect,
  metrics: TweetMetrics
): Promise<void> {
  try {
    // Get post URL info
    const [postUrl] = await db
      .select()
      .from(postUrls)
      .where(eq(postUrls.id, job.postUrlId));

    if (!postUrl) {
      console.warn(`[PerformanceTracker] Post URL not found for job ${job.id}`);
      return;
    }

    // Get scheduled post ID if available
    let postId: number | null = null;
    if (postUrl.scheduledPostId) {
      postId = postUrl.scheduledPostId;
    }

    // Calculate engagement rate (likes + comments + retweets) / impressions * 100
    const engagementRate = metrics.impressionCount > 0
      ? Math.round((metrics.likeCount + metrics.replyCount + metrics.retweetCount) / metrics.impressionCount * 10000)
      : 0;

    // Insert or update analytics
    await db.insert(postAnalytics).values({
      postId: postId || 0, // Use 0 if no scheduled post
      accountId: job.accountId,
      platform: 'twitter',
      viewsCount: metrics.impressionCount,
      likesCount: metrics.likeCount,
      commentsCount: metrics.replyCount,
      sharesCount: metrics.retweetCount + metrics.quoteCount,
      engagementRate,
      impressionsCount: metrics.impressionCount,
      recordedAt: toMySQLTimestamp(new Date()),
    });

    console.log(`[PerformanceTracker] Saved analytics for post ${postUrl.postUrl}`);
  } catch (error) {
    console.error(`[PerformanceTracker] Error saving analytics:`, error);
  }
}

/**
 * Process all due tracking jobs
 * This should be called periodically (e.g., every 5 minutes)
 */
export async function processDueTrackingJobs(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = toMySQLTimestamp(new Date());
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Get all pending jobs that are due
    const dueJobs = await db
      .select()
      .from(engagementTrackingJobs)
      .where(
        and(
          eq(engagementTrackingJobs.status, 'pending'),
          lte(engagementTrackingJobs.scheduledAt, now)
        )
      )
      .orderBy(engagementTrackingJobs.scheduledAt)
      .limit(50); // Process in batches

    if (dueJobs.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`[PerformanceTracker] Found ${dueJobs.length} due tracking jobs`);

    for (const job of dueJobs) {
      processed++;
      const result = await processTrackingJob(job.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      // Small delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[PerformanceTracker] Processed ${processed} jobs: ${succeeded} succeeded, ${failed} failed`);
    return { processed, succeeded, failed };
  } catch (error) {
    console.error("[PerformanceTracker] Error processing due jobs:", error);
    return { processed, succeeded, failed };
  }
}

/**
 * Get tracking job statistics
 */
export async function getTrackingStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  try {
    const allJobs = await db
      .select()
      .from(engagementTrackingJobs);

    for (const job of allJobs) {
      if (job.status === 'pending') stats.pending++;
      else if (job.status === 'processing') stats.processing++;
      else if (job.status === 'completed') stats.completed++;
      else if (job.status === 'failed') stats.failed++;
    }
  } catch (error) {
    console.error("[PerformanceTracker] Error getting stats:", error);
  }

  return stats;
}
