import { getAnalyticsByAccount, getAccountById } from './db';
import { notifyOwner } from './_core/notification';

/**
 * Alert System
 * Monitors account metrics and sends notifications for anomalies
 */

interface AlertThresholds {
  followerDropPercentage: number; // Alert if followers drop by this percentage
  engagementDropPercentage: number; // Alert if engagement drops by this percentage
  checkIntervalHours: number; // How often to check for alerts
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  followerDropPercentage: 10, // Alert if 10% drop
  engagementDropPercentage: 20, // Alert if 20% drop
  checkIntervalHours: 24, // Check every 24 hours
};

/**
 * Check for follower count drop
 */
async function checkFollowerDrop(accountId: number, thresholds: AlertThresholds = DEFAULT_THRESHOLDS): Promise<boolean> {
  try {
    const analytics = await getAnalyticsByAccount(accountId);
    if (!analytics || analytics.length < 2) {
      // Not enough data to compare
      return false;
    }

    // Sort by date (most recent first)
    const sortedAnalytics = analytics.sort((a: any, b: any) => 
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

    const latest = sortedAnalytics[0];
    const previous = sortedAnalytics[1];

    // Calculate percentage drop
    const dropPercentage = ((previous.followersCount - latest.followersCount) / previous.followersCount) * 100;

    if (dropPercentage >= thresholds.followerDropPercentage) {
      const account = await getAccountById(accountId);
      if (account) {
        await notifyOwner({
          title: '⚠️ Follower Count Drop Alert',
          content: `Account @${account.username} (${account.platform}) has lost ${dropPercentage.toFixed(1)}% of followers.\n\nPrevious: ${previous.followersCount}\nCurrent: ${latest.followersCount}\nDrop: ${previous.followersCount - latest.followersCount} followers`,
        });
        console.log(`[AlertSystem] Follower drop alert sent for account ${accountId}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`[AlertSystem] Error checking follower drop for account ${accountId}:`, error);
    return false;
  }
}

/**
 * Check for engagement rate drop
 */
async function checkEngagementDrop(accountId: number, thresholds: AlertThresholds = DEFAULT_THRESHOLDS): Promise<boolean> {
  try {
    const analytics = await getAnalyticsByAccount(accountId);
    if (!analytics || analytics.length < 2) {
      // Not enough data to compare
      return false;
    }

    // Sort by date (most recent first)
    const sortedAnalytics = analytics.sort((a: any, b: any) => 
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

    const latest = sortedAnalytics[0];
    const previous = sortedAnalytics[1];

    // Calculate percentage drop (engagement rate is stored as basis points)
    const dropPercentage = ((previous.engagementRate - latest.engagementRate) / previous.engagementRate) * 100;

    if (dropPercentage >= thresholds.engagementDropPercentage) {
      const account = await getAccountById(accountId);
      if (account) {
        await notifyOwner({
          title: '⚠️ Engagement Rate Drop Alert',
          content: `Account @${account.username} (${account.platform}) has experienced a ${dropPercentage.toFixed(1)}% drop in engagement rate.\n\nPrevious: ${(previous.engagementRate / 100).toFixed(2)}%\nCurrent: ${(latest.engagementRate / 100).toFixed(2)}%`,
        });
        console.log(`[AlertSystem] Engagement drop alert sent for account ${accountId}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`[AlertSystem] Error checking engagement drop for account ${accountId}:`, error);
    return false;
  }
}

/**
 * Check for account suspension/freeze
 * This is a placeholder - actual implementation would need to check account status
 */
async function checkAccountSuspension(accountId: number): Promise<boolean> {
  try {
    const account = await getAccountById(accountId);
    if (!account) {
      return false;
    }

    // TODO: Implement actual suspension detection
    // This could be done by:
    // 1. Attempting to login and checking for suspension messages
    // 2. Checking if posts can be made
    // 3. Monitoring API responses for suspension indicators

    if (account.status === 'suspended') {
      await notifyOwner({
        title: '🚨 Account Suspension Alert',
        content: `Account @${account.username} (${account.platform}) appears to be suspended or frozen.\n\nImmediate action required!`,
      });
      console.log(`[AlertSystem] Suspension alert sent for account ${accountId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[AlertSystem] Error checking account suspension for ${accountId}:`, error);
    return false;
  }
}

/**
 * Check all alerts for a single account
 */
export async function checkAccountAlerts(accountId: number, thresholds?: AlertThresholds): Promise<void> {
  try {
    console.log(`[AlertSystem] Checking alerts for account ${accountId}`);
    
    await Promise.all([
      checkFollowerDrop(accountId, thresholds),
      checkEngagementDrop(accountId, thresholds),
      checkAccountSuspension(accountId),
    ]);
  } catch (error) {
    console.error(`[AlertSystem] Error checking alerts for account ${accountId}:`, error);
  }
}

/**
 * Check alerts for all active accounts
 */
export async function checkAllAccountsAlerts(thresholds?: AlertThresholds): Promise<void> {
  try {
    console.log('[AlertSystem] Starting alert check for all accounts');
    
    // TODO: Implement batch alert checking
    // Get all active accounts
    // For each account, check all alert conditions
    
    console.log('[AlertSystem] Batch alert checking not yet implemented');
  } catch (error) {
    console.error('[AlertSystem] Error in batch alert checking:', error);
  }
}

/**
 * Schedule alert checks (to be called by cron job)
 */
export async function scheduleAlertChecks(): Promise<void> {
  console.log('[AlertSystem] Scheduled alert check started');
  await checkAllAccountsAlerts();
}
