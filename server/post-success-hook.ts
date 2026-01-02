import { db } from "./db";
import { postUrls, interactions, interactionSettings, accounts } from "../drizzle/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { getPostUrlAfterPublish } from "./x-api-service";

/**
 * ランダムな遅延（分）を計算
 */
function getRandomDelay(minMinutes: number, maxMinutes: number): number {
  return Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
}

/**
 * 投稿成功後に呼び出す関数
 * 
 * @param projectId - プロジェクトID
 * @param accountId - 投稿したアカウントID
 * @param deviceId - 投稿したデバイスID
 * @param username - Xのユーザー名（@なし）
 * @param postContent - 投稿内容
 * @param scheduledPostId - スケジュール投稿ID（オプション）
 */
export async function onPostSuccess(
  projectId: number,
  accountId: number,
  deviceId: string,
  username: string,
  postContent: string,
  scheduledPostId?: number
): Promise<{ success: boolean; postUrl?: string; tasksCreated?: number; error?: string }> {
  try {
    console.log(`[PostSuccessHook] Processing post for @${username}`);

    // 1. 相互連携設定を確認
    const settings = await db.query.interactionSettings.findFirst({
      where: eq(interactionSettings.projectId, projectId),
    });

    if (!settings?.isEnabled) {
      console.log("[PostSuccessHook] Interaction is disabled for this project");
      return { success: true, tasksCreated: 0 };
    }

    // 2. X APIで投稿URLを取得
    const postUrl = await getPostUrlAfterPublish(username, postContent);
    if (!postUrl) {
      console.warn("[PostSuccessHook] Failed to get post URL");
      return { success: false, error: "投稿URLの取得に失敗しました" };
    }

    console.log(`[PostSuccessHook] Got post URL: ${postUrl}`);

    // 3. post_urlsテーブルに保存
    const [postUrlResult] = await db.insert(postUrls).values({
      projectId,
      scheduledPostId,
      accountId,
      deviceId,
      username,
      postUrl,
      postContent,
    });

    const postUrlId = Number(postUrlResult.insertId);

    // 4. 投稿者以外のアクティブなアカウントを取得
    const otherAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, (await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) }))!.userId),
          ne(accounts.id, accountId),
          eq(accounts.platform, "twitter"),
          eq(accounts.status, "active"),
          isNotNull(accounts.deviceId)
        )
      );

    if (otherAccounts.length === 0) {
      console.log("[PostSuccessHook] No other accounts to create tasks for");
      return { success: true, postUrl, tasksCreated: 0 };
    }

    // 5. 相互連携タスクを作成
    const now = new Date();
    let tasksCreated = 0;

    for (const account of otherAccounts) {
      // いいねタスク
      if (settings.likeEnabled) {
        const likeDelay = getRandomDelay(settings.likeDelayMinMin ?? 5, settings.likeDelayMinMax ?? 30);
        const likeScheduledAt = new Date(now.getTime() + likeDelay * 60 * 1000);

        await db.insert(interactions).values({
          postUrlId,
          fromAccountId: account.id,
          fromDeviceId: account.deviceId!,
          interactionType: "like",
          status: "pending",
          scheduledAt: likeScheduledAt,
        });
        tasksCreated++;

        console.log(`[PostSuccessHook] Created like task for @${account.username} at ${likeScheduledAt.toISOString()}`);
      }

      // コメントタスク
      if (settings.commentEnabled) {
        const commentDelay = getRandomDelay(settings.commentDelayMinMin ?? 10, settings.commentDelayMinMax ?? 60);
        const commentScheduledAt = new Date(now.getTime() + commentDelay * 60 * 1000);

        await db.insert(interactions).values({
          postUrlId,
          fromAccountId: account.id,
          fromDeviceId: account.deviceId!,
          interactionType: "comment",
          status: "pending",
          scheduledAt: commentScheduledAt,
        });
        tasksCreated++;

        console.log(`[PostSuccessHook] Created comment task for @${account.username} at ${commentScheduledAt.toISOString()}`);
      }
    }

    console.log(`[PostSuccessHook] Created ${tasksCreated} interaction tasks`);
    return { success: true, postUrl, tasksCreated };
  } catch (error) {
    console.error("[PostSuccessHook] Error:", error);
    return { success: false, error: String(error) };
  }
}
