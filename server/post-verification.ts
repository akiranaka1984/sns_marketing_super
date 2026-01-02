/**
 * Post Verification Helpers
 * 
 * Functions to verify that posts were successfully published to SNS platforms
 */

import axios from 'axios';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { storagePut } from './storage';

const API_URL = 'https://openapi.duoplus.net';

/**
 * Get DuoPlus API key from database
 */
async function getApiKey(): Promise<string | null> {
  try {
    const result = await db.query.settings.findFirst({
      where: eq(settings.key, 'DUOPLUS_API_KEY'),
    });
    return result?.value || null;
  } catch (error) {
    console.error('[PostVerification] Failed to get API key:', error);
    return null;
  }
}

/**
 * Execute ADB command on device
 */
async function executeAdbCommand(apiKey: string, deviceId: string, command: string): Promise<any> {
  try {
    const response = await axios.post(
      `${API_URL}/api/v1/cloudPhone/command`,
      {
        image_id: deviceId,
        command: command,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'DuoPlus-API-Key': apiKey,
          'Lang': 'en',
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error(`[PostVerification] ADB command failed: ${command}`, error.message);
    throw error;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download file from device to local buffer using ADB
 */
async function downloadFileFromDevice(
  apiKey: string,
  deviceId: string,
  devicePath: string
): Promise<Buffer | null> {
  try {
    console.log(`[PostVerification] Downloading file from device: ${devicePath}`);
    
    // Method 1: Try using base64 encoding (works for smaller files)
    try {
      const result = await executeAdbCommand(
        apiKey,
        deviceId,
        `cat ${devicePath} | base64`
      );
      
      if (result && result.data) {
        // Clean up base64 string (remove newlines and whitespace)
        const base64String = result.data.toString().replace(/\s/g, '');
        const buffer = Buffer.from(base64String, 'base64');
        console.log(`[PostVerification] Downloaded ${buffer.length} bytes from device`);
        return buffer;
      }
    } catch (base64Error) {
      console.log(`[PostVerification] Base64 method failed, trying alternative method`);
    }
    
    // Method 2: Try using xxd hex dump (alternative for binary files)
    try {
      const result = await executeAdbCommand(
        apiKey,
        deviceId,
        `xxd -p ${devicePath}`
      );
      
      if (result && result.data) {
        const hexString = result.data.toString().replace(/\s/g, '');
        const buffer = Buffer.from(hexString, 'hex');
        console.log(`[PostVerification] Downloaded ${buffer.length} bytes from device (hex method)`);
        return buffer;
      }
    } catch (hexError) {
      console.log(`[PostVerification] Hex method also failed`);
    }
    
    return null;
  } catch (error: any) {
    console.error(`[PostVerification] Failed to download file from device:`, error.message);
    return null;
  }
}

/**
 * Take screenshot of device, upload to S3, and return S3 URL
 */
export async function takeScreenshot(deviceId: string): Promise<string | null> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    console.log(`[PostVerification] Taking screenshot of device ${deviceId}`);
    
    const timestamp = Date.now();
    const screenshotPath = `/sdcard/post_verification_${timestamp}.png`;
    
    // Take screenshot
    await executeAdbCommand(apiKey, deviceId, `screencap -p ${screenshotPath}`);
    await sleep(2000);
    
    console.log(`[PostVerification] Screenshot saved to device: ${screenshotPath}`);
    
    // Download screenshot from device
    const screenshotBuffer = await downloadFileFromDevice(apiKey, deviceId, screenshotPath);
    
    if (!screenshotBuffer) {
      console.error(`[PostVerification] Failed to download screenshot from device`);
      return screenshotPath; // Return device path as fallback
    }
    
    // Upload to S3
    const s3Key = `screenshots/post_verification_${deviceId}_${timestamp}.png`;
    const uploadResult = await storagePut(s3Key, screenshotBuffer, 'image/png');
    
    console.log(`[PostVerification] Screenshot uploaded to S3: ${uploadResult.url}`);
    
    // Clean up screenshot from device
    try {
      await executeAdbCommand(apiKey, deviceId, `rm ${screenshotPath}`);
    } catch (cleanupError) {
      console.error(`[PostVerification] Failed to clean up screenshot from device`);
    }
    
    return uploadResult.url;
  } catch (error: any) {
    console.error(`[PostVerification] Failed to take screenshot:`, error.message);
    return null;
  }
}

/**
 * Check if text exists on screen using UI dump
 */
export async function checkTextOnScreen(
  deviceId: string,
  searchText: string
): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return false;
  }

  try {
    console.log(`[PostVerification] Checking for text on screen: "${searchText}"`);
    
    // Dump UI hierarchy
    const dumpPath = '/sdcard/ui_dump.xml';
    await executeAdbCommand(apiKey, deviceId, `uiautomator dump ${dumpPath}`);
    await sleep(1000);
    
    // Search for text in dump
    const result = await executeAdbCommand(
      apiKey,
      deviceId,
      `grep -i "${searchText}" ${dumpPath}`
    );
    
    const found = result && result.toString().toLowerCase().includes(searchText.toLowerCase());
    console.log(`[PostVerification] Text "${searchText}" ${found ? 'found' : 'not found'} on screen`);
    
    return found;
  } catch (error) {
    // grep returns non-zero exit code if text not found
    console.log(`[PostVerification] Text "${searchText}" not found on screen`);
    return false;
  }
}

/**
 * Verify Instagram post by checking for success indicators
 */
export async function verifyInstagramPost(deviceId: string): Promise<{
  verified: boolean;
  screenshotPath: string | null;
  message: string;
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      verified: false,
      screenshotPath: null,
      message: 'API key not found',
    };
  }

  try {
    console.log(`[PostVerification] Verifying Instagram post on device ${deviceId}`);
    
    // Wait for post to complete
    await sleep(3000);
    
    // Take screenshot
    const screenshotPath = await takeScreenshot(deviceId);
    
    // Check for success indicators
    const indicators = [
      'Post shared',
      'Your post has been shared',
      'shared to',
      'Edit profile', // If we're on profile page, post likely succeeded
    ];
    
    for (const indicator of indicators) {
      const found = await checkTextOnScreen(deviceId, indicator);
      if (found) {
        console.log(`[PostVerification] Instagram post verified (found: "${indicator}")`);
        return {
          verified: true,
          screenshotPath,
          message: `Post verified: found "${indicator}" on screen`,
        };
      }
    }
    
    // Check for error indicators
    const errorIndicators = [
      'Try again',
      'Something went wrong',
      'error',
      'failed',
      'couldn\'t',
    ];
    
    for (const errorIndicator of errorIndicators) {
      const found = await checkTextOnScreen(deviceId, errorIndicator);
      if (found) {
        console.log(`[PostVerification] Instagram post failed (found error: "${errorIndicator}")`);
        return {
          verified: false,
          screenshotPath,
          message: `Post failed: found error "${errorIndicator}" on screen`,
        };
      }
    }
    
    console.log(`[PostVerification] Could not verify Instagram post (no clear indicators)`);
    return {
      verified: false,
      screenshotPath,
      message: 'Could not verify post: no clear success or error indicators found',
    };
  } catch (error: any) {
    console.error(`[PostVerification] Error verifying Instagram post:`, error.message);
    return {
      verified: false,
      screenshotPath: null,
      message: `Verification error: ${error.message}`,
    };
  }
}

/**
 * Verify Twitter/X post
 */
export async function verifyTwitterPost(deviceId: string): Promise<{
  verified: boolean;
  screenshotPath: string | null;
  message: string;
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      verified: false,
      screenshotPath: null,
      message: 'API key not found',
    };
  }

  try {
    console.log(`[PostVerification] Verifying Twitter/X post on device ${deviceId}`);
    
    await sleep(3000);
    const screenshotPath = await takeScreenshot(deviceId);
    
    // Check for success indicators
    const indicators = [
      'Your post was sent',
      'Post sent',
      'Home', // If we're back on home timeline
    ];
    
    for (const indicator of indicators) {
      const found = await checkTextOnScreen(deviceId, indicator);
      if (found) {
        console.log(`[PostVerification] Twitter post verified (found: "${indicator}")`);
        return {
          verified: true,
          screenshotPath,
          message: `Post verified: found "${indicator}" on screen`,
        };
      }
    }
    
    console.log(`[PostVerification] Could not verify Twitter post`);
    return {
      verified: false,
      screenshotPath,
      message: 'Could not verify post: no clear success indicators found',
    };
  } catch (error: any) {
    console.error(`[PostVerification] Error verifying Twitter post:`, error.message);
    return {
      verified: false,
      screenshotPath: null,
      message: `Verification error: ${error.message}`,
    };
  }
}

/**
 * Verify TikTok post
 */
export async function verifyTikTokPost(deviceId: string): Promise<{
  verified: boolean;
  screenshotPath: string | null;
  message: string;
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      verified: false,
      screenshotPath: null,
      message: 'API key not found',
    };
  }

  try {
    console.log(`[PostVerification] Verifying TikTok post on device ${deviceId}`);
    
    await sleep(3000);
    const screenshotPath = await takeScreenshot(deviceId);
    
    // Check for success indicators
    const indicators = [
      'Your video is posted',
      'Posted',
      'For You', // If we're back on For You page
    ];
    
    for (const indicator of indicators) {
      const found = await checkTextOnScreen(deviceId, indicator);
      if (found) {
        console.log(`[PostVerification] TikTok post verified (found: "${indicator}")`);
        return {
          verified: true,
          screenshotPath,
          message: `Post verified: found "${indicator}" on screen`,
        };
      }
    }
    
    console.log(`[PostVerification] Could not verify TikTok post`);
    return {
      verified: false,
      screenshotPath,
      message: 'Could not verify post: no clear success indicators found',
    };
  } catch (error: any) {
    console.error(`[PostVerification] Error verifying TikTok post:`, error.message);
    return {
      verified: false,
      screenshotPath: null,
      message: `Verification error: ${error.message}`,
    };
  }
}

/**
 * Verify Facebook post
 */
export async function verifyFacebookPost(deviceId: string): Promise<{
  verified: boolean;
  screenshotPath: string | null;
  message: string;
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      verified: false,
      screenshotPath: null,
      message: 'API key not found',
    };
  }

  try {
    console.log(`[PostVerification] Verifying Facebook post on device ${deviceId}`);
    
    await sleep(3000);
    const screenshotPath = await takeScreenshot(deviceId);
    
    // Check for success indicators
    const indicators = [
      'Post published',
      'Your post is now public',
      'News Feed', // If we're back on news feed
    ];
    
    for (const indicator of indicators) {
      const found = await checkTextOnScreen(deviceId, indicator);
      if (found) {
        console.log(`[PostVerification] Facebook post verified (found: "${indicator}")`);
        return {
          verified: true,
          screenshotPath,
          message: `Post verified: found "${indicator}" on screen`,
        };
      }
    }
    
    console.log(`[PostVerification] Could not verify Facebook post`);
    return {
      verified: false,
      screenshotPath,
      message: 'Could not verify post: no clear success indicators found',
    };
  } catch (error: any) {
    console.error(`[PostVerification] Error verifying Facebook post:`, error.message);
    return {
      verified: false,
      screenshotPath: null,
      message: `Verification error: ${error.message}`,
    };
  }
}
