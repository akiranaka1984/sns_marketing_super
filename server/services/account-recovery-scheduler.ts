/**
 * Account Recovery Scheduler
 *
 * Automatically reactivates suspended accounts after a cooldown period.
 * Runs periodically to check for accounts that are ready to be recovered.
 */

import { db } from "../db";
import { accounts, freezeDetections, autoResponses } from "../../drizzle/schema";
import { eq, and, lte, sql } from "drizzle-orm";
// Device pool service removed
const getAvailableDevice = async (): Promise<{ deviceId: string } | null> => null;
const assignDeviceToAccount = async (_accountId: number, _deviceId: string) => ({ success: false, deviceId: null, message: "Device assignment not available" });

// ============================================
// Types
// ============================================

export interface RecoveryCandidate {
  accountId: number;
  username: string;
  suspendedAt: Date;
  hoursElapsed: number;
  hasDevice: boolean;
  hasProxy: boolean;
}

export interface RecoveryResult {
  accountId: number;
  success: boolean;
  message: string;
  newStatus?: string;
}

// ============================================
// Configuration
// ============================================

const DEFAULT_COOLDOWN_HOURS = 24;
const MAX_COOLDOWN_HOURS = 48;
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// ============================================
// Core Functions
// ============================================

/**
 * Find accounts that are ready for recovery
 * (suspended for at least 24 hours)
 */
export async function findRecoveryCandidates(
  minHours: number = DEFAULT_COOLDOWN_HOURS
): Promise<RecoveryCandidate[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - minHours);

  const suspendedAccounts = await db.select()
    .from(accounts)
    .where(eq(accounts.status, "suspended"));

  const candidates: RecoveryCandidate[] = [];

  for (const account of suspendedAccounts) {
    // Get the freeze detection that caused the suspension
    const freeze = await db.select()
      .from(freezeDetections)
      .where(
        and(
          eq(freezeDetections.accountId, account.id),
          eq(freezeDetections.freezeType, "account_freeze")
        )
      )
      .orderBy(sql`${freezeDetections.createdAt} DESC`)
      .limit(1);

    const suspendedAt = freeze.length > 0 && freeze[0].createdAt
      ? new Date(freeze[0].createdAt)
      : new Date(account.updatedAt || account.createdAt);

    const hoursElapsed = (Date.now() - suspendedAt.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed >= minHours) {
      candidates.push({
        accountId: account.id,
        username: account.username,
        suspendedAt,
        hoursElapsed: Math.round(hoursElapsed),
        hasDevice: !!account.deviceId,
        hasProxy: !!account.proxyId
      });
    }
  }

  return candidates;
}

/**
 * Recover a single account
 */
export async function recoverAccount(accountId: number): Promise<RecoveryResult> {
  try {
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId)
    });

    if (!account) {
      return {
        accountId,
        success: false,
        message: "Account not found"
      };
    }

    if (account.status !== "suspended") {
      return {
        accountId,
        success: false,
        message: `Account is not suspended (current status: ${account.status})`
      };
    }

    // Check if device is available
    if (!account.deviceId) {
      // Try to assign a device
      const device = await getAvailableDevice();
      if (device) {
        await assignDeviceToAccount(accountId, device.deviceId);
        console.log(`[Recovery] Assigned device ${device.deviceId} to account ${accountId}`);
      } else {
        console.log(`[Recovery] No available device for account ${accountId}, recovering anyway`);
      }
    }

    // Reactivate account
    await db.update(accounts)
      .set({ status: "active" })
      .where(eq(accounts.id, accountId));

    // Update any related freeze detections
    await db.update(freezeDetections)
      .set({
        status: "resolved",
        resolvedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(freezeDetections.accountId, accountId),
          eq(freezeDetections.status, "detected")
        )
      );

    // Log the recovery action
    const latestFreeze = await db.select()
      .from(freezeDetections)
      .where(eq(freezeDetections.accountId, accountId))
      .orderBy(sql`${freezeDetections.createdAt} DESC`)
      .limit(1);

    if (latestFreeze.length > 0) {
      await db.insert(autoResponses).values({
        freezeDetectionId: latestFreeze[0].id,
        accountId,
        actionType: "pause_account",
        oldValue: "suspended",
        newValue: "active",
        status: "success",
        errorMessage: undefined,
        executedAt: new Date().toISOString()
      });
    }

    console.log(`[Recovery] Account ${accountId} (${account.username}) recovered successfully`);

    return {
      accountId,
      success: true,
      message: "Account recovered successfully",
      newStatus: "active"
    };
  } catch (error: any) {
    console.error(`[Recovery] Error recovering account ${accountId}:`, error);
    return {
      accountId,
      success: false,
      message: error.message
    };
  }
}

/**
 * Run recovery cycle - check and recover all eligible accounts
 */
export async function runRecoveryCycle(): Promise<RecoveryResult[]> {
  if (isRunning) {
    console.log("[Recovery] Recovery cycle already running, skipping");
    return [];
  }

  isRunning = true;
  const results: RecoveryResult[] = [];

  try {
    const candidates = await findRecoveryCandidates();
    console.log(`[Recovery] Found ${candidates.length} accounts eligible for recovery`);

    for (const candidate of candidates) {
      const result = await recoverAccount(candidate.accountId);
      results.push(result);

      // Small delay between recoveries to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("[Recovery] Error in recovery cycle:", error);
  } finally {
    isRunning = false;
  }

  return results;
}

/**
 * Schedule recovery for a specific account
 * @param accountId Account ID to schedule for recovery
 * @param hoursFromNow Hours until recovery (default 24)
 */
export async function scheduleRecovery(
  accountId: number,
  hoursFromNow: number = DEFAULT_COOLDOWN_HOURS
): Promise<{ success: boolean; scheduledAt: Date; message: string }> {
  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + hoursFromNow);

  // For now, we just log the scheduled time
  // In a production system, you would use a proper job queue (Bull, etc.)
  console.log(`[Recovery] Scheduled recovery for account ${accountId} at ${scheduledAt.toISOString()}`);

  return {
    success: true,
    scheduledAt,
    message: `Account will be eligible for recovery after ${hoursFromNow} hours`
  };
}

// ============================================
// Scheduler Management
// ============================================

/**
 * Start the recovery scheduler
 */
export function startRecoveryScheduler(): void {
  if (schedulerInterval) {
    console.log("[Recovery] Scheduler already running");
    return;
  }

  console.log(`[Recovery] Starting recovery scheduler (interval: ${CHECK_INTERVAL_MS / 1000 / 60} minutes)`);

  // Run immediately
  runRecoveryCycle();

  // Schedule periodic runs
  schedulerInterval = setInterval(() => {
    runRecoveryCycle();
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the recovery scheduler
 */
export function stopRecoveryScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Recovery] Recovery scheduler stopped");
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

/**
 * Get recovery queue status
 */
export async function getRecoveryQueueStatus(): Promise<{
  isRunning: boolean;
  pendingCount: number;
  candidates: RecoveryCandidate[];
}> {
  const candidates = await findRecoveryCandidates();
  const pendingCandidates = await findRecoveryCandidates(0); // All suspended accounts

  return {
    isRunning: isSchedulerRunning(),
    pendingCount: pendingCandidates.length,
    candidates
  };
}
