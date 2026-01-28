/**
 * Queue Manager
 *
 * Centralized job queue management using Bull for:
 * - Scheduled post publishing
 * - Automated interactions (likes, comments, retweets, follows)
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Concurrency control to prevent API overload
 * - Duplicate job prevention
 * - Job status monitoring
 */

import Bull from 'bull';
import type { Job, Queue, JobOptions } from 'bull';

// Queue names
export const QUEUE_NAMES = {
  SCHEDULED_POSTS: 'scheduled-posts',
  INTERACTIONS: 'interactions',
} as const;

// Job types
export interface ScheduledPostJob {
  postId: number;
  accountId: number;
  scheduledTime: string;
}

export interface InteractionJob {
  interactionId: number;
  type: 'like' | 'comment' | 'retweet' | 'follow';
  fromDeviceId: string;
  fromAccountId: number;
  targetUrl?: string;
  targetUsername?: string;
  projectId?: number;
}

// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const defaultJobOptions: JobOptions = {
  attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3', 10),
  backoff: {
    type: 'exponential',
    delay: 5000, // Start with 5 seconds
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // Keep completed jobs for 24 hours
    count: 1000, // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
  },
};

// Singleton queue instances
let scheduledPostsQueue: Queue<ScheduledPostJob> | null = null;
let interactionsQueue: Queue<InteractionJob> | null = null;

/**
 * Get or create the scheduled posts queue
 */
export function getScheduledPostsQueue(): Queue<ScheduledPostJob> {
  if (!scheduledPostsQueue) {
    scheduledPostsQueue = new Bull<ScheduledPostJob>(QUEUE_NAMES.SCHEDULED_POSTS, REDIS_URL, {
      defaultJobOptions,
      limiter: {
        max: parseInt(process.env.QUEUE_CONCURRENCY || '3', 10),
        duration: 1000, // 3 jobs per second
      },
    });

    // Global event handlers
    scheduledPostsQueue.on('error', (error) => {
      console.error('[QueueManager] Scheduled posts queue error:', error);
    });

    scheduledPostsQueue.on('waiting', (jobId) => {
      console.log(`[QueueManager] Job ${jobId} waiting`);
    });

    scheduledPostsQueue.on('active', (job) => {
      console.log(`[QueueManager] Processing scheduled post job ${job.id} for post ${job.data.postId}`);
    });

    scheduledPostsQueue.on('completed', (job, result) => {
      console.log(`[QueueManager] Scheduled post job ${job.id} completed:`, result?.success ? 'success' : 'failed');
    });

    scheduledPostsQueue.on('failed', (job, error) => {
      console.error(`[QueueManager] Scheduled post job ${job?.id} failed:`, error.message);
    });

    scheduledPostsQueue.on('stalled', (job) => {
      console.warn(`[QueueManager] Scheduled post job ${job.id} stalled`);
    });
  }
  return scheduledPostsQueue;
}

/**
 * Get or create the interactions queue
 */
export function getInteractionsQueue(): Queue<InteractionJob> {
  if (!interactionsQueue) {
    interactionsQueue = new Bull<InteractionJob>(QUEUE_NAMES.INTERACTIONS, REDIS_URL, {
      defaultJobOptions,
      limiter: {
        max: parseInt(process.env.QUEUE_CONCURRENCY || '2', 10),
        duration: 5000, // 2 jobs per 5 seconds (slower for interactions)
      },
    });

    // Global event handlers
    interactionsQueue.on('error', (error) => {
      console.error('[QueueManager] Interactions queue error:', error);
    });

    interactionsQueue.on('active', (job) => {
      console.log(`[QueueManager] Processing interaction job ${job.id}: ${job.data.type}`);
    });

    interactionsQueue.on('completed', (job, result) => {
      console.log(`[QueueManager] Interaction job ${job.id} completed:`, result?.success ? 'success' : 'failed');
    });

    interactionsQueue.on('failed', (job, error) => {
      console.error(`[QueueManager] Interaction job ${job?.id} failed:`, error.message);
    });

    interactionsQueue.on('stalled', (job) => {
      console.warn(`[QueueManager] Interaction job ${job.id} stalled`);
    });
  }
  return interactionsQueue;
}

/**
 * Add a scheduled post job to the queue
 */
export async function addScheduledPostJob(
  data: ScheduledPostJob,
  options?: Partial<JobOptions>
): Promise<Job<ScheduledPostJob>> {
  const queue = getScheduledPostsQueue();

  // Use postId as job ID to prevent duplicates
  const jobId = `post-${data.postId}`;

  // Check if job already exists
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    console.log(`[QueueManager] Job for post ${data.postId} already exists, skipping`);
    return existingJob;
  }

  return queue.add(data, {
    ...options,
    jobId,
  });
}

/**
 * Add an interaction job to the queue
 */
export async function addInteractionJob(
  data: InteractionJob,
  options?: Partial<JobOptions>
): Promise<Job<InteractionJob>> {
  const queue = getInteractionsQueue();

  // Use interactionId as job ID to prevent duplicates
  const jobId = `interaction-${data.interactionId}`;

  // Check if job already exists
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    console.log(`[QueueManager] Job for interaction ${data.interactionId} already exists, skipping`);
    return existingJob;
  }

  // Add delay for natural timing
  const delayMs = options?.delay || calculateInteractionDelay(data.type);

  return queue.add(data, {
    ...options,
    jobId,
    delay: delayMs,
  });
}

/**
 * Calculate delay for interaction based on type
 */
function calculateInteractionDelay(type: InteractionJob['type']): number {
  const delays = {
    like: [5, 30], // 5-30 minutes
    comment: [10, 60], // 10-60 minutes
    retweet: [5, 30], // 5-30 minutes
    follow: [30, 180], // 30-180 minutes
  };

  const [min, max] = delays[type] || [5, 30];
  const randomMinutes = min + Math.random() * (max - min);
  return Math.floor(randomMinutes * 60 * 1000);
}

/**
 * Get queue status for monitoring
 */
export async function getQueueStatus(): Promise<{
  scheduledPosts: QueueStats;
  interactions: QueueStats;
}> {
  const postsQueue = getScheduledPostsQueue();
  const interactionsQ = getInteractionsQueue();

  const [postsStats, interactionsStats] = await Promise.all([
    getQueueStats(postsQueue),
    getQueueStats(interactionsQ),
  ]);

  return {
    scheduledPosts: postsStats,
    interactions: interactionsStats,
  };
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

async function getQueueStats(queue: Queue): Promise<QueueStats> {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);

  return { waiting, active, completed, failed, delayed, paused };
}

/**
 * Gracefully shutdown all queues
 */
export async function closeQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (scheduledPostsQueue) {
    closePromises.push(scheduledPostsQueue.close());
    scheduledPostsQueue = null;
  }

  if (interactionsQueue) {
    closePromises.push(interactionsQueue.close());
    interactionsQueue = null;
  }

  await Promise.all(closePromises);
  console.log('[QueueManager] All queues closed');
}

/**
 * Clear all jobs from queues (use with caution)
 */
export async function clearQueues(): Promise<void> {
  const postsQueue = getScheduledPostsQueue();
  const interactionsQ = getInteractionsQueue();

  await Promise.all([
    postsQueue.empty(),
    postsQueue.clean(0, 'completed'),
    postsQueue.clean(0, 'failed'),
    interactionsQ.empty(),
    interactionsQ.clean(0, 'completed'),
    interactionsQ.clean(0, 'failed'),
  ]);

  console.log('[QueueManager] All queues cleared');
}

/**
 * Pause/Resume queues
 */
export async function pauseQueues(): Promise<void> {
  const postsQueue = getScheduledPostsQueue();
  const interactionsQ = getInteractionsQueue();

  await Promise.all([
    postsQueue.pause(),
    interactionsQ.pause(),
  ]);

  console.log('[QueueManager] All queues paused');
}

export async function resumeQueues(): Promise<void> {
  const postsQueue = getScheduledPostsQueue();
  const interactionsQ = getInteractionsQueue();

  await Promise.all([
    postsQueue.resume(),
    interactionsQ.resume(),
  ]);

  console.log('[QueueManager] All queues resumed');
}

/**
 * Retry failed jobs
 */
export async function retryFailedJobs(queueName: keyof typeof QUEUE_NAMES): Promise<number> {
  const queue = queueName === 'SCHEDULED_POSTS'
    ? getScheduledPostsQueue()
    : getInteractionsQueue();

  const failedJobs = await queue.getFailed();
  let retried = 0;

  for (const job of failedJobs) {
    await job.retry();
    retried++;
  }

  console.log(`[QueueManager] Retried ${retried} failed jobs in ${queueName}`);
  return retried;
}
