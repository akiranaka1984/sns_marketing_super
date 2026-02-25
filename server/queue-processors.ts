/**
 * Queue Processors
 *
 * Job processors for Bull queues. These are the actual functions that
 * execute when a job is picked up from the queue.
 */

import type { Job } from 'bull';
import {
  getScheduledPostsQueue,
  getInteractionsQueue,
  type ScheduledPostJob,
  type InteractionJob,
} from './queue-manager';
import { publishPost } from './scheduled-posts';
import { db } from './db';
import { interactions, postUrls, accounts, projectAccounts } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { executeLike, executeAiComment, executeRetweet, executeFollow } from './utils/python-runner';
import { getAccountLearnings } from './services/account-learning-service';
import { processDueTrackingJobs } from './services/performance-tracking-scheduler';
import { createLogger } from './utils/logger';

const logger = createLogger('queue-processor');

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Process scheduled post job
 */
async function processScheduledPostJob(job: Job<ScheduledPostJob>): Promise<{
  success: boolean;
  message: string;
  postId: number;
}> {
  const { postId } = job.data;
  logger.info({ postId }, "Processing scheduled post");

  try {
    const result = await publishPost(postId);
    return result;
  } catch (error) {
    logger.error({ err: error, postId }, "Error processing post");
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Build persona string with account learnings
 */
async function buildPersonaWithLearnings(
  accountId: number,
  projectId: number,
  projectAccount: { personaRole: string | null; personaTone: string | null; personaCharacteristics: string | null } | null,
  defaultPersona: string
): Promise<string> {
  // Build base persona
  let basePersona = defaultPersona;
  if (projectAccount && (projectAccount.personaRole || projectAccount.personaCharacteristics)) {
    const parts: string[] = [];
    if (projectAccount.personaRole) parts.push(projectAccount.personaRole);
    if (projectAccount.personaTone) parts.push(`トーン: ${projectAccount.personaTone}`);
    if (projectAccount.personaCharacteristics) parts.push(projectAccount.personaCharacteristics);
    basePersona = parts.join('。') || defaultPersona;
  }

  // Get account learnings for comment style
  try {
    const learnings = await getAccountLearnings(accountId, {
      projectId,
      learningTypes: ['comment_style', 'audience_insight'],
      minConfidence: 40,
      limit: 5,
    });

    if (learnings.length === 0) {
      return basePersona;
    }

    // Extract comment style hints from learnings
    const styleHints: string[] = [];
    for (const learning of learnings) {
      try {
        const content = JSON.parse(learning.content);
        if (content.description) {
          styleHints.push(content.description);
        } else if (content.styleNote) {
          styleHints.push(content.styleNote);
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (styleHints.length === 0) {
      return basePersona;
    }

    // Combine base persona with learned styles
    return `${basePersona}。追加のスタイル指針: ${styleHints.slice(0, 2).join('。')}`;
  } catch (error) {
    logger.error({ err: error }, "Failed to get account learnings");
    return basePersona;
  }
}

/**
 * Process interaction job
 */
async function processInteractionJob(job: Job<InteractionJob>): Promise<{
  success: boolean;
  error?: string;
  comment?: string;
}> {
  const { interactionId, type, fromDeviceId, fromAccountId, targetUrl, targetUsername, projectId } = job.data;
  logger.info({ interactionId, type }, "Processing interaction");

  try {
    // Update status to processing
    await db.update(interactions)
      .set({ status: 'processing' })
      .where(eq(interactions.id, interactionId));

    const apiKey = process.env.AUTOMATION_API_KEY || '';
    if (!apiKey) {
      throw new Error('AUTOMATION_API_KEY is not configured');
    }

    let result: { success: boolean; error?: string; comment?: string };

    switch (type) {
      case 'like':
        if (!targetUrl) throw new Error('Target URL is required for like');
        result = await executeLike(apiKey, fromDeviceId, targetUrl);
        break;

      case 'comment':
        if (!targetUrl) throw new Error('Target URL is required for comment');
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          throw new Error('OPENAI_API_KEY is not configured');
        }

        // Get account for persona
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, fromAccountId),
        });

        // Get project-specific persona if available
        let projectAccount = null;
        if (projectId) {
          projectAccount = await db.query.projectAccounts.findFirst({
            where: and(
              eq(projectAccounts.projectId, projectId),
              eq(projectAccounts.accountId, fromAccountId)
            ),
          });
        }

        const defaultPersona = account?.persona || 'フレンドリーなユーザー';
        const persona = await buildPersonaWithLearnings(
          fromAccountId,
          projectId || 0,
          projectAccount || null,
          defaultPersona
        );

        result = await executeAiComment(apiKey, fromDeviceId, targetUrl, openaiApiKey, persona);
        break;

      case 'retweet':
        if (!targetUrl) throw new Error('Target URL is required for retweet');
        result = await executeRetweet(apiKey, fromDeviceId, targetUrl);
        break;

      case 'follow':
        if (!targetUsername) throw new Error('Target username is required for follow');
        result = await executeFollow(apiKey, fromDeviceId, targetUsername);
        break;

      default:
        throw new Error(`Unknown interaction type: ${type}`);
    }

    // Update interaction status based on result
    if (result.success) {
      await db.update(interactions)
        .set({
          status: 'completed',
          executedAt: toMySQLTimestamp(new Date()),
          commentContent: result.comment || null,
        })
        .where(eq(interactions.id, interactionId));

      logger.info({ interactionId }, "Interaction completed successfully");
    } else {
      // Let Bull handle retry logic
      const currentInteraction = await db.query.interactions.findFirst({
        where: eq(interactions.id, interactionId),
      });
      const retryCount = (currentInteraction?.retryCount || 0) + 1;

      await db.update(interactions)
        .set({
          status: retryCount >= 3 ? 'failed' : 'pending',
          errorMessage: result.error,
          retryCount,
        })
        .where(eq(interactions.id, interactionId));

      if (retryCount < 3) {
        throw new Error(result.error || 'Interaction failed'); // Trigger Bull retry
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ interactionId, error: errorMessage }, "Interaction error");

    // Update with error message
    await db.update(interactions)
      .set({
        errorMessage: errorMessage,
      })
      .where(eq(interactions.id, interactionId));

    throw error; // Re-throw to trigger Bull retry
  }
}

// Interval for engagement tracking processor (5 minutes)
const ENGAGEMENT_TRACKING_INTERVAL_MS = 5 * 60 * 1000;
let engagementTrackingIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the engagement tracking processor
 * Periodically checks for due tracking jobs and processes them
 */
function startEngagementTrackingProcessor(): void {
  if (engagementTrackingIntervalId) {
    logger.info("Engagement tracking processor already running");
    return;
  }

  // Initial run after 30 seconds (let other services start first)
  setTimeout(async () => {
    logger.info("Starting initial engagement tracking check...");
    try {
      const result = await processDueTrackingJobs();
      if (result.processed > 0) {
        logger.info({ processed: result.processed, succeeded: result.succeeded, failed: result.failed }, "Initial tracking completed");
      }
    } catch (error) {
      logger.error({ err: error }, "Initial engagement tracking error");
    }
  }, 30 * 1000);

  // Set up periodic check
  engagementTrackingIntervalId = setInterval(async () => {
    try {
      const result = await processDueTrackingJobs();
      if (result.processed > 0) {
        logger.info({ processed: result.processed, succeeded: result.succeeded, failed: result.failed }, "Engagement tracking completed");
      }
    } catch (error) {
      logger.error({ err: error }, "Engagement tracking error");
    }
  }, ENGAGEMENT_TRACKING_INTERVAL_MS);

  logger.info({ intervalSeconds: ENGAGEMENT_TRACKING_INTERVAL_MS / 1000 }, "Engagement tracking processor started");
}

/**
 * Stop the engagement tracking processor
 */
export function stopEngagementTrackingProcessor(): void {
  if (engagementTrackingIntervalId) {
    clearInterval(engagementTrackingIntervalId);
    engagementTrackingIntervalId = null;
    logger.info("Engagement tracking processor stopped");
  }
}

/**
 * Register all processors with queues
 */
export function registerQueueProcessors(): void {
  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '3', 10);

  // Register scheduled posts processor
  const scheduledPostsQueue = getScheduledPostsQueue();
  scheduledPostsQueue.process(concurrency, async (job) => {
    return processScheduledPostJob(job);
  });
  logger.info({ concurrency }, "Scheduled posts processor registered");

  // Register interactions processor (lower concurrency for rate limiting)
  const interactionsQueue = getInteractionsQueue();
  interactionsQueue.process(Math.max(1, Math.floor(concurrency / 2)), async (job) => {
    return processInteractionJob(job);
  });
  logger.info({ concurrency: Math.max(1, Math.floor(concurrency / 2)) }, "Interactions processor registered");

  // Start engagement tracking processor (DB-based scheduler)
  startEngagementTrackingProcessor();
}
