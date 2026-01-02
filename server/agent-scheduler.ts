/**
 * Agent Scheduler
 * 
 * エージェントの自動投稿スケジュールを管理し、
 * 設定された時間に自動でコンテンツを生成・投稿する
 */

import { db } from "./db";
import { agents, agentAccounts, agentSchedules, accounts } from "../drizzle/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { runAgent } from "./agent-engine";

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
      eq(agentAccounts.isActive, true)
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

  console.log(`[AgentScheduler] Checking scheduled agents at ${now.toISOString()}`);

  // アクティブなエージェントを取得
  const activeAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.isActive, true));

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

      // 現在時刻がスロットに該当するかチェック
      const currentHour = now.getHours().toString().padStart(2, "0");
      const currentMinute = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHour}:${currentMinute}`;

      // 5分の誤差を許容
      const shouldExecute = timeSlots.some(slot => {
        const [slotHour, slotMinute] = slot.split(":").map(Number);
        const slotDate = new Date();
        slotDate.setHours(slotHour, slotMinute, 0, 0);
        
        const diffMs = Math.abs(now.getTime() - slotDate.getTime());
        const diffMinutes = diffMs / (1000 * 60);
        
        return diffMinutes <= 5;
      });

      if (!shouldExecute) {
        continue;
      }

      // 頻度チェック（週次の場合は曜日も確認）
      if (agent.postingFrequency === "weekly") {
        // 週次の場合、特定の曜日のみ実行（デフォルトは月曜日）
        const targetDay = 1; // 月曜日
        if (now.getDay() !== targetDay) {
          continue;
        }
      }

      console.log(`[AgentScheduler] Running agent: ${agent.name} (ID: ${agent.id})`);

      // エージェントを実行
      const result = await runAgent(agent.id);

      if (result.success) {
        results.executed++;
        console.log(`[AgentScheduler] Agent ${agent.id} executed successfully, postId: ${result.postId}`);
      } else {
        results.failed++;
        results.errors.push(`Agent ${agent.id}: ${result.error}`);
        console.error(`[AgentScheduler] Agent ${agent.id} failed: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Agent ${agent.id}: ${errorMessage}`);
      console.error(`[AgentScheduler] Error running agent ${agent.id}:`, error);
    }
  }

  console.log(`[AgentScheduler] Completed: ${results.executed} executed, ${results.failed} failed`);
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
      updatedAt: new Date(),
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
  platform: string;
  scheduledTime: Date;
}[]> {
  const activeAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.isActive, true));

  const allExecutions: {
    agentId: number;
    agentName: string;
    accountId: number;
    platform: string;
    scheduledTime: Date;
  }[] = [];

  for (const agent of activeAgents) {
    const executions = await getAgentScheduledTimes(agent.id);
    
    for (const exec of executions) {
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, exec.accountId),
      });

      allExecutions.push({
        agentId: exec.agentId,
        agentName: agent.name,
        accountId: exec.accountId,
        platform: account?.platform || "unknown",
        scheduledTime: exec.scheduledTime,
      });
    }
  }

  // 時間順にソート
  allExecutions.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

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
    console.log("[AgentScheduler] Scheduler already running");
    return;
  }

  console.log("[AgentScheduler] Starting scheduler...");
  
  // 1分ごとにチェック
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndRunScheduledAgents();
    } catch (error) {
      console.error("[AgentScheduler] Scheduler error:", error);
    }
  }, 60 * 1000); // 1分

  // 初回実行
  checkAndRunScheduledAgents().catch(console.error);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[AgentScheduler] Scheduler stopped");
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
