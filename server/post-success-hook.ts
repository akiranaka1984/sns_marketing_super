import { db } from "./db";
import { postUrls, interactions, interactionSettings, accounts, accountRelationships } from "../drizzle/schema";
import { eq, and, ne, isNotNull, inArray } from "drizzle-orm";
import { getPostUrlAfterPublish } from "./x-api-service";
import { scheduleTrackingJobs } from "./services/performance-tracking-scheduler";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

interface AccountWithRelationship {
  account: typeof accounts.$inferSelect;
  relationship?: typeof accountRelationships.$inferSelect | null;
}

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

    // 3.5. パフォーマンストラッキングジョブをスケジュール (1h, 24h, 48h, 72h)
    try {
      const trackingResult = await scheduleTrackingJobs(
        postUrlId,
        postUrl,
        accountId,
        projectId
      );
      if (trackingResult.success) {
        console.log(`[PostSuccessHook] Scheduled ${trackingResult.jobsCreated} tracking jobs for post`);
      } else {
        console.warn(`[PostSuccessHook] Failed to schedule tracking jobs: ${trackingResult.error}`);
      }
    } catch (trackingError) {
      console.error("[PostSuccessHook] Error scheduling tracking jobs:", trackingError);
      // Don't fail the entire hook if tracking fails
    }

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

    // 4.5. 各アカウントの関係性データを取得
    const relationships = await db
      .select()
      .from(accountRelationships)
      .where(
        and(
          eq(accountRelationships.projectId, projectId),
          eq(accountRelationships.toAccountId, accountId), // Relationships TO the posting account
          inArray(accountRelationships.fromAccountId, otherAccounts.map(a => a.id)),
          eq(accountRelationships.isActive, 1)
        )
      );

    // Map relationships to accounts
    const accountsWithRelationships: AccountWithRelationship[] = otherAccounts.map(account => ({
      account,
      relationship: relationships.find(r => r.fromAccountId === account.id) || null,
    }));

    // 5. 選択的反応ロジック: 確率と最大数でフィルタリング（関係性を考慮）
    const baseReactionProbability = settings.reactionProbability ?? 100;
    const maxReactingAccounts = settings.maxReactingAccounts ?? 0;

    // 関係性に基づく確率でフィルタリング
    let selectedAccounts = accountsWithRelationships.filter(({ account, relationship }) => {
      // Calculate effective probability based on relationship
      let effectiveProbability = baseReactionProbability;

      if (relationship) {
        // Use relationship-specific probability
        effectiveProbability = relationship.interactionProbability;
        // Boost by intimacy level (higher intimacy = more likely)
        effectiveProbability = effectiveProbability * (0.5 + (relationship.intimacyLevel / 200));
      }

      return Math.random() * 100 < effectiveProbability;
    });

    // 親密度でソート（高い順）
    selectedAccounts.sort((a, b) => {
      const intimacyA = a.relationship?.intimacyLevel ?? 50;
      const intimacyB = b.relationship?.intimacyLevel ?? 50;
      return intimacyB - intimacyA;
    });

    // 最大数でフィルタリング（0 = 無制限）
    if (maxReactingAccounts > 0 && selectedAccounts.length > maxReactingAccounts) {
      // 親密度が高い順に選択（既にソート済み）
      selectedAccounts = selectedAccounts.slice(0, maxReactingAccounts);
    }

    console.log(`[PostSuccessHook] Selected ${selectedAccounts.length}/${otherAccounts.length} accounts (base probability: ${baseReactionProbability}%, max: ${maxReactingAccounts || 'unlimited'})`);

    if (selectedAccounts.length === 0) {
      console.log("[PostSuccessHook] No accounts selected for reaction");
      return { success: true, postUrl, tasksCreated: 0 };
    }

    // 6. 相互連携タスクを作成
    const now = new Date();
    let tasksCreated = 0;

    for (const { account, relationship } of selectedAccounts) {
      // Get preferred reaction types from relationship (or default to both)
      const preferredTypes = relationship?.preferredReactionTypes
        ? JSON.parse(relationship.preferredReactionTypes)
        : ['like', 'comment'];

      // いいねタスク
      if (settings.likeEnabled && preferredTypes.includes('like')) {
        const likeDelay = getRandomDelay(settings.likeDelayMinMin ?? 5, settings.likeDelayMinMax ?? 30);
        const likeScheduledAt = new Date(now.getTime() + likeDelay * 60 * 1000);

        await db.insert(interactions).values({
          postUrlId,
          fromAccountId: account.id,
          fromDeviceId: account.deviceId!,
          interactionType: "like",
          status: "pending",
          scheduledAt: toMySQLTimestamp(likeScheduledAt),
        });
        tasksCreated++;

        const relationInfo = relationship
          ? `(intimacy: ${relationship.intimacyLevel}, type: ${relationship.relationshipType})`
          : '(no relationship data)';
        console.log(`[PostSuccessHook] Created like task for @${account.username} ${relationInfo} at ${likeScheduledAt.toISOString()}`);
      }

      // コメントタスク
      if (settings.commentEnabled && preferredTypes.includes('comment')) {
        const commentDelay = getRandomDelay(settings.commentDelayMinMin ?? 10, settings.commentDelayMinMax ?? 60);
        const commentScheduledAt = new Date(now.getTime() + commentDelay * 60 * 1000);

        // Store comment style metadata for later use in comment generation
        const metadata = relationship?.commentStyle
          ? JSON.stringify({ commentStyle: relationship.commentStyle, intimacyLevel: relationship.intimacyLevel })
          : null;

        await db.insert(interactions).values({
          postUrlId,
          fromAccountId: account.id,
          fromDeviceId: account.deviceId!,
          interactionType: "comment",
          status: "pending",
          scheduledAt: toMySQLTimestamp(commentScheduledAt),
          metadata,
        });
        tasksCreated++;

        const relationInfo = relationship
          ? `(intimacy: ${relationship.intimacyLevel}, style: ${relationship.commentStyle})`
          : '(no relationship data)';
        console.log(`[PostSuccessHook] Created comment task for @${account.username} ${relationInfo} at ${commentScheduledAt.toISOString()}`);
      }

      // リツイートタスク（関係性で許可されている場合のみ）
      if (settings.retweetEnabled && preferredTypes.includes('retweet')) {
        const retweetDelay = getRandomDelay(settings.retweetDelayMinMin ?? 15, settings.retweetDelayMinMax ?? 90);
        const retweetScheduledAt = new Date(now.getTime() + retweetDelay * 60 * 1000);

        await db.insert(interactions).values({
          postUrlId,
          fromAccountId: account.id,
          fromDeviceId: account.deviceId!,
          interactionType: "retweet",
          status: "pending",
          scheduledAt: toMySQLTimestamp(retweetScheduledAt),
        });
        tasksCreated++;

        console.log(`[PostSuccessHook] Created retweet task for @${account.username} at ${retweetScheduledAt.toISOString()}`);
      }

      // フォロータスク（投稿者をフォロー）
      if (settings.followEnabled && preferredTypes.includes('follow')) {
        const followDelay = getRandomDelay(settings.followDelayMinMin ?? 30, settings.followDelayMinMax ?? 180);
        const followScheduledAt = new Date(now.getTime() + followDelay * 60 * 1000);

        await db.insert(interactions).values({
          postUrlId,
          fromAccountId: account.id,
          fromDeviceId: account.deviceId!,
          interactionType: "follow",
          targetUsername: username, // The posting user
          status: "pending",
          scheduledAt: toMySQLTimestamp(followScheduledAt),
        });
        tasksCreated++;

        console.log(`[PostSuccessHook] Created follow task for @${account.username} -> @${username} at ${followScheduledAt.toISOString()}`);
      }
    }

    // 7. 外部ターゲットユーザーへのフォロータスク
    if (settings.followEnabled && settings.followTargetUsers) {
      try {
        const targetUsers: string[] = JSON.parse(settings.followTargetUsers);
        if (Array.isArray(targetUsers) && targetUsers.length > 0) {
          // Select random accounts for external follows (max 2 per target to avoid spam)
          const accountsForExternalFollow = selectedAccounts.slice(0, Math.min(2, selectedAccounts.length));

          for (const targetUser of targetUsers) {
            const cleanUsername = targetUser.replace(/^@/, '').trim();
            if (!cleanUsername) continue;

            for (const { account } of accountsForExternalFollow) {
              const followDelay = getRandomDelay(settings.followDelayMinMin ?? 30, settings.followDelayMinMax ?? 180);
              // Add extra random delay for external follows to spread them out
              const extraDelay = Math.floor(Math.random() * 60);
              const followScheduledAt = new Date(now.getTime() + (followDelay + extraDelay) * 60 * 1000);

              await db.insert(interactions).values({
                postUrlId,
                fromAccountId: account.id,
                fromDeviceId: account.deviceId!,
                interactionType: "follow",
                targetUsername: cleanUsername,
                status: "pending",
                scheduledAt: toMySQLTimestamp(followScheduledAt),
              });
              tasksCreated++;

              console.log(`[PostSuccessHook] Created external follow task for @${account.username} -> @${cleanUsername} at ${followScheduledAt.toISOString()}`);
            }
          }
        }
      } catch (parseError) {
        console.warn("[PostSuccessHook] Failed to parse followTargetUsers:", parseError);
      }
    }

    console.log(`[PostSuccessHook] Created ${tasksCreated} interaction tasks`);
    return { success: true, postUrl, tasksCreated };
  } catch (error) {
    console.error("[PostSuccessHook] Error:", error);
    return { success: false, error: String(error) };
  }
}
