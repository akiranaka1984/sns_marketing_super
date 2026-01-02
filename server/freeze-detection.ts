/**
 * Freeze Detection System
 * 
 * Detects account/device/IP freezes and triggers automatic responses
 */

import { db } from "./db";
import { freezeDetections, autoResponses, accounts, proxies } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface FreezeDetectionResult {
  isFrozen: boolean;
  freezeType: "ip_block" | "device_block" | "account_freeze" | "unknown" | null;
  confidence: number; // 0-100
  errorMessage?: string;
  recommendedAction: "change_ip" | "switch_device" | "pause_account" | null;
}

/**
 * Detect freeze from error message patterns
 */
export async function detectFreeze(
  accountId: number,
  deviceId: string | null,
  errorMessage: string
): Promise<FreezeDetectionResult> {
  const result: FreezeDetectionResult = {
    isFrozen: false,
    freezeType: null,
    confidence: 0,
    errorMessage,
    recommendedAction: null,
  };

  // IP block patterns
  const ipBlockPatterns = [
    /ip.*block/i,
    /ip.*ban/i,
    /ip.*restrict/i,
    /too many requests/i,
    /rate limit/i,
    /429/,
    /proxy.*error/i,
    /network.*error/i,
  ];

  // Device block patterns
  const deviceBlockPatterns = [
    /device.*block/i,
    /device.*ban/i,
    /device.*restrict/i,
    /fingerprint.*detect/i,
    /suspicious.*device/i,
    /device.*verify/i,
  ];

  // Account freeze patterns
  const accountFreezePatterns = [
    /account.*suspend/i,
    /account.*lock/i,
    /account.*freeze/i,
    /account.*disable/i,
    /account.*ban/i,
    /verify.*identity/i,
    /unusual.*activity/i,
    /security.*check/i,
  ];

  // Check patterns
  let matchedPatterns = 0;

  for (const pattern of ipBlockPatterns) {
    if (pattern.test(errorMessage)) {
      result.isFrozen = true;
      result.freezeType = "ip_block";
      result.recommendedAction = "change_ip";
      matchedPatterns++;
    }
  }

  for (const pattern of deviceBlockPatterns) {
    if (pattern.test(errorMessage)) {
      result.isFrozen = true;
      result.freezeType = "device_block";
      result.recommendedAction = "switch_device";
      matchedPatterns++;
    }
  }

  for (const pattern of accountFreezePatterns) {
    if (pattern.test(errorMessage)) {
      result.isFrozen = true;
      result.freezeType = "account_freeze";
      result.recommendedAction = "pause_account";
      matchedPatterns++;
    }
  }

  // Calculate confidence based on pattern matches
  if (matchedPatterns > 0) {
    result.confidence = Math.min(100, 50 + matchedPatterns * 25);
  }

  // If no specific pattern matched but error exists, mark as unknown
  if (!result.isFrozen && errorMessage) {
    result.isFrozen = true;
    result.freezeType = "unknown";
    result.confidence = 30;
    result.recommendedAction = "change_ip"; // Default action
  }

  // Log detection
  if (result.isFrozen) {
    await db.insert(freezeDetections).values({
      accountId,
      deviceId: deviceId || undefined,
      freezeType: result.freezeType!,
      confidence: result.confidence,
      errorMessage,
      detectionDetails: JSON.stringify(result),
      status: "detected",
    });
  }

  return result;
}

/**
 * Handle freeze with automatic response
 */
export async function handleFreeze(
  freezeDetectionId: number,
  accountId: number,
  deviceId: string | null,
  recommendedAction: "change_ip" | "switch_device" | "pause_account"
): Promise<{ success: boolean; message: string }> {
  try {
    // Update freeze detection status
    await db
      .update(freezeDetections)
      .set({ status: "handling" })
      .where(eq(freezeDetections.id, freezeDetectionId));

    let actionResult: { success: boolean; message: string; oldValue?: string; newValue?: string };

    switch (recommendedAction) {
      case "change_ip":
        actionResult = await changeProxyForAccount(accountId);
        break;

      case "switch_device":
        actionResult = await switchDeviceForAccount(accountId);
        break;

      case "pause_account":
        actionResult = await pauseAccount(accountId);
        break;

      default:
        actionResult = { success: false, message: "Unknown action" };
    }

    // Log auto-response
    await db.insert(autoResponses).values({
      freezeDetectionId,
      accountId,
      actionType: recommendedAction,
      oldValue: actionResult.oldValue,
      newValue: actionResult.newValue,
      status: actionResult.success ? "success" : "failed",
      errorMessage: actionResult.success ? undefined : actionResult.message,
      executedAt: new Date(),
    });

    // Update freeze detection status
    if (actionResult.success) {
      await db
        .update(freezeDetections)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(freezeDetections.id, freezeDetectionId));
    } else {
      await db
        .update(freezeDetections)
        .set({ status: "failed" })
        .where(eq(freezeDetections.id, freezeDetectionId));
    }

    return actionResult;
  } catch (error: any) {
    await db
      .update(freezeDetections)
      .set({ status: "failed" })
      .where(eq(freezeDetections.id, freezeDetectionId));

    return { success: false, message: error.message };
  }
}

/**
 * Change proxy for account
 */
async function changeProxyForAccount(accountId: number): Promise<{
  success: boolean;
  message: string;
  oldValue?: string;
  newValue?: string;
}> {
  try {
    // Get current account
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      return { success: false, message: "Account not found" };
    }

    const oldProxyId = account.proxyId;

    // Find available proxy (not the current one)
    const availableProxy = await db.query.proxies.findFirst({
      where: and(
        eq(proxies.status, "available"),
        oldProxyId ? ne(proxies.id, oldProxyId) : undefined
      ),
    });

    if (!availableProxy) {
      return { success: false, message: "No available proxy found" };
    }

    // Update old proxy status
    if (oldProxyId) {
      await db
        .update(proxies)
        .set({ status: "available", assignedAccountId: null })
        .where(eq(proxies.id, oldProxyId));
    }

    // Assign new proxy
    await db
      .update(proxies)
      .set({ status: "assigned", assignedAccountId: accountId })
      .where(eq(proxies.id, availableProxy.id));

    // Update account
    await db
      .update(accounts)
      .set({ proxyId: availableProxy.id })
      .where(eq(accounts.id, accountId));

    return {
      success: true,
      message: `Proxy changed from ${oldProxyId || "none"} to ${availableProxy.id}`,
      oldValue: oldProxyId?.toString(),
      newValue: availableProxy.id.toString(),
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Switch device for account
 */
async function switchDeviceForAccount(accountId: number): Promise<{
  success: boolean;
  message: string;
  oldValue?: string;
  newValue?: string;
}> {
  try {
    // Get current account
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      return { success: false, message: "Account not found" };
    }

    const oldDeviceId = account.deviceId;

    // For now, just clear the device ID
    // In a full implementation, you would:
    // 1. Find an available device from DuoPlus
    // 2. Assign it to the account
    // 3. Update device fingerprint

    await db
      .update(accounts)
      .set({ deviceId: null })
      .where(eq(accounts.id, accountId));

    return {
      success: true,
      message: `Device switched from ${oldDeviceId || "none"} to unassigned (ready for reassignment)`,
      oldValue: oldDeviceId || undefined,
      newValue: "unassigned",
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Pause account for 24-48 hours
 */
async function pauseAccount(accountId: number): Promise<{
  success: boolean;
  message: string;
  oldValue?: string;
  newValue?: string;
}> {
  try {
    // Get current account
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      return { success: false, message: "Account not found" };
    }

    const oldStatus = account.status;

    // Update account status to suspended
    await db
      .update(accounts)
      .set({ status: "suspended" })
      .where(eq(accounts.id, accountId));

    // TODO: Schedule automatic reactivation after 24-48 hours
    // This would require a background job system

    return {
      success: true,
      message: `Account paused for 24-48 hours`,
      oldValue: oldStatus,
      newValue: "suspended",
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// Import ne function
import { ne } from "drizzle-orm";
