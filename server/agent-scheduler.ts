/**
 * Agent Scheduler
 * 
 * エージェントの自動投稿スケジュールを管理し、
 * 設定された時間に自動でコンテンツを生成・投稿する
 */

import { db } from "./db";
import { agents, agentAccounts, agentSchedules, agentExecutionLogs, accounts, posts, scheduledPosts } from "../drizzle/schema";
import { eq, and, lte, sql, desc, gte } from "drizzle-orm";
import { runAgent } from "./agent-engine";
import { createLogger } from "./utils/logger";

const logger = createLogger("agent-scheduler");

// ============================================
// Types
// ============================================

interface ScheduledExecution {
  agentId: number;
  accountId: number;
  scheduledTime: Date;
}

// ============================================
// Schedule Calculation
// ============================================

/**
 * 次の実行時刻を計算
 */
function calculateNextExecutionTime(
  timeSlot: string,
  frequency: string,
  dayOfWeek?: number | null,
  timezone: string = "Asia/Tokyo"
): Date {
  const now = new Date();
  const [hours, minutes] = timeSlot.split(":").map(Number);
  
  // 今日の実行時刻を計算
  const todayExecution = new Date();
  todayExecution.setHours(hours, minutes, 0, 0);
  
  // 既に過ぎている場合は次の日
  if (todayExecution <= now) {
    todayExecution.setDate(todayExecution.getDate() + 1);
  }
  
  // 週次の場合は曜日を考慮
  if (frequency === "weekly" && dayOfWeek !== null && dayOfWeek !== undefined) {
    const currentDay = todayExecution.getDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntilTarget === 0 && todayExecution <= now) {
      todayExecution.setDate(todayExecution.getDate() + 7);
    } else {
      todayExecution.setDate(todayExecution.getDate() + daysUntilTarget);
    }
  }
  
  return todayExecution;
}

/**
 * エージェントの投稿スケジュールを取得
 */
export async function getAgentScheduledTimes(agentId: number): Promise<ScheduledExecution[]> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent || !agent.isActive) {
    return [];
  }

  // 紐づくアカウントを取得
  const linkedAccounts = await db
    .select({
      accountId: agentAccounts.accountId,
      account: accounts,
    })
    .from(agentAccounts)
    .leftJoin(accounts, eq(agentAccounts.accountId, accounts.id))
    .where(and(
      eq(agentAccounts.agentId, agentId),
      eq(agentAccounts.isActive, 1)
    ));

  if (linkedAccounts.length === 0) {
    return [];
  }

  // 投稿時間スロットを解析
  let timeSlots: string[] = ["09:00"];
  try {
    if (agent.postingTimeSlots) {
      timeSlots = JSON.parse(agent.postingTimeSlots);
    }
  } catch {
    // デフォルトを使用
  }

  const executions: ScheduledExecution[] = [];

  for (const timeSlot of timeSlots) {
    for (const { accountId, account } of linkedAccounts) {
      if (!account || !account.deviceId) continue;

      const nextTime = calculateNextExecutionTime(
        timeSlot,
        agent.postingFrequency || "daily"
      );

      executions.push({
        agentId,
        accountId,
        scheduledTime: nextTime,
      });
    }
  }

  return executions;
}

// ============================================
// Scheduler Runner
// ============================================

/**
 * 実行が必要なエージェントをチェックして実行
 */
export async function checkAndRunScheduledAgents(): Promise<{
  executed: number;
  failed: number;
  errors: string[];
}> {
  const now = new Date();
  const results = {
    executed: 0,
    failed: 0,
    errors: [] as string[],
  };

  // JST時刻も表示
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  logger.info({ utc: now.toISOString(), jst: jstTime.toISOString().replace('Z', '+09:00') }, "Checking scheduled agents");

  // アクティブなエージェントを取得
  const activeAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.isActive, 1));

  for (const agent of activeAgents) {
    try {
      // 投稿時間スロットを解析
      let timeSlots: string[] = ["09:00"];
      try {
        if (agent.postingTimeSlots) {
          timeSlots = JSON.parse(agent.postingTimeSlots);
        }
      } catch {
        // デフォルトを使用
      }

      // 現在時刻がスロットに該当するかチェック（日本時間 JST = UTC+9）
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const currentHour = jstNow.getUTCHours().toString().padStart(2, "0");
      const currentMinute = jstNow.getUTCMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHour}:${currentMinute}`;

      // 5分の誤差を許容（時間スロットは日本時間で指定）
      const shouldExecute = timeSlots.some(slot => {
        const [slotHour, slotMinute] = slot.split(":").map(Number);
        // Create a JST date for the slot time
        const slotDate = new Date(jstNow);
        slotDate.setUTCHours(slotHour, slotMinute, 0, 0);

        const diffMs = Math.abs(jstNow.getTime() - slotDate.getTime());
        const diffMinutes = diffMs / (1000 * 60);

        return diffMinutes <= 5;
      });

      if (!shouldExecute) {
        continue;
      }

      // 頻度チェック（週次の場合は曜日も確認）- 日本時間基準
      if (agent.postingFrequency === "weekly") {
        // 週次の場合、特定の曜日のみ実行（デフォルトは月曜日）
        const targetDay = 1; // 月曜日
        if (jstNow.getUTCDay() !== targetDay) {
          continue;
        }
      }

      // 重複実行防止: 直近30分以内にこのエージェントが成功実行済みならスキップ
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const recentExecution = await db.query.agentExecutionLogs.findFirst({
        where: and(
          eq(agentExecutionLogs.agentId, agent.id),
          eq(agentExecutionLogs.executionType, "content_generation"),
          eq(agentExecutionLogs.status, "success"),
          gte(agentExecutionLogs.createdAt, thirtyMinutesAgo.toISOString())
        ),
        orderBy: [desc(agentExecutionLogs.createdAt)],
      });

      if (recentExecution) {
        logger.info({ agentId: agent.id, agentName: agent.name, lastExecution: recentExecution.createdAt }, "Skipping agent: already executed");
        continue;
      }

      logger.info({ agentId: agent.id, agentName: agent.name }, "Running agent");

      // エージェントを実行
      const result = await runAgent(agent.id);

      if (result.success) {
        results.executed++;
        logger.info({ agentId: agent.id, postId: result.postId }, "Agent executed successfully");
      } else {
        results.failed++;
        results.errors.push(`Agent ${agent.id}: ${result.error}`);
        logger.error({ agentId: agent.id, error: result.error }, "Agent failed");
      }
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Agent ${agent.id}: ${errorMessage}`);
      logger.error({ err: error, agentId: agent.id }, "Error running agent");
    }
  }

  logger.info({ executed: results.executed, failed: results.failed }, "Scheduler run completed");
  return results;
}

// ============================================
// Schedule Management
// ============================================

/**
 * エージェントのスケジュールを更新
 */
export async function updateAgentSchedule(
  agentId: number,
  frequency: string,
  timeSlots: string[]
): Promise<void> {
  await db.update(agents)
    .set({
      postingFrequency: frequency as any,
      postingTimeSlots: JSON.stringify(timeSlots),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(agents.id, agentId));
}

/**
 * すべてのアクティブエージェントの次回実行予定を取得
 */
export async function getAllScheduledExecutions(): Promise<{
  agentId: number;
  agentName: string;
  accountId: number;
  accountUsername: string;
  platform: string;
  scheduledTime: Date;
  agentTheme: string;
  agentTone: string;
  agentStyle: string;
  recentPostContent?: string;
  scheduledPostContent?: string;
  scheduledPostId?: number;
}[]> {
  const allExecutions: {
    agentId: number;
    agentName: string;
    accountId: number;
    accountUsername: string;
    platform: string;
    scheduledTime: Date;
    agentTheme: string;
    agentTone: string;
    agentStyle: string;
    recentPostContent?: string;
    scheduledPostContent?: string;
    scheduledPostId?: number;
  }[] = [];

  // 1. アクティブなエージェントの設定から次回実行予定を計算
  const activeAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.isActive, 1));

  for (const agent of activeAgents) {
    // 紐づくアカウントを取得
    const linkedAccounts = await db
      .select({
        accountId: agentAccounts.accountId,
        account: accounts,
      })
      .from(agentAccounts)
      .leftJoin(accounts, eq(agentAccounts.accountId, accounts.id))
      .where(and(
        eq(agentAccounts.agentId, agent.id),
        eq(agentAccounts.isActive, 1)
      ));

    if (linkedAccounts.length === 0) continue;

    // 投稿時間スロットを解析
    let timeSlots: string[] = ["09:00"];
    try {
      if (agent.postingTimeSlots) {
        timeSlots = JSON.parse(agent.postingTimeSlots);
      }
    } catch {
      // デフォルトを使用
    }

    // 最近の投稿を取得（参考表示用）
    const recentPost = await db.query.posts.findFirst({
      where: eq(posts.agentId, agent.id),
      orderBy: [desc(posts.createdAt)],
    });

    for (const timeSlot of timeSlots) {
      for (const { accountId, account } of linkedAccounts) {
        if (!account) continue;

        const nextTime = calculateNextExecutionTime(
          timeSlot,
          agent.postingFrequency || "daily"
        );

        allExecutions.push({
          agentId: agent.id,
          agentName: agent.name,
          accountId,
          accountUsername: account.username || "unknown",
          platform: account.platform || "unknown",
          scheduledTime: nextTime,
          agentTheme: agent.theme || "",
          agentTone: agent.tone || "",
          agentStyle: agent.style || "",
          recentPostContent: recentPost?.content || undefined,
          scheduledPostContent: undefined,
          scheduledPostId: undefined,
        });
      }
    }
  }

  // 2. scheduledPostsテーブルの未処理レコードも追加
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const pendingPosts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.status, "pending"),
      gte(scheduledPosts.scheduledTime, nowStr)
    ),
    orderBy: [desc(scheduledPosts.scheduledTime)],
  });

  for (const post of pendingPosts) {
    const agent = post.agentId
      ? await db.query.agents.findFirst({ where: eq(agents.id, post.agentId) })
      : null;

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, post.accountId),
    });

    allExecutions.push({
      agentId: post.agentId || 0,
      agentName: agent?.name || "Manual",
      accountId: post.accountId,
      accountUsername: account?.username || "unknown",
      platform: account?.platform || "unknown",
      scheduledTime: new Date(post.scheduledTime),
      agentTheme: agent?.theme || "",
      agentTone: agent?.tone || "",
      agentStyle: agent?.style || "",
      recentPostContent: undefined,
      scheduledPostContent: post.content,
      scheduledPostId: post.id,
    });
  }

  // 時間順にソート
  allExecutions.sort((a, b) => {
    const timeA = a.scheduledTime instanceof Date ? a.scheduledTime.getTime() : new Date(a.scheduledTime).getTime();
    const timeB = b.scheduledTime instanceof Date ? b.scheduledTime.getTime() : new Date(b.scheduledTime).getTime();
    return timeA - timeB;
  });

  return allExecutions;
}

// ============================================
// Cron Job Setup (for external scheduler)
// ============================================

/**
 * スケジューラーを開始（1分ごとにチェック）
 */
let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (schedulerInterval) {
    logger.info("Scheduler already running");
    return;
  }

  logger.info("Starting scheduler...");
  
  // 1分ごとにチェック
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndRunScheduledAgents();
    } catch (error) {
      logger.error({ err: error }, "Scheduler error");
    }
  }, 60 * 1000); // 1分

  // 初回実行
  checkAndRunScheduledAgents().catch((err) => logger.error({ err }, "Initial scheduler run failed"));
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("Scheduler stopped");
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
