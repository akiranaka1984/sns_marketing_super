import { db } from "./db";
import { scheduledPosts, accounts, agents, contentRewrites, contentReviews } from "../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { publishPost } from "./scheduled-posts";

/**
 * Auto-posting scheduler
 * Runs periodically to check for scheduled posts and publish them
 */

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the auto-posting scheduler
 */
export function startAutoPostingScheduler(intervalMs: number = 60000) {
  if (schedulerInterval) {
    console.log("[AutoPosting] Scheduler already running");
    return;
  }

  console.log(`[AutoPosting] Starting scheduler with interval ${intervalMs}ms`);

  // Run immediately on start
  processScheduledPosts();

  // Then run at regular intervals
  schedulerInterval = setInterval(() => {
    processScheduledPosts();
  }, intervalMs);
}

/**
 * Stop the auto-posting scheduler
 */
export function stopAutoPostingScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[AutoPosting] Scheduler stopped");
  }
}

/**
 * Process scheduled posts that are due
 */
async function processScheduledPosts() {
  try {
    console.log("[AutoPosting] Checking for scheduled posts...");

    // Get all pending posts that are due
    const duePosts = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, "pending"),
          lte(scheduledPosts.scheduledTime, new Date())
        )
      );

    if (duePosts.length === 0) {
      console.log("[AutoPosting] No posts due at this time");
      return;
    }

    console.log(`[AutoPosting] Found ${duePosts.length} posts to publish`);

    // Process each post
    for (const post of duePosts) {
      try {
        await publishScheduledPost(post.id);
      } catch (error: any) {
        console.error(`[AutoPosting] Error publishing post ${post.id}:`, error);
        
        // Update post status to failed
        await db
          .update(scheduledPosts)
          .set({
            status: "failed",
            errorMessage: error.message,
          })
          .where(eq(scheduledPosts.id, post.id));
      }
    }
  } catch (error: any) {
    console.error("[AutoPosting] Error processing scheduled posts:", error);
  }
}

/**
 * Publish a scheduled post
 */
async function publishScheduledPost(postId: number) {
  console.log(`[AutoPosting] Publishing post ${postId}...`);

  // Get post details
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, postId));

  if (!post) {
    throw new Error("Post not found");
  }

  // Get account details
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, post.accountId));

  if (!account) {
    throw new Error("Account not found");
  }

  // Check if account is active
  if (account.status !== "active") {
    throw new Error(`Account is not active (status: ${account.status})`);
  }

  // Publish the post using existing publishPost function
  await publishPost(postId);

  console.log(`[AutoPosting] Post ${postId} published successfully`);
  // Repeat scheduling is handled by executeScheduledPosts() in scheduled-posts.ts
}

/**
 * Create scheduled posts from approved content
 */
export async function createScheduledPostsFromApprovedContent() {
  try {
    console.log("[AutoPosting] Creating scheduled posts from approved content...");

    // Get all approved content reviews
    const approvedReviews = await db
      .select()
      .from(contentReviews)
      .where(eq(contentReviews.status, "approved"));

    for (const review of approvedReviews) {
      // Get the content rewrite
      const [rewrite] = await db
        .select()
        .from(contentRewrites)
        .where(eq(contentRewrites.id, review.contentRewriteId ?? 0));

      if (!rewrite) {
        continue;
      }

      // Get the agent
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, rewrite.agentId));

      if (!agent || !agent.isActive) {
        continue;
      }

      // Parse posting time slots
      const timeSlots = agent.postingTimeSlots
        ? JSON.parse(agent.postingTimeSlots)
        : ["09:00"];

      // Create scheduled posts for each time slot
      for (const timeSlot of timeSlots) {
        const [hours, minutes] = timeSlot.split(":").map(Number);
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);

        // If the time has already passed today, schedule for tomorrow
        if (scheduledTime < new Date()) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        // Get accounts for this agent (assuming agent is linked to accounts)
        // For now, we'll skip creating the post if no account is specified
        // In production, you would have a mapping between agents and accounts

        console.log(`[AutoPosting] Would schedule post for ${scheduledTime.toISOString()}`);
      }
    }
  } catch (error: any) {
    console.error("[AutoPosting] Error creating scheduled posts from approved content:", error);
  }
}

// Start the scheduler when this module is loaded
// In production, you might want to start this from your main server file
if (process.env.NODE_ENV !== "test") {
  startAutoPostingScheduler();
}
