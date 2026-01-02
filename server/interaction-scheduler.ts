import { db } from "./db";
import { interactions, postUrls, accounts } from "../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { executeLike, executeAiComment } from "./utils/python-runner";

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
        lte(interactions.scheduledAt, now)
      )
    )
    .orderBy(interactions.scheduledAt)
    .limit(5);

  for (const task of tasks) {
    if (!task.postUrl || !task.account) continue;

    result.processed++;
    console.log(`[InteractionScheduler] Processing ${task.interaction.interactionType} task ${task.interaction.id}`);

    // ステータスを処理中に更新
    await db.update(interactions)
      .set({ status: "processing" })
      .where(eq(interactions.id, task.interaction.id));

    try {
      let execResult;

      const apiKey = process.env.DUOPLUS_API_KEY;
      if (!apiKey) {
        execResult = { success: false, error: "DUOPLUS_API_KEYが設定されていません" };
      } else if (task.interaction.interactionType === "like") {
        execResult = await executeLike(apiKey, task.interaction.fromDeviceId, task.postUrl.postUrl);
      } else if (task.interaction.interactionType === "comment") {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          execResult = { success: false, error: "OPENAI_API_KEYが設定されていません" };
        } else {
          // アカウントのペルソナを取得（なければデフォルト）
          const persona = task.account.persona || "フレンドリーなユーザー";
          execResult = await executeAiComment(
            apiKey,
            task.interaction.fromDeviceId,
            task.postUrl.postUrl,
            openaiApiKey,
            persona
          );
        }
      } else {
        execResult = { success: false, error: "Unknown interaction type" };
      }

      // 結果を記録
      if (execResult.success) {
        await db.update(interactions)
          .set({
            status: "completed",
            executedAt: new Date(),
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
          ? new Date(now.getTime() + 5 * 60 * 1000)
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
 * スケジューラーを開始（1分ごとに実行）
 */
export function startInteractionScheduler(): void {
  if (isRunning) {
    console.log("[InteractionScheduler] Already running");
    return;
  }

  isRunning = true;
  console.log("[InteractionScheduler] Started");

  // 初回実行
  processScheduledInteractions().catch(console.error);

  // 1分ごとに実行
  schedulerInterval = setInterval(async () => {
    try {
      const result = await processScheduledInteractions();
      if (result.processed > 0) {
        console.log(`[InteractionScheduler] Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`);
      }
    } catch (error) {
      console.error("[InteractionScheduler] Error:", error);
    }
  }, 60 * 1000);
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
