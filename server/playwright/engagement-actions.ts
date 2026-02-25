/**
 * X.com Playwright Engagement Actions
 *
 * Provides automated engagement actions via Playwright:
 * - Like/Unlike posts
 * - Follow/Unfollow users
 * - Comment/Reply on posts
 * - Retweet posts
 */

import {
  X_SELECTORS,
  INTER_ACTION_DELAY,
  POST_NAVIGATION_WAIT,
} from './config';
import { acquireContext, saveSession, releaseContext } from './browser-session-manager';
import { startScreencast, stopScreencast, setOperationStatus } from './screencast-service';
import { ensureLoggedIn } from './x-login-handler';
import { db } from '../db';
import { accounts, proxies, interactionSettings } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

import { createLogger } from "../utils/logger";

const logger = createLogger("engagement-actions");

export interface EngagementResult {
  success: boolean;
  message: string;
  error?: string;
}

// Random delay for human-like behavior
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get proxy config for account if available
 */
async function getProxyConfig(account: { proxyId: number | null }) {
  if (!account.proxyId) return undefined;

  const proxy = await db.query.proxies.findFirst({
    where: eq(proxies.id, account.proxyId),
  });

  if (!proxy) return undefined;

  return {
    server: `http://${proxy.host}:${proxy.port}`,
    username: proxy.username ?? undefined,
    password: proxy.password ?? undefined,
  };
}

/**
 * Ensure the account is logged in and get browser context
 */
async function ensureAccountReady(
  accountId: number
): Promise<{ success: false; error: string } | { success: true; account: any; proxyConfig?: any }> {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
  });

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const proxyConfig = await getProxyConfig(account);

  const loggedIn = await ensureLoggedIn(
    accountId,
    account.username,
    account.password,
    proxyConfig
  );

  if (!loggedIn) {
    return { success: false, error: 'Could not establish X.com session' };
  }

  return { success: true, account, proxyConfig };
}

/**
 * Like a post via Playwright
 *
 * @param accountId - The account to use for liking
 * @param postUrl - Full URL to the post (e.g., https://x.com/user/status/123)
 */
export async function likePostViaPlaywright(
  accountId: number,
  postUrl: string
): Promise<EngagementResult> {
  try {
    const readyResult = await ensureAccountReady(accountId);
    if (!readyResult.success) {
      return { success: false, message: readyResult.error, error: 'ACCOUNT_NOT_READY' };
    }

    const { proxyConfig } = readyResult;
    const context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to the post
      setOperationStatus(accountId, 'like', 'navigating_to_post');
      logger.info(`[EngagementActions] Navigating to post: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Wait for the tweet to load
      await page.waitForSelector(X_SELECTORS.tweetArticle, { timeout: 15_000 });

      // Find the like button (first article is the main tweet)
      setOperationStatus(accountId, 'like', 'finding_like_button');
      const likeBtn = page.locator(`${X_SELECTORS.tweetArticle} ${X_SELECTORS.likeButton}`).first();

      // Check if already liked (unlike button would be visible instead)
      const unlikeBtn = page.locator(`${X_SELECTORS.tweetArticle} ${X_SELECTORS.unlikeButton}`).first();
      const alreadyLiked = await unlikeBtn.isVisible({ timeout: 2_000 }).catch(() => false);

      if (alreadyLiked) {
        logger.info(`[EngagementActions] Post already liked`);
        return { success: true, message: 'Post already liked' };
      }

      // Click like button
      setOperationStatus(accountId, 'like', 'clicking_like');
      await likeBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(300, 800);
      await likeBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Verify like was successful (unlike button should now be visible)
      const likeSuccess = await unlikeBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (likeSuccess) {
        logger.info(`[EngagementActions] Like successful for account ${accountId}`);
        await saveSession(accountId);
        return { success: true, message: 'Post liked successfully' };
      }

      return { success: false, message: 'Like verification failed', error: 'VERIFICATION_FAILED' };
    } finally {
      await stopScreencast(accountId);
      await page.close();
      await releaseContext(accountId);
    }
  } catch (err: any) {
    logger.error(`[EngagementActions] Like failed for account ${accountId}:`, err.message);
    try {
      await releaseContext(accountId);
    } catch {}
    return { success: false, message: 'Failed to like post', error: err.message };
  }
}

/**
 * Comment on a post via Playwright
 *
 * @param accountId - The account to use for commenting
 * @param postUrl - Full URL to the post
 * @param commentText - The comment text to post
 */
export async function commentPostViaPlaywright(
  accountId: number,
  postUrl: string,
  commentText: string
): Promise<EngagementResult> {
  try {
    const readyResult = await ensureAccountReady(accountId);
    if (!readyResult.success) {
      return { success: false, message: readyResult.error, error: 'ACCOUNT_NOT_READY' };
    }

    const { proxyConfig } = readyResult;
    const context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to the post
      setOperationStatus(accountId, 'comment', 'navigating_to_post');
      logger.info(`[EngagementActions] Navigating to post for comment: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Wait for the tweet to load
      await page.waitForSelector(X_SELECTORS.tweetArticle, { timeout: 15_000 });

      // Click reply button
      setOperationStatus(accountId, 'comment', 'clicking_reply');
      const replyBtn = page.locator(`${X_SELECTORS.tweetArticle} ${X_SELECTORS.replyButton}`).first();
      await replyBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(300, 800);
      await replyBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Wait for reply text area
      setOperationStatus(accountId, 'comment', 'entering_comment');
      const textArea = page.locator(X_SELECTORS.replyTextArea);
      await textArea.waitFor({ state: 'visible', timeout: 10_000 });

      // Type the comment (using fill for reliability with Japanese text)
      await textArea.fill(commentText);
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Click submit button
      setOperationStatus(accountId, 'comment', 'submitting_comment');
      const submitBtn = page.locator(X_SELECTORS.replySubmitButton);
      await submitBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(300, 800);
      await submitBtn.click();

      // Wait for the dialog to close or toast to appear
      await page.waitForTimeout(3_000);

      // Check if the reply dialog is closed
      const dialogClosed = !(await textArea.isVisible().catch(() => false));
      const toastVisible = await page.locator(X_SELECTORS.toast).first().isVisible({ timeout: 3_000 }).catch(() => false);

      if (dialogClosed || toastVisible) {
        logger.info(`[EngagementActions] Comment successful for account ${accountId}`);
        await saveSession(accountId);
        return { success: true, message: 'Comment posted successfully' };
      }

      return { success: false, message: 'Comment verification failed', error: 'VERIFICATION_FAILED' };
    } finally {
      await stopScreencast(accountId);
      await page.close();
      await releaseContext(accountId);
    }
  } catch (err: any) {
    logger.error(`[EngagementActions] Comment failed for account ${accountId}:`, err.message);
    try {
      await releaseContext(accountId);
    } catch {}
    return { success: false, message: 'Failed to post comment', error: err.message };
  }
}

/**
 * Follow a user via Playwright
 *
 * @param accountId - The account to use for following
 * @param username - Username to follow (with or without @)
 */
export async function followUserViaPlaywright(
  accountId: number,
  username: string
): Promise<EngagementResult> {
  try {
    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '');

    const readyResult = await ensureAccountReady(accountId);
    if (!readyResult.success) {
      return { success: false, message: readyResult.error, error: 'ACCOUNT_NOT_READY' };
    }

    const { proxyConfig } = readyResult;
    const context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to user profile
      const profileUrl = `https://x.com/${cleanUsername}`;
      setOperationStatus(accountId, 'follow', 'navigating_to_profile');
      logger.info(`[EngagementActions] Navigating to profile: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Wait for profile to load
      await page.waitForSelector(X_SELECTORS.primaryColumn, { timeout: 15_000 });

      // Check if already following
      setOperationStatus(accountId, 'follow', 'checking_follow_status');
      const unfollowBtn = page.locator(X_SELECTORS.unfollowButton).first();
      const alreadyFollowing = await unfollowBtn.isVisible({ timeout: 3_000 }).catch(() => false);

      if (alreadyFollowing) {
        logger.info(`[EngagementActions] Already following ${cleanUsername}`);
        return { success: true, message: 'Already following user' };
      }

      // Click follow button
      setOperationStatus(accountId, 'follow', 'clicking_follow');
      const followBtn = page.locator(X_SELECTORS.followButton).first();
      await followBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(500, 1200);
      await followBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Verify follow was successful
      const followSuccess = await unfollowBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (followSuccess) {
        logger.info(`[EngagementActions] Follow successful: ${cleanUsername}`);
        await saveSession(accountId);
        return { success: true, message: `Successfully followed @${cleanUsername}` };
      }

      return { success: false, message: 'Follow verification failed', error: 'VERIFICATION_FAILED' };
    } finally {
      await stopScreencast(accountId);
      await page.close();
      await releaseContext(accountId);
    }
  } catch (err: any) {
    logger.error(`[EngagementActions] Follow failed for account ${accountId}:`, err.message);
    try {
      await releaseContext(accountId);
    } catch {}
    return { success: false, message: 'Failed to follow user', error: err.message };
  }
}

/**
 * Unfollow a user via Playwright
 *
 * @param accountId - The account to use for unfollowing
 * @param username - Username to unfollow (with or without @)
 */
export async function unfollowUserViaPlaywright(
  accountId: number,
  username: string
): Promise<EngagementResult> {
  try {
    const cleanUsername = username.replace(/^@/, '');

    const readyResult = await ensureAccountReady(accountId);
    if (!readyResult.success) {
      return { success: false, message: readyResult.error, error: 'ACCOUNT_NOT_READY' };
    }

    const { proxyConfig } = readyResult;
    const context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to user profile
      const profileUrl = `https://x.com/${cleanUsername}`;
      setOperationStatus(accountId, 'unfollow', 'navigating_to_profile');
      logger.info(`[EngagementActions] Navigating to profile for unfollow: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Wait for profile to load
      await page.waitForSelector(X_SELECTORS.primaryColumn, { timeout: 15_000 });

      // Check if following
      setOperationStatus(accountId, 'unfollow', 'checking_follow_status');
      const unfollowBtn = page.locator(X_SELECTORS.unfollowButton).first();
      const isFollowing = await unfollowBtn.isVisible({ timeout: 3_000 }).catch(() => false);

      if (!isFollowing) {
        logger.info(`[EngagementActions] Not following ${cleanUsername}`);
        return { success: true, message: 'Not following user' };
      }

      // Click unfollow button (this shows a confirmation modal)
      setOperationStatus(accountId, 'unfollow', 'clicking_unfollow');
      await randomDelay(500, 1200);
      await unfollowBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Click confirm in the modal
      const confirmBtn = page.locator(X_SELECTORS.unfollowConfirm);
      await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(300, 600);
      await confirmBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Verify unfollow was successful (follow button should be visible now)
      const followBtn = page.locator(X_SELECTORS.followButton).first();
      const unfollowSuccess = await followBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (unfollowSuccess) {
        logger.info(`[EngagementActions] Unfollow successful: ${cleanUsername}`);
        await saveSession(accountId);
        return { success: true, message: `Successfully unfollowed @${cleanUsername}` };
      }

      return { success: false, message: 'Unfollow verification failed', error: 'VERIFICATION_FAILED' };
    } finally {
      await stopScreencast(accountId);
      await page.close();
      await releaseContext(accountId);
    }
  } catch (err: any) {
    logger.error(`[EngagementActions] Unfollow failed for account ${accountId}:`, err.message);
    try {
      await releaseContext(accountId);
    } catch {}
    return { success: false, message: 'Failed to unfollow user', error: err.message };
  }
}

/**
 * Retweet a post via Playwright
 *
 * @param accountId - The account to use for retweeting
 * @param postUrl - Full URL to the post to retweet
 */
export async function retweetPostViaPlaywright(
  accountId: number,
  postUrl: string
): Promise<EngagementResult> {
  try {
    const readyResult = await ensureAccountReady(accountId);
    if (!readyResult.success) {
      return { success: false, message: readyResult.error, error: 'ACCOUNT_NOT_READY' };
    }

    const { proxyConfig } = readyResult;
    const context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to the post
      setOperationStatus(accountId, 'retweet', 'navigating_to_post');
      logger.info(`[EngagementActions] Navigating to post for retweet: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Wait for the tweet to load
      await page.waitForSelector(X_SELECTORS.tweetArticle, { timeout: 15_000 });

      // Check if already retweeted
      setOperationStatus(accountId, 'retweet', 'checking_retweet_status');
      const unretweetBtn = page.locator(`${X_SELECTORS.tweetArticle} ${X_SELECTORS.unretweetButton}`).first();
      const alreadyRetweeted = await unretweetBtn.isVisible({ timeout: 2_000 }).catch(() => false);

      if (alreadyRetweeted) {
        logger.info(`[EngagementActions] Post already retweeted`);
        return { success: true, message: 'Post already retweeted' };
      }

      // Click retweet button
      setOperationStatus(accountId, 'retweet', 'clicking_retweet');
      const retweetBtn = page.locator(`${X_SELECTORS.tweetArticle} ${X_SELECTORS.retweetButton}`).first();
      await retweetBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(300, 800);
      await retweetBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Click confirm retweet in the menu
      const confirmBtn = page.locator(X_SELECTORS.retweetConfirm);
      await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await randomDelay(200, 500);
      await confirmBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Verify retweet was successful
      const retweetSuccess = await unretweetBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (retweetSuccess) {
        logger.info(`[EngagementActions] Retweet successful for account ${accountId}`);
        await saveSession(accountId);
        return { success: true, message: 'Post retweeted successfully' };
      }

      return { success: false, message: 'Retweet verification failed', error: 'VERIFICATION_FAILED' };
    } finally {
      await stopScreencast(accountId);
      await page.close();
      await releaseContext(accountId);
    }
  } catch (err: any) {
    logger.error(`[EngagementActions] Retweet failed for account ${accountId}:`, err.message);
    try {
      await releaseContext(accountId);
    } catch {}
    return { success: false, message: 'Failed to retweet post', error: err.message };
  }
}

/**
 * Get rate limit settings for a project
 */
export async function getEngagementRateLimits(projectId: number) {
  const settings = await db.query.interactionSettings.findFirst({
    where: eq(interactionSettings.projectId, projectId),
  });

  return {
    likeDelayMin: settings?.likeDelayMinMin ?? 5,
    likeDelayMax: settings?.likeDelayMinMax ?? 30,
    commentDelayMin: settings?.commentDelayMinMin ?? 10,
    commentDelayMax: settings?.commentDelayMinMax ?? 60,
    retweetDelayMin: settings?.retweetDelayMinMin ?? 15,
    retweetDelayMax: settings?.retweetDelayMinMax ?? 90,
    followDelayMin: settings?.followDelayMinMin ?? 30,
    followDelayMax: settings?.followDelayMinMax ?? 180,
  };
}
