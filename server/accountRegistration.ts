import * as duoplus from './duoplus';
import { createLog } from './db';

/**
 * Platform-specific app packages
 */
const APP_PACKAGES = {
  twitter: 'com.twitter.android',
  tiktok: 'com.zhiliaoapp.musically',
  instagram: 'com.instagram.android',
  facebook: 'com.facebook.katana',
};

/**
 * Platform-specific login coordinates (approximate, may need adjustment)
 */
const LOGIN_COORDS = {
  twitter: {
    usernameField: { x: 540, y: 600 },
    passwordField: { x: 540, y: 800 },
    loginButton: { x: 540, y: 1000 },
  },
  tiktok: {
    usernameField: { x: 540, y: 650 },
    passwordField: { x: 540, y: 850 },
    loginButton: { x: 540, y: 1050 },
  },
  instagram: {
    usernameField: { x: 540, y: 550 },
    passwordField: { x: 540, y: 750 },
    loginButton: { x: 540, y: 950 },
  },
  facebook: {
    usernameField: { x: 540, y: 600 },
    passwordField: { x: 540, y: 800 },
    loginButton: { x: 540, y: 1000 },
  },
};

export interface RegistrationOptions {
  accountId: number;
  deviceId: string;
  platform: 'twitter' | 'tiktok' | 'instagram' | 'facebook';
  username: string;
  password: string;
}

/**
 * Main account registration flow
 */
export async function registerAccount(options: RegistrationOptions): Promise<{ success: boolean; error?: string }> {
  const { accountId, deviceId, platform, username, password } = options;

  try {
    // Log start
    await createLog({
      accountId,
      deviceId,
      action: 'registration_start',
      status: 'pending',
      details: `Starting registration for ${platform} account: ${username}`,
    });

    // Step 1: Open the app
    await createLog({
      accountId,
      deviceId,
      action: 'open_app',
      status: 'pending',
      details: `Opening ${platform} app`,
    });

    const appPackage = APP_PACKAGES[platform];
    await duoplus.openApp(deviceId, appPackage);
    await duoplus.randomWait(3000, 5000);

    await createLog({
      accountId,
      deviceId,
      action: 'open_app',
      status: 'success',
      details: `${platform} app opened successfully`,
    });

    // Step 2: Navigate to login screen
    await createLog({
      accountId,
      deviceId,
      action: 'navigate_to_login',
      status: 'pending',
      details: 'Navigating to login screen',
    });

    await navigateToLoginScreen(deviceId, platform);
    await duoplus.randomWait(2000, 4000);

    await createLog({
      accountId,
      deviceId,
      action: 'navigate_to_login',
      status: 'success',
      details: 'Reached login screen',
    });

    // Step 3: Input username
    await createLog({
      accountId,
      deviceId,
      action: 'input_username',
      status: 'pending',
      details: 'Entering username',
    });

    const coords = LOGIN_COORDS[platform];
    await duoplus.tap(deviceId, coords.usernameField.x, coords.usernameField.y);
    await duoplus.randomWait(500, 1000);
    await duoplus.inputText(deviceId, username);
    await duoplus.randomWait(1000, 2000);

    await createLog({
      accountId,
      deviceId,
      action: 'input_username',
      status: 'success',
      details: 'Username entered',
    });

    // Step 4: Input password
    await createLog({
      accountId,
      deviceId,
      action: 'input_password',
      status: 'pending',
      details: 'Entering password',
    });

    await duoplus.tap(deviceId, coords.passwordField.x, coords.passwordField.y);
    await duoplus.randomWait(500, 1000);
    await duoplus.inputText(deviceId, password);
    await duoplus.randomWait(1000, 2000);

    await createLog({
      accountId,
      deviceId,
      action: 'input_password',
      status: 'success',
      details: 'Password entered',
    });

    // Step 5: Click login button
    await createLog({
      accountId,
      deviceId,
      action: 'click_login',
      status: 'pending',
      details: 'Clicking login button',
    });

    await duoplus.tap(deviceId, coords.loginButton.x, coords.loginButton.y);
    await duoplus.randomWait(5000, 8000);

    await createLog({
      accountId,
      deviceId,
      action: 'click_login',
      status: 'success',
      details: 'Login button clicked',
    });

    // Step 6: Verify login success
    await createLog({
      accountId,
      deviceId,
      action: 'verify_login',
      status: 'pending',
      details: 'Verifying login success',
    });

    const loginSuccess = await verifyLoginSuccess(deviceId, platform);

    if (loginSuccess) {
      await createLog({
        accountId,
        deviceId,
        action: 'verify_login',
        status: 'success',
        details: 'Login verified successfully',
      });

      await createLog({
        accountId,
        deviceId,
        action: 'registration_complete',
        status: 'success',
        details: `Account ${username} registered successfully on ${platform}`,
      });

      return { success: true };
    } else {
      throw new Error('Login verification failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await createLog({
      accountId,
      deviceId,
      action: 'registration_failed',
      status: 'failed',
      details: `Registration failed for ${username} on ${platform}`,
      errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Navigate to login screen based on platform
 */
async function navigateToLoginScreen(deviceId: string, platform: string): Promise<void> {
  // This is a simplified implementation
  // In a real scenario, you would need to detect the current screen and navigate accordingly
  
  // Look for "Log in" or "Sign in" button
  const loginButton = await duoplus.findElement(deviceId, 'Log in');
  if (loginButton) {
    await duoplus.tap(deviceId, loginButton.x, loginButton.y);
    await duoplus.randomWait(2000, 3000);
  }

  // Additional navigation logic can be added here based on platform
}

/**
 * Verify if login was successful
 */
async function verifyLoginSuccess(deviceId: string, platform: string): Promise<boolean> {
  try {
    // Take a screenshot to verify
    const screenshotUrl = await duoplus.screenshot(deviceId);
    
    // In a real implementation, you would use image recognition or OCR
    // to verify if the login was successful
    // For now, we'll use a simple heuristic
    
    // Look for common elements that indicate successful login
    const homeIndicator = await duoplus.findElement(deviceId, 'Home');
    const feedIndicator = await duoplus.findElement(deviceId, 'Feed');
    
    return !!(homeIndicator || feedIndicator);
  } catch (error) {
    console.error('[Registration] Failed to verify login:', error);
    return false;
  }
}

/**
 * Retry registration with exponential backoff
 */
export async function registerAccountWithRetry(
  options: RegistrationOptions,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await registerAccount(options);

    if (result.success) {
      return result;
    }

    lastError = result.error || 'Unknown error';

    if (attempt < maxRetries) {
      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      await duoplus.wait(waitTime);

      await createLog({
        accountId: options.accountId,
        deviceId: options.deviceId,
        action: 'retry_registration',
        status: 'pending',
        details: `Retrying registration (attempt ${attempt + 1}/${maxRetries})`,
      });
    }
  }

  return { success: false, error: `Failed after ${maxRetries} attempts: ${lastError}` };
}
