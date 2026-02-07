/**
 * Scheduled Posts System
 *
 * Automatically publishes posts at scheduled times using Playwright browser automation.
 * Uses Bull queue for reliable job processing with retry support.
 */

import { db } from "./db";
import { scheduledPosts, accounts, logs, freezeDetections, postUrls } from "../drizzle/schema";
import { eq, and, lte, desc, sql, inArray } from "drizzle-orm";
import { detectFreeze, handleFreeze } from "./freeze-detection";
import { buildAgentContext, generateContent } from "./agent-engine";
import { isSimilar } from "./agent-scheduled-posts";
import { postToSNS } from "./sns-posting";
import { onPostSuccess } from "./post-success-hook";
import { addScheduledPostJob, type ScheduledPostJob } from "./queue-manager";

/**
 * Execute pending scheduled posts
 */
export async function executeScheduledPosts() {
  const now = new Date();

  // Get all posts ready to be published now
  // Posts must be status="pending" (not yet processed) AND reviewStatus="approved" (approved for posting)
  const pendingPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.status, "pending"),
      eq(scheduledPosts.reviewStatus, "approved"),
      lte(scheduledPosts.scheduledTime, now.toISOString())
    ),
  });

  console.log(`[ScheduledPosts] Found ${pendingPosts.length} posts to publish`);

  const results = [];

  for (const post of pendingPosts) {
    try {
      const result = await publishPost(post.id);
      results.push(result);

      // If repeat interval is set, create next scheduled post
      if (post.repeatInterval !== "none" && result.success) {
        await createNextScheduledPost(post);
      }
    } catch (error: any) {
      console.error(`[ScheduledPosts] Error publishing post ${post.id}:`, error);
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: error.message,
        })
        .where(eq(scheduledPosts.id, post.id));
    }
  }

  return results;
}

/**
 * Publish a single scheduled post via Playwright
 */
export async function publishPost(postId: number): Promise<{
  success: boolean;
  message: string;
  postId: number;
}> {
  try {
    // Get post details
    const post = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, postId),
    });

    if (!post) {
      return { success: false, message: "Post not found", postId };
    }

    // Get account details
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, post.accountId),
    });

    if (!account) {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: "Account not found",
        })
        .where(eq(scheduledPosts.id, postId));

      return { success: false, message: "Account not found", postId };
    }

    // Check if account is active
    if (account.status !== "active") {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: `Account is ${account.status}`,
        })
        .where(eq(scheduledPosts.id, postId));

      return {
        success: false,
        message: `Account is ${account.status}`,
        postId,
      };
    }

    console.log(`[ScheduledPosts] Publishing post ${postId} to ${account.platform} account ${account.username}`);
    console.log(`[ScheduledPosts] Content: ${post.content}`);

    // Build full content with hashtags
    let fullContent = post.content;
    if (post.hashtags) {
      const hashtagsArray = typeof post.hashtags === 'string' 
        ? JSON.parse(post.hashtags) 
        : post.hashtags;
      if (Array.isArray(hashtagsArray) && hashtagsArray.length > 0) {
        fullContent += '\n\n' + hashtagsArray.map((tag: string) => 
          tag.startsWith('#') ? tag : `#${tag}`
        ).join(' ');
      }
    }

    // Post to SNS using Playwright
    const postResult = await postToSNS(
      account.platform,
      fullContent,
      account.id,
      post.mediaUrls ? (typeof post.mediaUrls === 'string' ? JSON.parse(post.mediaUrls) : post.mediaUrls) : undefined,
    );

    if (postResult.success) {
      // Update post status with post URL and screenshot if available
      await db
        .update(scheduledPosts)
        .set({
          status: "posted",
          postedAt: new Date().toISOString(),
          postUrl: postResult.postUrl || null,
          screenshotUrl: postResult.screenshotUrl || null,
        })
        .where(eq(scheduledPosts.id, postId));

      // Trigger post success hook for automatic interactions
      if (post.projectId) {
        try {
          const hookResult = await onPostSuccess(
            post.projectId,
            account.id,
            account.deviceId || '',
            account.xHandle || account.username,
            post.content,
            postId
          );
          
          if (hookResult.success) {
            console.log(`[ScheduledPosts] Post success hook completed: ${hookResult.tasksCreated} tasks created`);
          } else {
            console.error(`[ScheduledPosts] Post success hook failed: ${hookResult.error}`);
          }
        } catch (error: any) {
          console.error(`[ScheduledPosts] Post success hook error:`, error.message);
        }
      }

      // Log success with post URL and screenshot if available
      const logDetails = [
        `Posted to ${account.platform}: ${post.content.substring(0, 100)}...`,
        postResult.postUrl ? `Post URL: ${postResult.postUrl}` : null,
        postResult.screenshotUrl ? `Screenshot: ${postResult.screenshotUrl}` : null,
      ].filter(Boolean).join(' | ');
      
      await db.insert(logs).values({
        accountId: account.id,
        deviceId: account.deviceId,
        action: "scheduled_post",
        status: "success",
        details: logDetails,
      });

      return {
        success: true,
        message: postResult.message,
        postId,
      };
    } else {
      // Check current status before updating to failed
      // (another process might have already succeeded)
      const currentPost = await db.query.scheduledPosts.findFirst({
        where: eq(scheduledPosts.id, postId),
      });

      if (currentPost?.status === "posted") {
        console.log(`[ScheduledPosts] Post ${postId} was already successfully posted by another process, skipping failure update`);
        return {
          success: true,
          message: "Post was already successfully published",
          postId,
        };
      }

      // Detect if this is a freeze
      const freezeResult = await detectFreeze(
        account.id,
        account.deviceId,
        postResult.error || "Unknown error"
      );

      if (freezeResult.isFrozen && freezeResult.recommendedAction) {
        // Get the freeze detection ID (last inserted)
        const latestFreeze = await db.query.freezeDetections.findFirst({
          where: eq(freezeDetections.accountId, account.id),
          orderBy: [desc(freezeDetections.createdAt)],
        });

        if (latestFreeze) {
          // Trigger auto-response
          await handleFreeze(
            latestFreeze.id,
            account.id,
            account.deviceId,
            freezeResult.recommendedAction
          );
        }
      }

      // Re-check status after freeze detection (might have been updated)
      const postAfterFreeze = await db.query.scheduledPosts.findFirst({
        where: eq(scheduledPosts.id, postId),
      });

      if (postAfterFreeze?.status === "posted") {
        console.log(`[ScheduledPosts] Post ${postId} was successfully posted during freeze detection, skipping failure update`);
        return {
          success: true,
          message: "Post was successfully published",
          postId,
        };
      }

      // Update post status only if still pending
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: postResult.error || postResult.message,
        })
        .where(and(
          eq(scheduledPosts.id, postId),
          eq(scheduledPosts.status, "pending")  // Only update if still pending
        ));

      // Log failure
      await db.insert(logs).values({
        accountId: account.id,
        deviceId: account.deviceId,
        action: "scheduled_post",
        status: "failed",
        errorMessage: postResult.error || postResult.message,
      });

      return {
        success: false,
        message: postResult.error || postResult.message || "Failed to publish post",
        postId,
      };
    }
  } catch (error: any) {
    console.error(`[ScheduledPosts] Error in publishPost:`, error);
    return {
      success: false,
      message: error.message,
      postId,
    };
  }
}

/**
 * Create next scheduled post for repeat intervals
 */
async function createNextScheduledPost(post: any) {
  const nextTime = calculateNextScheduledTime(
    post.scheduledTime,
    post.repeatInterval
  );

  if (!nextTime) return;

  let content = post.content;
  let hashtags = post.hashtags;

  // エージェント生成の投稿は新しいコンテンツを再生成
  if (post.agentId) {
    try {
      const context = await buildAgentContext(post.agentId);
      if (context) {
        // 既存pending投稿のコンテンツを取得（類似チェック用）
        const existingPending = await db.query.scheduledPosts.findMany({
          where: and(
            eq(scheduledPosts.accountId, post.accountId),
            eq(scheduledPosts.status, "pending")
          ),
          orderBy: desc(scheduledPosts.createdAt),
          limit: 20,
        });
        const existingContents = existingPending.map(p => p.content);

        let generated = await generateContent(context, undefined, post.accountId, existingContents);

        // 類似チェック（最大2回リトライ）
        let retries = 0;
        while (retries < 2 && existingContents.some(ec => isSimilar(ec, generated.content))) {
          console.log(`[ScheduledPosts] Regenerated content similar to existing, retrying (${retries + 1})`);
          generated = await generateContent(context, undefined, post.accountId, existingContents);
          retries++;
        }

        const hashtagText = generated.hashtags.map((h: string) => `#${h}`).join(' ');
        content = generated.content + (hashtagText ? '\n\n' + hashtagText : '');
        hashtags = JSON.stringify(generated.hashtags);
        console.log(`[ScheduledPosts] Regenerated content for repeat post`);
      }
    } catch (error) {
      console.warn(`[ScheduledPosts] Content regeneration failed, using original content:`, error);
      // フォールバック: 元のコンテンツを使用
    }
  }

  // 同一アカウント・同一時刻の重複チェック
  const existing = await db.query.scheduledPosts.findFirst({
    where: and(
      eq(scheduledPosts.accountId, post.accountId),
      eq(scheduledPosts.scheduledTime, nextTime.toISOString()),
      eq(scheduledPosts.status, "pending")
    ),
  });
  if (existing) {
    console.log(`[ScheduledPosts] Duplicate detected for account ${post.accountId} at ${nextTime.toISOString()}, skipping`);
    return;
  }

  await db.insert(scheduledPosts).values({
    projectId: post.projectId,
    accountId: post.accountId,
    content,
    hashtags,
    mediaUrls: post.mediaUrls,
    scheduledTime: nextTime.toISOString(),
    repeatInterval: post.repeatInterval,
    status: "pending",
    agentId: post.agentId || null,
    generatedByAgent: post.agentId ? 1 : 0,
    reviewStatus: post.agentId ? "approved" : "draft",
  });

  console.log(
    `[ScheduledPosts] Created next scheduled post for ${nextTime.toISOString()}`
  );
}

/**
 * Calculate next scheduled time based on repeat interval
 */
function calculateNextScheduledTime(
  currentTime: Date,
  interval: "none" | "daily" | "weekly" | "monthly"
): Date | null {
  if (interval === "none") {
    return null;
  }

  const nextTime = new Date(currentTime);

  switch (interval) {
    case "daily":
      nextTime.setDate(nextTime.getDate() + 1);
      break;
    case "weekly":
      nextTime.setDate(nextTime.getDate() + 7);
      break;
    case "monthly":
      nextTime.setMonth(nextTime.getMonth() + 1);
      break;
  }

  return nextTime;
}

/**
 * Enqueue pending scheduled posts to the Bull queue
 */
export async function enqueuePendingPosts(): Promise<number> {
  const now = new Date();

  // Diagnostic logging: Check all pending posts and their reviewStatus breakdown
  const allPending = await db.query.scheduledPosts.findMany({
    where: eq(scheduledPosts.status, "pending"),
  });

  if (allPending.length > 0) {
    const byReviewStatus = {
      draft: allPending.filter(p => p.reviewStatus === 'draft').length,
      pending_review: allPending.filter(p => p.reviewStatus === 'pending_review').length,
      approved: allPending.filter(p => p.reviewStatus === 'approved').length,
      rejected: allPending.filter(p => p.reviewStatus === 'rejected').length,
      other: allPending.filter(p => !['draft', 'pending_review', 'approved', 'rejected'].includes(p.reviewStatus || '')).length,
    };
    console.log(`[ScheduledPosts] Pending posts breakdown: ${JSON.stringify(byReviewStatus)}`);
  }

  // Get all posts ready to be published now
  // Posts must be status="pending" (not yet processed) AND reviewStatus="approved" (approved for posting)
  const pendingPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.status, "pending"),
      eq(scheduledPosts.reviewStatus, "approved"),
      lte(scheduledPosts.scheduledTime, now.toISOString())
    ),
  });

  if (pendingPosts.length === 0) {
    return 0;
  }

  console.log(`[ScheduledPosts] Enqueueing ${pendingPosts.length} posts to queue`);

  let enqueued = 0;
  for (const post of pendingPosts) {
    try {
      const jobData: ScheduledPostJob = {
        postId: post.id,
        accountId: post.accountId,
        scheduledTime: post.scheduledTime,
      };

      await addScheduledPostJob(jobData);
      enqueued++;
    } catch (error) {
      console.error(`[ScheduledPosts] Failed to enqueue post ${post.id}:`, error);
    }
  }

  return enqueued;
}

/**
 * Start scheduled posts enqueuer (runs every minute)
 * This function periodically checks for pending posts and adds them to the queue
 */
export function startScheduledPostsEnqueuer() {
  console.log("[ScheduledPosts] Starting enqueuer...");

  // Run immediately
  enqueuePendingPosts().catch(console.error);

  // Run every minute
  setInterval(async () => {
    try {
      const count = await enqueuePendingPosts();
      if (count > 0) {
        console.log(`[ScheduledPosts] Enqueued ${count} posts`);
      }
    } catch (error) {
      console.error("[ScheduledPosts] Enqueuer error:", error);
    }
  }, 60 * 1000); // 60 seconds
}

/**
 * @deprecated Use startScheduledPostsEnqueuer instead
 * Legacy function for backward compatibility
 */
export function startScheduledPostsExecutor() {
  console.log("[ScheduledPosts] Warning: startScheduledPostsExecutor is deprecated, use startScheduledPostsEnqueuer");
  startScheduledPostsEnqueuer();
}
