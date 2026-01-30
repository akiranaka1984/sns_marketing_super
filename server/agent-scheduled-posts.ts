/**
 * Agent Scheduled Posts Integration
 * 
 * エージェントが生成したコンテンツをスケジュール投稿として登録し、
 * レビュー・承認フローを経て投稿する機能
 */

import { db } from "./db";
import { 
  scheduledPosts, 
  agents, 
  accounts,
  agentAccounts,
  agentSchedules,
  agentExecutionLogs,
  projects
} from "../drizzle/schema";
import { eq, and, sql, desc, lte } from "drizzle-orm";
import { buildAgentContext, generateContent } from "./agent-engine";

// ============================================
// Types
// ============================================

interface ScheduledPostInput {
  agentId: number;
  accountId: number;
  projectId: number;
  content: string;
  hashtags: string[];
  mediaUrls?: string[];
  scheduledTime: Date;
  confidence: number;
}

interface GenerateScheduledPostsResult {
  success: boolean;
  postsCreated: number;
  posts: {
    id: number;
    accountId: number;
    scheduledTime: Date;
    content: string;
  }[];
  error?: string;
}

// ============================================
// Scheduled Post Creation
// ============================================

/**
 * エージェントが生成したコンテンツをスケジュール投稿として登録
 */
export async function createAgentScheduledPost(input: ScheduledPostInput): Promise<number> {
  const hashtagText = input.hashtags.map(h => `#${h}`).join(' ');
  const fullContent = input.content + (hashtagText ? '\n\n' + hashtagText : '');

  // プロジェクトのexecutionModeを取得
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });

  // フルオートモードの場合は自動承認
  const reviewStatus = project?.executionMode === 'fullAuto' ? 'approved' : 'pending_review';

  const [result] = await db.insert(scheduledPosts).values({
    projectId: input.projectId,
    accountId: input.accountId,
    content: fullContent,
    originalContent: fullContent,
    mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
    hashtags: JSON.stringify(input.hashtags),
    scheduledTime: input.scheduledTime,
    repeatInterval: "none",
    status: "pending",
    agentId: input.agentId,
    generatedByAgent: true,
    reviewStatus,
    contentConfidence: input.confidence,
  });

  console.log(`[AgentScheduledPosts] Created scheduled post ${result.insertId} for agent ${input.agentId} with reviewStatus: ${reviewStatus}`);
  return result.insertId;
}

/**
 * エージェントのスケジュール設定に基づいて投稿時間を計算
 */
export function calculatePostTimes(
  schedule: typeof agentSchedules.$inferSelect,
  count: number
): Date[] {
  const times: Date[] = [];
  const now = new Date();
  
  // 投稿時間帯をパース
  let postingHours: number[] = [9, 12, 18, 21]; // デフォルト
  if (schedule.timeSlot) {
    try {
      // timeSlotから時間を抽出（例: "09:00", "12:00"）
      const hour = parseInt(schedule.timeSlot.split(':')[0]);
      if (!isNaN(hour)) {
        postingHours = [hour];
      }
    } catch (e) {
      console.warn('[AgentScheduledPosts] Failed to parse time slot, using defaults');
    }
  }

  // 今日から開始して、必要な数の投稿時間を生成
  let currentDate = new Date(now);
  let postsGenerated = 0;
  const maxDays = 30; // 最大30日先まで
  let daysChecked = 0;

  while (postsGenerated < count && daysChecked < maxDays) {
    // 曜日チェック（日曜=0, 月曜=1, ...）
    const currentDayOfWeek = currentDate.getDay();
    // dayOfWeekが設定されていればその曜日のみ、なければ毎日
    const targetDays = schedule.dayOfWeek !== null 
      ? [schedule.dayOfWeek] 
      : [0, 1, 2, 3, 4, 5, 6]; // デフォルトは毎日

    if (targetDays.includes(currentDayOfWeek)) {
      // この日の投稿時間を追加
      for (const hour of postingHours) {
        if (postsGenerated >= count) break;

        const postTime = new Date(currentDate);
        postTime.setHours(hour, 0, 0, 0);

        // 過去の時間はスキップ
        if (postTime > now) {
          times.push(postTime);
          postsGenerated++;
        }
      }
    }

    // 次の日へ
    currentDate.setDate(currentDate.getDate() + 1);
    daysChecked++;
  }

  return times;
}

/**
 * エージェントが複数のスケジュール投稿を一括生成
 */
export async function generateScheduledPosts(
  agentId: number,
  count: number = 5,
  accountId?: number
): Promise<GenerateScheduledPostsResult> {
  const startTime = Date.now();

  // 実行ログを開始
  const [logEntry] = await db.insert(agentExecutionLogs).values({
    agentId,
    accountId,
    executionType: 'scheduled_post_generation',
    status: 'started',
  });
  const logId = logEntry.insertId;

  try {
    // エージェントコンテキストを構築
    const context = await buildAgentContext(agentId);
    if (!context) {
      await updateLog(logId, 'failed', 'Agent not found', startTime);
      return { success: false, postsCreated: 0, posts: [], error: 'Agent not found' };
    }

    const { agent } = context;

    // 投稿先アカウントを決定
    let targetAccounts: (typeof accounts.$inferSelect)[] = [];
    if (accountId) {
      const account = context.accounts.find(a => a.id === accountId);
      if (account) targetAccounts = [account];
    } else {
      targetAccounts = context.accounts;
    }

    if (targetAccounts.length === 0) {
      await updateLog(logId, 'failed', 'No accounts available', startTime);
      return { success: false, postsCreated: 0, posts: [], error: 'No accounts available' };
    }

    // スケジュール設定を取得
    const schedule = await db.query.agentSchedules.findFirst({
      where: and(
        eq(agentSchedules.agentId, agentId),
        eq(agentSchedules.isActive, true)
      ),
    });

    // 投稿時間を計算
    const postTimes = schedule 
      ? calculatePostTimes(schedule, count)
      : generateDefaultPostTimes(count);

    const createdPosts: { id: number; accountId: number; scheduledTime: Date; content: string }[] = [];
    const recentContents: string[] = [];

    // 各投稿時間に対してコンテンツを生成
    for (let i = 0; i < postTimes.length; i++) {
      const postTime = postTimes[i];
      const targetAccount = targetAccounts[i % targetAccounts.length];

      try {
        // 同一アカウント・同一時刻の既存投稿チェック
        const existingPost = await db.query.scheduledPosts.findFirst({
          where: and(
            eq(scheduledPosts.accountId, targetAccount.id),
            eq(scheduledPosts.scheduledTime, postTime),
            eq(scheduledPosts.status, "pending")
          ),
        });
        if (existingPost) {
          console.log(`[AgentScheduledPosts] Skipping duplicate: account ${targetAccount.id} at ${postTime.toISOString()}`);
          continue;
        }

        // コンテンツを生成（アカウント固有のペルソナ・学習を反映）
        let content = await generateContent(context, undefined, targetAccount.id);

        // 直前の生成内容との重複チェック（最大2回リトライ）
        let retries = 0;
        while (retries < 2 && recentContents.some(rc => isSimilar(rc, content.content))) {
          console.log(`[AgentScheduledPosts] Similar content detected, regenerating (retry ${retries + 1})`);
          content = await generateContent(context, undefined, targetAccount.id);
          retries++;
        }

        recentContents.push(content.content);

        // スケジュール投稿として登録
        const postId = await createAgentScheduledPost({
          agentId,
          accountId: targetAccount.id,
          projectId: agent.projectId || 1,
          content: content.content,
          hashtags: content.hashtags,
          scheduledTime: postTime,
          confidence: content.confidence,
        });

        createdPosts.push({
          id: postId,
          accountId: targetAccount.id,
          scheduledTime: postTime,
          content: content.content,
        });

        console.log(`[AgentScheduledPosts] Generated post ${i + 1}/${postTimes.length} for ${postTime.toISOString()}`);
      } catch (error) {
        console.error(`[AgentScheduledPosts] Failed to generate post ${i + 1}:`, error);
      }
    }

    // ログを更新
    await updateLog(logId, 'success', null, startTime, {
      postsCreated: createdPosts.length,
      postIds: createdPosts.map(p => p.id),
    });

    return {
      success: true,
      postsCreated: createdPosts.length,
      posts: createdPosts,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateLog(logId, 'failed', errorMessage, startTime);
    return { success: false, postsCreated: 0, posts: [], error: errorMessage };
  }
}

/**
 * デフォルトの投稿時間を生成（スケジュール設定がない場合）
 */
function generateDefaultPostTimes(count: number): Date[] {
  const times: Date[] = [];
  const now = new Date();
  const defaultHours = [9, 12, 18, 21];

  let currentDate = new Date(now);
  let postsGenerated = 0;

  while (postsGenerated < count) {
    for (const hour of defaultHours) {
      if (postsGenerated >= count) break;

      const postTime = new Date(currentDate);
      postTime.setHours(hour, 0, 0, 0);

      if (postTime > now) {
        times.push(postTime);
        postsGenerated++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return times;
}

/**
 * 実行ログを更新
 */
async function updateLog(
  logId: number, 
  status: string, 
  errorMessage: string | null, 
  startTime: number,
  outputData?: object
): Promise<void> {
    await db.update(agentExecutionLogs)
    .set({
      status: status as "started" | "success" | "failed" | "skipped",
      errorMessage,
      outputData: outputData ? JSON.stringify(outputData) : null,
      executionTimeMs: Date.now() - startTime,
    })
    .where(eq(agentExecutionLogs.id, logId));
}

// ============================================
// Review & Approval
// ============================================

/**
 * スケジュール投稿を承認
 */
export async function approveScheduledPost(postId: number, notes?: string): Promise<void> {
  await db.update(scheduledPosts)
    .set({
      reviewStatus: "approved",
      reviewedAt: new Date(),
      reviewNotes: notes,
    })
    .where(eq(scheduledPosts.id, postId));

  console.log(`[AgentScheduledPosts] Approved post ${postId}`);
}

/**
 * スケジュール投稿を却下
 */
export async function rejectScheduledPost(postId: number, reason: string): Promise<void> {
  await db.update(scheduledPosts)
    .set({
      reviewStatus: "rejected",
      status: "cancelled",
      reviewedAt: new Date(),
      reviewNotes: reason,
    })
    .where(eq(scheduledPosts.id, postId));

  console.log(`[AgentScheduledPosts] Rejected post ${postId}: ${reason}`);
}

/**
 * スケジュール投稿を編集
 */
export async function editScheduledPost(
  postId: number, 
  content: string, 
  hashtags?: string[]
): Promise<void> {
  const hashtagText = hashtags ? hashtags.map(h => `#${h}`).join(' ') : '';
  const fullContent = content + (hashtagText ? '\n\n' + hashtagText : '');

  await db.update(scheduledPosts)
    .set({
      content: fullContent,
      hashtags: hashtags ? JSON.stringify(hashtags) : undefined,
    })
    .where(eq(scheduledPosts.id, postId));

  console.log(`[AgentScheduledPosts] Edited post ${postId}`);
}

/**
 * 複数のスケジュール投稿を一括承認
 */
export async function bulkApproveScheduledPosts(postIds: number[]): Promise<number> {
  let approved = 0;
  for (const postId of postIds) {
    try {
      await approveScheduledPost(postId);
      approved++;
    } catch (error) {
      console.error(`[AgentScheduledPosts] Failed to approve post ${postId}:`, error);
    }
  }
  return approved;
}

/**
 * 複数のスケジュール投稿を一括却下
 */
export async function bulkRejectScheduledPosts(postIds: number[], reason: string): Promise<number> {
  let rejected = 0;
  for (const postId of postIds) {
    try {
      await rejectScheduledPost(postId, reason);
      rejected++;
    } catch (error) {
      console.error(`[AgentScheduledPosts] Failed to reject post ${postId}:`, error);
    }
  }
  return rejected;
}

// ============================================
// Query Helpers
// ============================================

/**
 * エージェントが生成したスケジュール投稿を取得
 */
export async function getAgentScheduledPosts(
  agentId: number,
  options?: {
    reviewStatus?: "draft" | "pending_review" | "approved" | "rejected";
    status?: "pending" | "posted" | "failed" | "cancelled";
    limit?: number;
  }
): Promise<(typeof scheduledPosts.$inferSelect)[]> {
  const conditions = [
    eq(scheduledPosts.agentId, agentId),
    eq(scheduledPosts.generatedByAgent, true),
  ];

  if (options?.reviewStatus) {
    conditions.push(eq(scheduledPosts.reviewStatus, options.reviewStatus));
  }
  if (options?.status) {
    conditions.push(eq(scheduledPosts.status, options.status));
  }

  return await db.query.scheduledPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(scheduledPosts.scheduledTime)],
    limit: options?.limit || 50,
  });
}

/**
 * レビュー待ちのスケジュール投稿を取得
 */
export async function getPendingReviewPosts(
  agentId?: number,
  limit: number = 50
): Promise<(typeof scheduledPosts.$inferSelect)[]> {
  const conditions = [
    eq(scheduledPosts.generatedByAgent, true),
    eq(scheduledPosts.reviewStatus, "pending_review"),
    eq(scheduledPosts.status, "pending"),
  ];

  if (agentId) {
    conditions.push(eq(scheduledPosts.agentId, agentId));
  }

  return await db.query.scheduledPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(scheduledPosts.scheduledTime)],
    limit,
  });
}

// ============================================
// Utility
// ============================================

/**
 * 2つのテキストが類似しているか簡易判定（先頭50文字が一致 or 全体の80%以上一致）
 */
function isSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  // 先頭50文字の一致チェック
  if (a.substring(0, 50) === b.substring(0, 50)) return true;
  // 短い方の文字列の先頭80%が長い方に含まれるかチェック
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length > 0 && longer.includes(shorter.substring(0, Math.floor(shorter.length * 0.8)))) {
    return true;
  }
  return false;
}
