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

/**
 * Process scheduled post job
 */
async function processScheduledPostJob(job: Job<ScheduledPostJob>): Promise<{
  success: boolean;
  message: string;
  postId: number;
}> {
  const { postId } = job.data;
  console.log(`[QueueProcessor] Processing scheduled post ${postId}`);

  try {
    const result = await publishPost(postId);
    return result;
  } catch (error) {
    console.error(`[QueueProcessor] Error processing post ${postId}:`, error);
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
    console.error(`[QueueProcessor] Failed to get account learnings:`, error);
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
  console.log(`[QueueProcessor] Processing interaction ${interactionId}: ${type}`);

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
          executedAt: new Date().toISOString(),
          commentContent: result.comment || null,
        })
        .where(eq(interactions.id, interactionId));

      console.log(`[QueueProcessor] Interaction ${interactionId} completed successfully`);
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
    console.error(`[QueueProcessor] Interaction ${interactionId} error:`, errorMessage);

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
    console.log('[QueueProcessor] Engagement tracking processor already running');
    return;
  }

  // Initial run after 30 seconds (let other services start first)
  setTimeout(async () => {
    console.log('[QueueProcessor] Starting initial engagement tracking check...');
    try {
      const result = await processDueTrackingJobs();
      if (result.processed > 0) {
        console.log(`[QueueProcessor] Initial tracking: processed ${result.processed}, succeeded ${result.succeeded}, failed ${result.failed}`);
      }
    } catch (error) {
      console.error('[QueueProcessor] Initial engagement tracking error:', error);
    }
  }, 30 * 1000);

  // Set up periodic check
  engagementTrackingIntervalId = setInterval(async () => {
    try {
      const result = await processDueTrackingJobs();
      if (result.processed > 0) {
        console.log(`[QueueProcessor] Engagement tracking: processed ${result.processed}, succeeded ${result.succeeded}, failed ${result.failed}`);
      }
    } catch (error) {
      console.error('[QueueProcessor] Engagement tracking error:', error);
    }
  }, ENGAGEMENT_TRACKING_INTERVAL_MS);

  console.log(`[QueueProcessor] Engagement tracking processor started (interval: ${ENGAGEMENT_TRACKING_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the engagement tracking processor
 */
export function stopEngagementTrackingProcessor(): void {
  if (engagementTrackingIntervalId) {
    clearInterval(engagementTrackingIntervalId);
    engagementTrackingIntervalId = null;
    console.log('[QueueProcessor] Engagement tracking processor stopped');
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
  console.log(`[QueueProcessor] Scheduled posts processor registered with concurrency ${concurrency}`);

  // Register interactions processor (lower concurrency for rate limiting)
  const interactionsQueue = getInteractionsQueue();
  interactionsQueue.process(Math.max(1, Math.floor(concurrency / 2)), async (job) => {
    return processInteractionJob(job);
  });
  console.log(`[QueueProcessor] Interactions processor registered with concurrency ${Math.max(1, Math.floor(concurrency / 2))}`);

  // Start engagement tracking processor (DB-based scheduler)
  startEngagementTrackingProcessor();
}
