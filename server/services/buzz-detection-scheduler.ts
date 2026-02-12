/**
 * Buzz Detection Scheduler
 *
 * Automatically detects high-performing posts and registers them for analysis.
 * Monitors both own accounts and model accounts for viral content.
 */

import { db } from "../db";
import { buzzPosts, accounts, modelAccounts, posts } from "../../drizzle/schema";
import { eq, desc, gte, and, isNull, sql } from "drizzle-orm";
import { calculateViralityScore } from "./buzz-analyzer";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// ============================================
// Types
// ============================================

export interface DetectedBuzzPost {
  postId: number;
  accountId: number;
  platform: string;
  content: string;
  viralityScore: number;
  engagementRate: number;
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

export interface DetectionResult {
  scannedPosts: number;
  detectedBuzz: number;
  newRegistrations: number;
  posts: DetectedBuzzPost[];
}

// ============================================
// Configuration
// ============================================

const VIRALITY_THRESHOLD = 70; // Minimum score to consider as buzz
const ENGAGEMENT_RATE_THRESHOLD = 0.05; // 5% minimum engagement rate
const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_POSTS_PER_SCAN = 100;

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// ============================================
// Core Detection Functions
// ============================================

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(
  likes: number,
  comments: number,
  shares: number,
  views: number
): number {
  if (views === 0) return 0;
  const totalEngagement = likes + comments * 2 + shares * 3;
  return totalEngagement / views;
}

/**
 * Scan own account posts for buzz
 */
export async function scanOwnAccountsForBuzz(): Promise<DetectedBuzzPost[]> {
  const detectedPosts: DetectedBuzzPost[] = [];

  try {
    // Get recent posts from own accounts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPosts = await db.select()
      .from(posts)
      .where(
        and(
          gte(posts.createdAt, toMySQLTimestamp(sevenDaysAgo)),
          eq(posts.status, "published")
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(MAX_POSTS_PER_SCAN);

    for (const post of recentPosts) {
      // Check if already registered as buzz
      const existingBuzz = await db.query.buzzPosts.findFirst({
        where: eq(buzzPosts.postUrl, `post:${post.id}`)
      });

      if (existingBuzz) continue;

      // Calculate metrics
      const likes = post.likesCount || 0;
      const comments = post.commentsCount || 0;
      const shares = post.sharesCount || 0;
      const views = (post.reachCount ?? 0) || 1;

      const engagementRate = calculateEngagementRate(likes, comments, shares, views);
      const viralityScore = calculateViralityScore(likes, comments, shares, views);

      // Check if qualifies as buzz
      if (viralityScore >= VIRALITY_THRESHOLD || engagementRate >= ENGAGEMENT_RATE_THRESHOLD) {
        detectedPosts.push({
          postId: post.id,
          accountId: post.accountId ?? 0,
          platform: post.platform ?? '',
          content: post.content || "",
          viralityScore,
          engagementRate,
          metrics: { likes, comments, shares, views }
        });
      }
    }
  } catch (error) {
    console.error("[BuzzDetection] Error scanning own accounts:", error);
  }

  return detectedPosts;
}

/**
 * Scan model accounts for buzz posts
 */
export async function scanModelAccountsForBuzz(): Promise<DetectedBuzzPost[]> {
  const detectedPosts: DetectedBuzzPost[] = [];

  try {
    // Get all active model accounts
    const models = await db.select()
      .from(modelAccounts)
      .where(eq(modelAccounts.isActive, 1));

    for (const model of models) {
      // Get existing buzz posts from this model
      const existingBuzzCount = await db.select({ count: sql<number>`count(*)` })
        .from(buzzPosts)
        .where(eq(buzzPosts.modelAccountId, model.id));

      // Note: In a full implementation, you would fetch the model's recent posts
      // from the social media API here. For now, we'll check the buzzPosts table
      // for any recently added posts from this model.
      console.log(`[BuzzDetection] Model account ${model.username} has ${existingBuzzCount[0]?.count || 0} buzz posts`);
    }
  } catch (error) {
    console.error("[BuzzDetection] Error scanning model accounts:", error);
  }

  return detectedPosts;
}

/**
 * Register detected buzz posts to database
 */
export async function registerBuzzPosts(detectedPosts: DetectedBuzzPost[]): Promise<number> {
  let registered = 0;

  for (const post of detectedPosts) {
    try {
      await db.insert(buzzPosts).values({
        userId: 1,
        sourceType: 'own_account',
        sourceAccountId: post.accountId,
        platform: post.platform as 'twitter' | 'tiktok' | 'instagram' | 'facebook',
        content: post.content,
        postUrl: `post:${post.postId}`,
        likesCount: post.metrics.likes,
        commentsCount: post.metrics.comments,
        sharesCount: post.metrics.shares,
        viewsCount: post.metrics.views,
        viralityScore: post.viralityScore,
        isAnalyzed: 0
      });
      registered++;
      console.log(`[BuzzDetection] Registered buzz post ${post.postId} with score ${post.viralityScore}`);
    } catch (error) {
      console.error(`[BuzzDetection] Error registering post ${post.postId}:`, error);
    }
  }

  return registered;
}

/**
 * Run a complete detection cycle
 */
export async function runDetectionCycle(): Promise<DetectionResult> {
  if (isRunning) {
    console.log("[BuzzDetection] Detection cycle already running, skipping");
    return {
      scannedPosts: 0,
      detectedBuzz: 0,
      newRegistrations: 0,
      posts: []
    };
  }

  isRunning = true;
  console.log("[BuzzDetection] Starting detection cycle");

  try {
    // Scan own accounts
    const ownBuzz = await scanOwnAccountsForBuzz();

    // Scan model accounts
    const modelBuzz = await scanModelAccountsForBuzz();

    // Combine results
    const allDetected = [...ownBuzz, ...modelBuzz];

    // Register to database
    const registered = await registerBuzzPosts(allDetected);

    console.log(`[BuzzDetection] Cycle complete: ${allDetected.length} detected, ${registered} registered`);

    return {
      scannedPosts: MAX_POSTS_PER_SCAN,
      detectedBuzz: allDetected.length,
      newRegistrations: registered,
      posts: allDetected
    };
  } catch (error) {
    console.error("[BuzzDetection] Error in detection cycle:", error);
    return {
      scannedPosts: 0,
      detectedBuzz: 0,
      newRegistrations: 0,
      posts: []
    };
  } finally {
    isRunning = false;
  }
}

// ============================================
// Scheduler Management
// ============================================

/**
 * Start the buzz detection scheduler
 */
export function startBuzzDetectionScheduler(): void {
  if (schedulerInterval) {
    console.log("[BuzzDetection] Scheduler already running");
    return;
  }

  console.log(`[BuzzDetection] Starting scheduler (interval: ${SCAN_INTERVAL_MS / 1000 / 60} minutes)`);

  // Run immediately
  runDetectionCycle();

  // Schedule periodic runs
  schedulerInterval = setInterval(() => {
    runDetectionCycle();
  }, SCAN_INTERVAL_MS);
}

/**
 * Stop the buzz detection scheduler
 */
export function stopBuzzDetectionScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[BuzzDetection] Scheduler stopped");
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  viralityThreshold: number;
  engagementRateThreshold: number;
  scanIntervalMinutes: number;
} {
  return {
    isRunning: isSchedulerRunning(),
    viralityThreshold: VIRALITY_THRESHOLD,
    engagementRateThreshold: ENGAGEMENT_RATE_THRESHOLD * 100,
    scanIntervalMinutes: SCAN_INTERVAL_MS / 1000 / 60
  };
}

/**
 * Manually trigger detection for a specific account
 */
export async function detectBuzzForAccount(accountId: number): Promise<DetectedBuzzPost[]> {
  const detectedPosts: DetectedBuzzPost[] = [];

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPosts = await db.select()
      .from(posts)
      .where(
        and(
          eq(posts.accountId, accountId),
          gte(posts.createdAt, toMySQLTimestamp(sevenDaysAgo)),
          eq(posts.status, "published")
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(50);

    for (const post of recentPosts) {
      const likes = post.likesCount || 0;
      const comments = post.commentsCount || 0;
      const shares = post.sharesCount || 0;
      const views = (post.reachCount ?? 0) || 1;

      const engagementRate = calculateEngagementRate(likes, comments, shares, views);
      const viralityScore = calculateViralityScore(likes, comments, shares, views);

      if (viralityScore >= VIRALITY_THRESHOLD || engagementRate >= ENGAGEMENT_RATE_THRESHOLD) {
        detectedPosts.push({
          postId: post.id,
          accountId: post.accountId ?? 0,
          platform: post.platform ?? '',
          content: post.content || "",
          viralityScore,
          engagementRate,
          metrics: { likes, comments, shares, views }
        });
      }
    }
  } catch (error) {
    console.error(`[BuzzDetection] Error detecting buzz for account ${accountId}:`, error);
  }

  return detectedPosts;
}
