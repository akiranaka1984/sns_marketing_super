import { db } from "./db";
import { interactions, postUrls, accounts, projectAccounts } from "../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { executeLike, executeAiComment, executeRetweet, executeFollow } from "./utils/python-runner";
import { getAccountLearnings } from "./services/account-learning-service";
import { addInteractionJob, type InteractionJob } from "./queue-manager";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Build persona string from project account settings
 */
function buildPersonaString(
  projectAccount: { personaRole: string | null; personaTone: string | null; personaCharacteristics: string | null } | null,
  defaultPersona: string
): string {
  if (!projectAccount || (!projectAccount.personaRole && !projectAccount.personaCharacteristics)) {
    return defaultPersona;
  }

  const parts: string[] = [];
  if (projectAccount.personaRole) {
    parts.push(projectAccount.personaRole);
  }
  if (projectAccount.personaTone) {
    parts.push(`トーン: ${projectAccount.personaTone}`);
  }
  if (projectAccount.personaCharacteristics) {
    parts.push(projectAccount.personaCharacteristics);
  }

  return parts.join("。") || defaultPersona;
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
  // Get base persona
  const basePersona = buildPersonaString(projectAccount, defaultPersona);

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
    console.error(`[InteractionScheduler] Failed to get account learnings:`, error);
    return basePersona;
  }
}

let isRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * 実行予定のタスクを処理
 */
async function processScheduledInteractions(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();
  const result = { processed: 0, succeeded: 0, failed: 0 };

  // 実行予定時刻が過ぎたpendingタスクを取得（最大5件ずつ処理）
  const tasks = await db
    .select({
      interaction: interactions,
      postUrl: postUrls,
      account: accounts,
    })
    .from(interactions)
    .leftJoin(postUrls, eq(interactions.postUrlId, postUrls.id))
    .leftJoin(accounts, eq(interactions.fromAccountId, accounts.id))
    .where(
      and(
        eq(interactions.status, "pending"),
        lte(interactions.scheduledAt, toMySQLTimestamp(now))
      )
    )
    .orderBy(interactions.scheduledAt)
    .limit(5);

  for (const task of tasks) {
    // Follow tasks don't need postUrl, other tasks do
    const isFollowTask = task.interaction.interactionType === "follow";
    if (!task.account || (!isFollowTask && !task.postUrl)) continue;

    result.processed++;
    console.log(`[InteractionScheduler] Processing ${task.interaction.interactionType} task ${task.interaction.id}`);

    // ステータスを処理中に更新
    await db.update(interactions)
      .set({ status: "processing" })
      .where(eq(interactions.id, task.interaction.id));

    try {
      let execResult;

      const apiKey = process.env.AUTOMATION_API_KEY || '';
      if (task.interaction.interactionType === "like") {
        execResult = await executeLike(apiKey, task.interaction.fromDeviceId, task.postUrl!.postUrl);
      } else if (task.interaction.interactionType === "comment") {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          execResult = { success: false, error: "OPENAI_API_KEYが設定されていません" };
        } else {
          // プロジェクト固有のペルソナを取得（なければアカウントのペルソナ、さらになければデフォルト）
          const projectAccount = await db.query.projectAccounts.findFirst({
            where: and(
              eq(projectAccounts.projectId, task.postUrl!.projectId),
              eq(projectAccounts.accountId, task.account.id)
            ),
          });
          const defaultPersona = task.account.persona || "フレンドリーなユーザー";
          // アカウント学習を含めたペルソナを構築
          const persona = await buildPersonaWithLearnings(
            task.account.id,
            task.postUrl!.projectId,
            projectAccount || null,
            defaultPersona
          );

          execResult = await executeAiComment(
            apiKey,
            task.interaction.fromDeviceId,
            task.postUrl!.postUrl,
            openaiApiKey,
            persona
          );
        }
      } else if (task.interaction.interactionType === "retweet") {
        execResult = await executeRetweet(apiKey, task.interaction.fromDeviceId, task.postUrl!.postUrl);
      } else if (task.interaction.interactionType === "follow") {
        const targetUsername = task.interaction.targetUsername;
        if (!targetUsername) {
          execResult = { success: false, error: "フォロー対象のユーザー名が設定されていません" };
        } else {
          execResult = await executeFollow(apiKey, task.interaction.fromDeviceId, targetUsername);
        }
      } else {
        execResult = { success: false, error: "Unknown interaction type" };
      }

      // 結果を記録
      if (execResult.success) {
        await db.update(interactions)
          .set({
            status: "completed",
            executedAt: toMySQLTimestamp(new Date()),
            commentContent: (execResult as any).comment || null,
          })
          .where(eq(interactions.id, task.interaction.id));
        result.succeeded++;
        console.log(`[InteractionScheduler] Task ${task.interaction.id} completed`);
      } else {
        const retryCount = (task.interaction.retryCount || 0) + 1;
        const newStatus = retryCount >= 3 ? "failed" : "pending";

        // リトライの場合は5分後に再スケジュール
        const nextScheduledAt = newStatus === "pending"
          ? toMySQLTimestamp(new Date(now.getTime() + 5 * 60 * 1000))
          : null;

        await db.update(interactions)
          .set({
            status: newStatus,
            scheduledAt: nextScheduledAt || task.interaction.scheduledAt,
            errorMessage: execResult.error,
            retryCount,
          })
          .where(eq(interactions.id, task.interaction.id));
        result.failed++;
        console.log(`[InteractionScheduler] Task ${task.interaction.id} failed (retry ${retryCount}/3): ${execResult.error}`);
      }
    } catch (error) {
      await db.update(interactions)
        .set({
          status: "failed",
          errorMessage: String(error),
        })
        .where(eq(interactions.id, task.interaction.id));
      result.failed++;
      console.error(`[InteractionScheduler] Task ${task.interaction.id} error:`, error);
    }

    // タスク間に5秒の待機（連続実行を避ける）
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return result;
}

/**
 * Enqueue pending interactions to the Bull queue
 */
export async function enqueuePendingInteractions(): Promise<number> {
  const now = new Date();

  // Get pending interactions that should be executed now (limit for batching)
  const tasks = await db
    .select({
      interaction: interactions,
      postUrl: postUrls,
      account: accounts,
    })
    .from(interactions)
    .leftJoin(postUrls, eq(interactions.postUrlId, postUrls.id))
    .leftJoin(accounts, eq(interactions.fromAccountId, accounts.id))
    .where(
      and(
        eq(interactions.status, "pending"),
        lte(interactions.scheduledAt, toMySQLTimestamp(now))
      )
    )
    .orderBy(interactions.scheduledAt)
    .limit(20); // Enqueue up to 20 at a time

  if (tasks.length === 0) {
    return 0;
  }

  console.log(`[InteractionScheduler] Enqueueing ${tasks.length} interactions to queue`);

  let enqueued = 0;
  for (const task of tasks) {
    const isFollowTask = task.interaction.interactionType === "follow";
    if (!task.account || (!isFollowTask && !task.postUrl)) continue;

    try {
      const jobData: InteractionJob = {
        interactionId: task.interaction.id,
        type: task.interaction.interactionType as InteractionJob['type'],
        fromDeviceId: task.interaction.fromDeviceId,
        fromAccountId: task.account.id,
        targetUrl: task.postUrl?.postUrl,
        targetUsername: task.interaction.targetUsername || undefined,
        projectId: task.postUrl?.projectId,
      };

      // Add to queue (delay is calculated inside addInteractionJob based on type)
      await addInteractionJob(jobData, { delay: 0 }); // Execute immediately since scheduledAt is already past

      // Update status to 'queued' to prevent re-enqueueing
      await db.update(interactions)
        .set({ status: "processing" }) // Use 'processing' to indicate it's in the queue
        .where(eq(interactions.id, task.interaction.id));

      enqueued++;
    } catch (error) {
      console.error(`[InteractionScheduler] Failed to enqueue interaction ${task.interaction.id}:`, error);
    }
  }

  return enqueued;
}

/**
 * Start interaction enqueuer (runs every minute)
 * This function periodically checks for pending interactions and adds them to the queue
 */
export function startInteractionEnqueuer(): void {
  if (isRunning) {
    console.log("[InteractionScheduler] Already running");
    return;
  }

  isRunning = true;
  console.log("[InteractionScheduler] Started enqueuer");

  // Run immediately
  enqueuePendingInteractions().catch(console.error);

  // Run every minute
  schedulerInterval = setInterval(async () => {
    try {
      const count = await enqueuePendingInteractions();
      if (count > 0) {
        console.log(`[InteractionScheduler] Enqueued ${count} interactions`);
      }
    } catch (error) {
      console.error("[InteractionScheduler] Enqueuer error:", error);
    }
  }, 60 * 1000);
}

/**
 * @deprecated Use startInteractionEnqueuer instead
 * Legacy function for backward compatibility - now uses queue-based processing
 */
export function startInteractionScheduler(): void {
  console.log("[InteractionScheduler] Warning: startInteractionScheduler is deprecated, use startInteractionEnqueuer");
  startInteractionEnqueuer();
}

/**
 * スケジューラーを停止
 */
export function stopInteractionScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isRunning = false;
  console.log("[InteractionScheduler] Stopped");
}

/**
 * スケジューラーの状態を取得
 */
export function getSchedulerStatus(): { isRunning: boolean } {
  return { isRunning };
}
