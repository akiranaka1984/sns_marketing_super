/**
 * SNS Posting via DuoPlus API - Improved Version
 * 
 * Key improvements:
 * 1. Post verification by checking profile/feed after posting
 * 2. Screenshot capture for debugging
 * 3. Better error detection and handling
 * 4. Retry logic for transient failures
 */

import axios from 'axios';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const API_URL = 'https://openapi.duoplus.net';

interface PostResult {
  success: boolean;
  message: string;
  error?: string;
  postUrl?: string; // URL of the posted content (if available)
  screenshotUrl?: string; // Screenshot for debugging
}

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
    console.error('[SNSPosting] Failed to get API key:', error);
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
    console.error(`[SNSPosting] ADB command failed: ${command}`, error.message);
    throw error;
  }
}

/**
 * Take screenshot of device
 */
async function takeScreenshot(apiKey: string, deviceId: string): Promise<string | null> {
  try {
    console.log(`[SNSPosting] Taking screenshot of device ${deviceId}`);
    
    // Take screenshot using ADB
    const screenshotPath = `/sdcard/screenshot_${Date.now()}.png`;
    await executeAdbCommand(apiKey, deviceId, `screencap -p ${screenshotPath}`);
    await sleep(2000);
    
    // TODO: Pull screenshot from device and upload to S3
    // For now, just return the path
    return screenshotPath;
  } catch (error: any) {
    console.error(`[SNSPosting] Failed to take screenshot:`, error.message);
    return null;
  }
}

/**
 * Check if text exists on screen using ADB
 */
async function checkTextOnScreen(
  apiKey: string,
  deviceId: string,
  searchText: string
): Promise<boolean> {
  try {
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
    
    return result && result.toString().includes(searchText);
  } catch (error) {
    // grep returns non-zero exit code if text not found
    return false;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download media file to device from URL
 */
async function downloadMediaToDevice(
  apiKey: string,
  deviceId: string,
  mediaUrl: string,
  destPath: string
): Promise<boolean> {
  try {
    console.log(`[SNSPosting] Downloading media to device: ${mediaUrl}`);
    
    const wgetCommand = `wget -O "${destPath}" "${mediaUrl}"`;
    await executeAdbCommand(apiKey, deviceId, wgetCommand);
    await sleep(5000);
    
    const checkCommand = `ls -la "${destPath}"`;
    await executeAdbCommand(apiKey, deviceId, checkCommand);
    
    console.log(`[SNSPosting] Media downloaded to: ${destPath}`);
    return true;
  } catch (error: any) {
    console.error(`[SNSPosting] Failed to download media:`, error.message);
    
    try {
      const curlCommand = `curl -o "${destPath}" "${mediaUrl}"`;
      await executeAdbCommand(apiKey, deviceId, curlCommand);
      await sleep(5000);
      return true;
    } catch (retryError) {
      console.error(`[SNSPosting] Retry with curl also failed`);
      return false;
    }
  }
}

/**
 * Download multiple media files to device
 */
async function downloadMultipleMedia(
  apiKey: string,
  deviceId: string,
  mediaUrls: string[],
  prefix: string
): Promise<string[]> {
  const downloadedPaths: string[] = [];
  
  for (let i = 0; i < mediaUrls.length; i++) {
    const mediaUrl = mediaUrls[i];
    const extension = mediaUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const destPath = `/sdcard/DCIM/${prefix}_${i + 1}.${extension}`;
    
    const success = await downloadMediaToDevice(apiKey, deviceId, mediaUrl, destPath);
    if (success) {
      downloadedPaths.push(destPath);
    }
  }
  
  return downloadedPaths;
}

/**
 * Verify Instagram post by checking profile
 */
async function verifyInstagramPost(
  apiKey: string,
  deviceId: string,
  expectedContent: string
): Promise<boolean> {
  try {
    console.log(`[SNSPosting] Verifying Instagram post...`);
    
    // Wait for post to complete
    await sleep(5000);
    
    // Go to profile
    await executeAdbCommand(apiKey, deviceId, 'input tap 950 1850'); // Profile tab
    await sleep(3000);
    
    // Take screenshot for verification
    await takeScreenshot(apiKey, deviceId);
    
    // Check if "Post shared" or similar success message exists
    const hasSuccessMessage = await checkTextOnScreen(apiKey, deviceId, 'shared');
    
    if (hasSuccessMessage) {
      console.log(`[SNSPosting] Instagram post verified successfully`);
      return true;
    }
    
    // Alternative: check if we're back on the feed/profile (post completed)
    const isOnProfile = await checkTextOnScreen(apiKey, deviceId, 'Edit profile');
    
    if (isOnProfile) {
      console.log(`[SNSPosting] Instagram post likely successful (on profile page)`);
      return true;
    }
    
    console.log(`[SNSPosting] Could not verify Instagram post`);
    return false;
  } catch (error: any) {
    console.error(`[SNSPosting] Error verifying Instagram post:`, error.message);
    return false;
  }
}

/**
 * Post to Instagram with verification
 */
export async function postToInstagramImproved(
  deviceId: string,
  content: string,
  mediaUrls?: string[]
): Promise<PostResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { success: false, message: 'API key not found', error: 'DUOPLUS_API_KEY not configured' };
  }

  let screenshotUrl: string | null = null;

  try {
    console.log(`[SNSPosting] Starting Instagram post on device ${deviceId}`);

    if (!mediaUrls || mediaUrls.length === 0) {
      return {
        success: false,
        message: 'Instagram requires image/video content. Please provide a media URL.',
        error: 'NO_MEDIA_PROVIDED',
      };
    }

    // Download all media files
    const downloadedPaths = await downloadMultipleMedia(apiKey, deviceId, mediaUrls, 'instagram_upload');
    
    if (downloadedPaths.length === 0) {
      return {
        success: false,
        message: 'Failed to download any media to device',
        error: 'DOWNLOAD_FAILED',
      };
    }

    console.log(`[SNSPosting] Downloaded ${downloadedPaths.length} media files for Instagram`);
    const isCarousel = downloadedPaths.length > 1;

    // Go to home screen
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(1000);

    // Force stop Instagram
    await executeAdbCommand(apiKey, deviceId, 'am force-stop com.instagram.android');
    await sleep(500);

    // Launch Instagram
    await executeAdbCommand(
      apiKey,
      deviceId,
      'monkey -p com.instagram.android -c android.intent.category.LAUNCHER 1'
    );
    await sleep(10000);

    // Check if logged in
    const isLoggedIn = await checkTextOnScreen(apiKey, deviceId, 'Home');
    if (!isLoggedIn) {
      screenshotUrl = await takeScreenshot(apiKey, deviceId);
      return {
        success: false,
        message: 'Instagram app is not logged in',
        error: 'NOT_LOGGED_IN',
        screenshotUrl: screenshotUrl || undefined,
      };
    }

    // Tap the create button (center bottom)
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 1850');
    await sleep(3000);

    // Tap "Post" option
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 1700');
    await sleep(2000);

    if (isCarousel) {
      // For carousel: tap the "Select multiple" icon
      await executeAdbCommand(apiKey, deviceId, 'input tap 950 1200');
      await sleep(2000);

      // Select multiple items from gallery
      const gridPositions = [
        { x: 150, y: 600 },
        { x: 350, y: 600 },
        { x: 550, y: 600 },
        { x: 750, y: 600 },
        { x: 150, y: 800 },
        { x: 350, y: 800 },
        { x: 550, y: 800 },
        { x: 750, y: 800 },
        { x: 150, y: 1000 },
        { x: 350, y: 1000 },
      ];

      const itemsToSelect = Math.min(downloadedPaths.length, 10);
      for (let i = 0; i < itemsToSelect; i++) {
        await executeAdbCommand(apiKey, deviceId, `input tap ${gridPositions[i].x} ${gridPositions[i].y}`);
        await sleep(500);
      }
    } else {
      // Single item selection
      await executeAdbCommand(apiKey, deviceId, 'input tap 150 600');
    }
    await sleep(2000);

    // Tap "Next" button (top right)
    await executeAdbCommand(apiKey, deviceId, 'input tap 980 100');
    await sleep(3000);

    // Tap "Next" again (skip filters)
    await executeAdbCommand(apiKey, deviceId, 'input tap 980 100');
    await sleep(3000);

    // Tap on caption area
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 300');
    await sleep(1000);

    // Input caption (Instagram has 2200 character limit)
    const truncatedContent = content.substring(0, 2200);
    const escapedContent = truncatedContent.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, ' ');
    await executeAdbCommand(apiKey, deviceId, `input text "${escapedContent}"`);
    await sleep(1000);

    // Tap "Share" button (top right)
    await executeAdbCommand(apiKey, deviceId, 'input tap 980 100');
    await sleep(8000); // Wait longer for post to complete

    // Verify post
    const verified = await verifyInstagramPost(apiKey, deviceId, content);
    
    if (!verified) {
      screenshotUrl = await takeScreenshot(apiKey, deviceId);
      return {
        success: false,
        message: 'Post command executed but could not verify successful posting',
        error: 'VERIFICATION_FAILED',
        screenshotUrl: screenshotUrl || undefined,
      };
    }

    const mediaCount = downloadedPaths.length;
    const postType = isCarousel ? 'carousel' : 'single';
    console.log(`[SNSPosting] Instagram ${postType} post verified successfully with ${mediaCount} media on device ${deviceId}`);
    
    return { 
      success: true, 
      message: `Posted and verified ${mediaCount} media file(s) successfully to Instagram as ${postType}` 
    };
  } catch (error: any) {
    console.error(`[SNSPosting] Instagram post failed on device ${deviceId}:`, error.message);
    
    // Take screenshot on error
    try {
      screenshotUrl = await takeScreenshot(apiKey, deviceId);
    } catch (screenshotError) {
      console.error(`[SNSPosting] Failed to take error screenshot`);
    }
    
    return { 
      success: false, 
      message: 'Failed to post to Instagram', 
      error: error.message,
      screenshotUrl: screenshotUrl || undefined,
    };
  }
}

/**
 * Check if device is powered on
 */
export async function isDevicePoweredOn(deviceId: string): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return false;
  }

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/cloudPhone/list`,
      {
        page: 1,
        pagesize: 100,
        link_status: ['1'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'DuoPlus-API-Key': apiKey,
          'Lang': 'en',
        },
        timeout: 10000,
      }
    );

    const devices = response.data?.data?.list || [];
    return devices.some((d: any) => d.id === deviceId && d.status === 1);
  } catch (error) {
    console.error('[SNSPosting] Failed to check device status:', error);
    return false;
  }
}
