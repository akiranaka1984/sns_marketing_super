/**
 * X.com Playwright Poster
 *
 * Posts content to X.com using Playwright browser automation.
 * Supports text-only and text+media (single image) posts.
 */

import path from 'path';
import {
  X_SELECTORS,
  X_URLS,
  POST_NAVIGATION_WAIT,
  INTER_ACTION_DELAY,
  POST_VERIFY_WAIT,
} from './config';
import { acquireContext, saveSession, releaseContext } from './browser-session-manager';
import { startScreencast, stopScreencast, setOperationStatus } from './screencast-service';
import { ensureLoggedIn } from './x-login-handler';
import { db } from '../db';
import { accounts, proxies } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

import { createLogger } from "../utils/logger";

const logger = createLogger("x-playwright-poster");

export interface PlaywrightPostResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Post content to X.com via Playwright browser automation.
 *
 * Flow:
 * 1. Acquire browser context for the account
 * 2. Navigate to x.com/home
 * 3. Verify login (re-login if expired)
 * 4. Click compose tweet button
 * 5. Fill text
 * 6. Optionally upload media
 * 7. Click tweet button
 * 8. Verify success
 * 9. Save session & release context
 */
export async function postToXViaPlaywright(
  accountId: number,
  content: string,
  mediaUrls?: string[]
): Promise<PlaywrightPostResult> {
  try {
    // Get account info for login credentials & proxy
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      return { success: false, message: 'Account not found', error: 'ACCOUNT_NOT_FOUND' };
    }

    // Build proxy config if account has proxy
    let proxyConfig: { server: string; username?: string; password?: string } | undefined;
    if (account.proxyId) {
      const proxy = await db.query.proxies.findFirst({
        where: eq(proxies.id, account.proxyId),
      });
      if (proxy) {
        proxyConfig = {
          server: `http://${proxy.host}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password,
        };
      }
    }

    // Ensure logged in
    logger.info(`[XPlaywright] Ensuring login for account ${accountId}`);
    const loggedIn = await ensureLoggedIn(
      accountId,
      account.username,
      account.password,
      proxyConfig
    );

    if (!loggedIn) {
      return {
        success: false,
        message: 'Could not establish X.com session. Manual login may be required.',
        error: 'LOGIN_FAILED',
      };
    }

    // Acquire context and create page
    const context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to home
      setOperationStatus(accountId, 'post', 'navigating_to_home');
      logger.info(`[XPlaywright] Navigating to X.com home for account ${accountId}`);
      await page.goto(X_URLS.home, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Click compose button
      setOperationStatus(accountId, 'post', 'opening_compose');
      logger.info(`[XPlaywright] Clicking compose button`);
      const composeBtn = page.locator(X_SELECTORS.composeTweetButton);
      await composeBtn.waitFor({ state: 'visible', timeout: 15_000 });
      await composeBtn.click();
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Wait for the tweet text area to appear
      const textArea = page.locator(X_SELECTORS.tweetTextArea);
      await textArea.waitFor({ state: 'visible', timeout: 10_000 });

      // Fill text content (page.fill supports Japanese natively)
      setOperationStatus(accountId, 'post', 'entering_content');
      logger.info(`[XPlaywright] Entering post content (${content.length} chars)`);
      await textArea.fill(content);
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Upload media if provided
      if (mediaUrls && mediaUrls.length > 0) {
        setOperationStatus(accountId, 'post', 'uploading_media');
        logger.info(`[XPlaywright] Uploading ${mediaUrls.length} media file(s)`);
        const fileInput = page.locator(X_SELECTORS.mediaInput);

        // setInputFiles works with URLs or local paths
        // For remote URLs we need to download first — here we pass as-is
        // assuming the scheduler has already downloaded them locally
        for (const mediaUrl of mediaUrls) {
          try {
            await fileInput.setInputFiles(mediaUrl);
            await page.waitForTimeout(2_000); // Wait for upload processing
          } catch (err: any) {
            logger.warn(`[XPlaywright] Media upload failed for ${mediaUrl}:`, err.message);
          }
        }
      }

      // Click tweet button
      setOperationStatus(accountId, 'post', 'submitting_post');
      logger.info(`[XPlaywright] Clicking tweet button`);
      const tweetBtn = page.locator(X_SELECTORS.tweetButton);
      await tweetBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await tweetBtn.click();

      // Wait and verify success
      await page.waitForTimeout(POST_VERIFY_WAIT);

      // Check for toast notification or compose dialog closing
      const toastVisible = await page
        .locator(X_SELECTORS.toast)
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      // Also check that the compose dialog has closed
      const composeStillOpen = await textArea.isVisible().catch(() => false);

      if (toastVisible || !composeStillOpen) {
        logger.info(`[XPlaywright] Post successful for account ${accountId}`);

        // Save session after successful post
        await saveSession(accountId);

        return {
          success: true,
          message: 'Post published successfully to X via Playwright',
        };
      }

      // If compose is still open, the post may have failed
      logger.warn(`[XPlaywright] Post may have failed — compose dialog still open`);
      return {
        success: false,
        message: 'Post verification failed — compose dialog did not close',
        error: 'VERIFICATION_FAILED',
      };
    } finally {
      await stopScreencast(accountId);
      await page.close();
      await releaseContext(accountId);
    }
  } catch (err: any) {
    logger.error(`[XPlaywright] Post failed for account ${accountId}:`, err.message);
    try {
      await releaseContext(accountId);
    } catch {
      // ignore
    }
    return {
      success: false,
      message: 'Failed to post to X via Playwright',
      error: err.message,
    };
  }
}
