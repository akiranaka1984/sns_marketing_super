/**
 * Scheduled Posts System
 * 
 * Automatically publishes posts at scheduled times using DuoPlus API
 */

import { db } from "./db";
import { scheduledPosts, accounts, logs, freezeDetections, postUrls } from "../drizzle/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import { detectFreeze, handleFreeze } from "./freeze-detection";
import { postToSNS, isDevicePoweredOn } from "./sns-posting";
import { onPostSuccess } from "./post-success-hook";

/**
 * Execute pending scheduled posts
 */
export async function executeScheduledPosts() {
  const now = new Date();

  // Get all pending posts that should be published now
  const pendingPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.status, "pending"),
      lte(scheduledPosts.scheduledTime, now)
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
 * Publish a single scheduled post using DuoPlus API
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

    // Check if device ID is set
    if (!account.deviceId) {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: "Device ID not configured for this account",
        })
        .where(eq(scheduledPosts.id, postId));

      return {
        success: false,
        message: "Device ID not configured for this account",
        postId,
      };
    }

    // Check if device is powered on
    const devicePoweredOn = await isDevicePoweredOn(account.deviceId);
    if (!devicePoweredOn) {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: "Device is not powered on",
        })
        .where(eq(scheduledPosts.id, postId));

      return {
        success: false,
        message: "Device is not powered on. Please start the device first.",
        postId,
      };
    }

    console.log(`[ScheduledPosts] Publishing post ${postId} to ${account.platform} account ${account.username}`);
    console.log(`[ScheduledPosts] Content: ${post.content}`);
    console.log(`[ScheduledPosts] Device: ${account.deviceId}`);

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

    // Post to SNS using DuoPlus API
    const postResult = await postToSNS(
      account.platform,
      account.deviceId,
      fullContent,
      post.mediaUrls ? (typeof post.mediaUrls === 'string' ? JSON.parse(post.mediaUrls) : post.mediaUrls) : undefined
    );

    if (postResult.success) {
      // Update post status with post URL and screenshot if available
      await db
        .update(scheduledPosts)
        .set({
          status: "posted",
          postedAt: new Date(),
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

      // Update post status
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: postResult.error || postResult.message,
        })
        .where(eq(scheduledPosts.id, postId));

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

  if (nextTime) {
    await db.insert(scheduledPosts).values({
      projectId: post.projectId,
      accountId: post.accountId,
      content: post.content,
      mediaUrls: post.mediaUrls,
      hashtags: post.hashtags,
      scheduledTime: nextTime,
      repeatInterval: post.repeatInterval,
      status: "pending",
    });

    console.log(
      `[ScheduledPosts] Created next scheduled post for ${nextTime.toISOString()}`
    );
  }
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
 * Start scheduled posts executor (runs every minute)
 */
export function startScheduledPostsExecutor() {
  console.log("[ScheduledPosts] Starting executor...");

  // Run immediately
  executeScheduledPosts();

  // Run every minute
  setInterval(() => {
    executeScheduledPosts();
  }, 60 * 1000); // 60 seconds
}
