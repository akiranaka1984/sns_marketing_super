/**
 * X.com Login Handler
 *
 * Handles the full X.com login flow via Playwright, including
 * username → next → password → submit.
 * After login the session is persisted via BrowserSessionManager.
 */

import type { BrowserContext } from 'playwright';
import {
  X_SELECTORS,
  X_URLS,
  POST_NAVIGATION_WAIT,
  INTER_ACTION_DELAY,
} from './config';
import { acquireContext, saveSession, releaseContext } from './browser-session-manager';
import { startScreencast, stopScreencast, setOperationStatus } from './screencast-service';
import { db } from '../db';
import { accounts } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export interface LoginResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Perform login to X.com for the given account.
 * On success the browser session is saved so subsequent operations skip login.
 */
export async function loginToX(
  accountId: number,
  username: string,
  password: string,
  proxyConfig?: { server: string; username?: string; password?: string }
): Promise<LoginResult> {
  let context: BrowserContext | null = null;

  try {
    context = await acquireContext(accountId, proxyConfig);
    const page = await context.newPage();
    await startScreencast(accountId, page);

    try {
      // Navigate to login page
      setOperationStatus(accountId, 'login', 'navigating_to_login');
      console.log(`[XLogin] Navigating to login page for account ${accountId}`);
      await page.goto(X_URLS.login, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Enter username
      setOperationStatus(accountId, 'login', 'entering_username');
      console.log(`[XLogin] Entering username for account ${accountId}`);
      const usernameInput = page.locator(X_SELECTORS.loginUsernameInput);
      await usernameInput.waitFor({ state: 'visible', timeout: 15_000 });
      await usernameInput.fill(username);
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Click Next
      const nextButton = page.locator(X_SELECTORS.loginNextButton);
      await nextButton.click();
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      // Enter password
      setOperationStatus(accountId, 'login', 'entering_password');
      console.log(`[XLogin] Entering password for account ${accountId}`);
      const passwordInput = page.locator(X_SELECTORS.loginPasswordInput);
      await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
      await passwordInput.fill(password);
      await page.waitForTimeout(INTER_ACTION_DELAY);

      // Click login
      const loginButton = page.locator(X_SELECTORS.loginSubmitButton);
      await loginButton.click();
      await page.waitForTimeout(POST_NAVIGATION_WAIT);

      setOperationStatus(accountId, 'login', 'waiting_for_redirect');
      // Wait for redirect to home (indicates success)
      try {
        await page.waitForURL('**/home**', { timeout: 30_000 });
      } catch {
        // May not redirect exactly to /home — check for profile avatar instead
      }

      // Verify logged-in state
      const loggedIn = await page
        .locator(X_SELECTORS.profileAvatar)
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);

      if (!loggedIn) {
        // Check for verification / challenge screens
        const currentUrl = page.url();
        console.warn(
          `[XLogin] Login may require additional verification for account ${accountId}. Current URL: ${currentUrl}`
        );

        await db
          .update(accounts)
          .set({ sessionStatus: 'needs_login' })
          .where(eq(accounts.id, accountId));

        return {
          success: false,
          message:
            'Login could not be fully completed. The account may require additional verification (e.g., email/phone challenge).',
          error: 'VERIFICATION_REQUIRED',
        };
      }

      // Save session
      await saveSession(accountId);

      // Update DB
      await db
        .update(accounts)
        .set({ sessionStatus: 'active', lastLoginAt: new Date().toISOString().slice(0, 19).replace('T', ' ') })
        .where(eq(accounts.id, accountId));

      console.log(`[XLogin] Login successful for account ${accountId}`);
      return { success: true, message: 'Login successful' };
    } finally {
      await stopScreencast(accountId);
      await page.close();
    }
  } catch (err: any) {
    console.error(`[XLogin] Login failed for account ${accountId}:`, err.message);

    await db
      .update(accounts)
      .set({ sessionStatus: 'needs_login' })
      .where(eq(accounts.id, accountId));

    return {
      success: false,
      message: 'Login failed',
      error: err.message,
    };
  } finally {
    if (context) {
      // Save but don't close – caller may want to reuse
      try {
        await saveSession(accountId);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Ensure the account is logged in. If not, attempt re-login.
 * Returns true if the session is active after the call.
 */
export async function ensureLoggedIn(
  accountId: number,
  username: string,
  password: string,
  proxyConfig?: { server: string; username?: string; password?: string }
): Promise<boolean> {
  const context = await acquireContext(accountId, proxyConfig);
  const page = await context.newPage();

  try {
    await page.goto(X_URLS.home, { waitUntil: 'domcontentloaded' });

    const loggedIn = await page
      .locator(X_SELECTORS.profileAvatar)
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (loggedIn) {
      await db
        .update(accounts)
        .set({ sessionStatus: 'active' })
        .where(eq(accounts.id, accountId));
      return true;
    }
  } catch {
    // Session expired or invalid – try re-login below
  } finally {
    await page.close();
  }

  // Release old context and login fresh
  await releaseContext(accountId);
  const result = await loginToX(accountId, username, password, proxyConfig);
  return result.success;
}
