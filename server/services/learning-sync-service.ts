/**
 * Learning Sync Service
 *
 * Auto-syncs buzz learnings to account learnings via accountModelAccounts linkage.
 * When a buzz learning is created with sufficient confidence, it is automatically
 * applied to all linked accounts that have autoApplyLearnings enabled.
 */

import { db } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { applyBuzzLearningToAccount } from "./account-learning-service";

import { createLogger } from "../utils/logger";

const logger = createLogger("learning-sync-service");

/**
 * Sync a single buzz learning to all relevant accounts.
 * Called after buzz analysis creates a new learning.
 *
 * Flow:
 * 1. Get the buzz learning and check confidence >= 60
 * 2. Find the learning's project (via buzzLearnings.projectId)
 * 3. Find model accounts linked to the same project
 * 4. Find accounts linked to those model accounts with autoApplyLearnings=1
 * 5. For each account, skip if already synced, otherwise apply and log
 *
 * @returns count of newly synced accounts
 */
export async function syncBuzzLearningToAccounts(buzzLearningId: number): Promise<number> {
  // Get the buzz learning
  const [buzzLearning] = await db
    .select()
    .from(schema.buzzLearnings)
    .where(eq(schema.buzzLearnings.id, buzzLearningId));

  if (!buzzLearning) {
    logger.warn(`[LearningSyncService] Buzz learning ${buzzLearningId} not found`);
    return 0;
  }

  // Skip if confidence is below threshold
  if (buzzLearning.confidence < 60) {
    logger.info(
      `[LearningSyncService] Skipping buzz learning ${buzzLearningId}: confidence ${buzzLearning.confidence} < 60`
    );
    return 0;
  }

  // Find accounts linked via accountModelAccounts where autoApplyLearnings is enabled.
  // The linkage path is:
  //   buzzLearning.projectId -> modelAccounts.projectId -> accountModelAccounts -> accounts
  const projectId = buzzLearning.projectId;

  if (!projectId) {
    logger.info(
      `[LearningSyncService] Buzz learning ${buzzLearningId} has no projectId, skipping sync`
    );
    return 0;
  }

  // Get model accounts for this project
  const modelAccountsForProject = await db
    .select()
    .from(schema.modelAccounts)
    .where(eq(schema.modelAccounts.projectId, projectId));

  if (modelAccountsForProject.length === 0) {
    logger.info(
      `[LearningSyncService] No model accounts found for project ${projectId}`
    );
    return 0;
  }

  const modelAccountIds = modelAccountsForProject.map((ma) => ma.id);

  // Find account links with autoApplyLearnings enabled
  const accountLinks: Array<{ accountId: number; modelAccountId: number }> = [];
  for (const modelAccountId of modelAccountIds) {
    const links = await db
      .select()
      .from(schema.accountModelAccounts)
      .where(
        and(
          eq(schema.accountModelAccounts.modelAccountId, modelAccountId),
          eq(schema.accountModelAccounts.autoApplyLearnings, 1)
        )
      );

    for (const link of links) {
      accountLinks.push({
        accountId: link.accountId,
        modelAccountId: link.modelAccountId,
      });
    }
  }

  if (accountLinks.length === 0) {
    logger.info(
      `[LearningSyncService] No accounts with autoApplyLearnings=1 for project ${projectId}`
    );
    return 0;
  }

  // Deduplicate by accountId (an account could be linked to multiple model accounts)
  const uniqueAccountIds = [...new Set(accountLinks.map((l) => l.accountId))];

  let syncedCount = 0;

  for (const accountId of uniqueAccountIds) {
    try {
      // Check if already synced
      const [existingSync] = await db
        .select()
        .from(schema.learningSyncLog)
        .where(
          and(
            eq(schema.learningSyncLog.sourceLearningType, "buzz_learning"),
            eq(schema.learningSyncLog.sourceLearningId, buzzLearningId),
            eq(schema.learningSyncLog.targetAccountId, accountId)
          )
        );

      if (existingSync) {
        logger.info(
          `[LearningSyncService] Already synced buzz learning ${buzzLearningId} to account ${accountId}, skipping`
        );
        continue;
      }

      // Apply the buzz learning to the account
      const accountLearningId = await applyBuzzLearningToAccount(
        buzzLearningId,
        accountId,
        projectId
      );

      // Record in sync log
      await db.insert(schema.learningSyncLog).values({
        sourceLearningType: "buzz_learning",
        sourceLearningId: buzzLearningId,
        targetAccountId: accountId,
        accountLearningId,
        relevanceScore: buzzLearning.confidence,
        autoApplied: 1,
      });

      // Update lastSyncedAt on the accountModelAccounts link
      const linkForAccount = accountLinks.find((l) => l.accountId === accountId);
      if (linkForAccount) {
        await db
          .update(schema.accountModelAccounts)
          .set({ lastSyncedAt: new Date().toISOString() })
          .where(
            and(
              eq(schema.accountModelAccounts.accountId, accountId),
              eq(schema.accountModelAccounts.modelAccountId, linkForAccount.modelAccountId)
            )
          );
      }

      syncedCount++;
      logger.info(
        `[LearningSyncService] Synced buzz learning ${buzzLearningId} -> account ${accountId} (accountLearningId: ${accountLearningId})`
      );
    } catch (error) {
      logger.error(
        `[LearningSyncService] Error syncing buzz learning ${buzzLearningId} to account ${accountId}:`,
        error
      );
    }
  }

  logger.info(
    `[LearningSyncService] Synced buzz learning ${buzzLearningId} to ${syncedCount}/${uniqueAccountIds.length} accounts`
  );

  return syncedCount;
}

/**
 * Sync all unsynced buzz learnings for a project.
 * Finds active buzz learnings with confidence >= 60 that haven't been
 * fully synced to all eligible accounts yet.
 *
 * @returns counts of synced and skipped learnings
 */
export async function syncAllBuzzLearnings(
  projectId: number
): Promise<{ synced: number; skipped: number }> {
  let synced = 0;
  let skipped = 0;

  // Get all active buzz learnings for the project with confidence >= 60
  const buzzLearnings = await db
    .select()
    .from(schema.buzzLearnings)
    .where(
      and(
        eq(schema.buzzLearnings.projectId, projectId),
        eq(schema.buzzLearnings.isActive, 1),
        gte(schema.buzzLearnings.confidence, 60)
      )
    )
    .orderBy(desc(schema.buzzLearnings.confidence));

  if (buzzLearnings.length === 0) {
    logger.info(
      `[LearningSyncService] No eligible buzz learnings found for project ${projectId}`
    );
    return { synced: 0, skipped: 0 };
  }

  for (const learning of buzzLearnings) {
    try {
      const count = await syncBuzzLearningToAccounts(learning.id);
      if (count > 0) {
        synced += count;
      } else {
        skipped++;
      }
    } catch (error) {
      logger.error(
        `[LearningSyncService] Error syncing buzz learning ${learning.id}:`,
        error
      );
      skipped++;
    }
  }

  logger.info(
    `[LearningSyncService] Batch sync for project ${projectId}: synced=${synced}, skipped=${skipped}`
  );

  return { synced, skipped };
}

/**
 * Get sync history for a specific learning.
 * Returns all sync log entries for the given source learning.
 */
export async function getSyncHistory(
  sourceLearningId: number,
  sourceType: "buzz_learning" | "agent_knowledge"
): Promise<Array<typeof schema.learningSyncLog.$inferSelect>> {
  const history = await db
    .select()
    .from(schema.learningSyncLog)
    .where(
      and(
        eq(schema.learningSyncLog.sourceLearningType, sourceType),
        eq(schema.learningSyncLog.sourceLearningId, sourceLearningId)
      )
    )
    .orderBy(desc(schema.learningSyncLog.syncedAt));

  return history;
}
