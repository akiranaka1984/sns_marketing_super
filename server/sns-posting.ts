/**
 * SNS Posting via DuoPlus API
 * Implements actual posting to Twitter/X, TikTok, Instagram, Facebook
 * using DuoPlus cloud phone ADB commands
 * 
 * Supports media (image/video) posting for Instagram and TikTok
 * Supports carousel posts (multiple images/videos) for Instagram and TikTok
 */

import axios from 'axios';
import { db } from './db';
import { settings, accounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyInstagramPost, verifyTwitterPost, verifyTikTokPost, verifyFacebookPost } from './post-verification';
import { postToXWebV2 } from './x-web-post-v2';

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
    } catch (curlError: any) {
      console.error(`[SNSPosting] Curl also failed:`, curlError.message);
      return false;
    }
  }
}

/**
 * Trigger media scanner to make file visible in gallery
 */
async function triggerMediaScan(apiKey: string, deviceId: string, filePath: string): Promise<void> {
  try {
    const scanCommand = `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${filePath}"`;
    await executeAdbCommand(apiKey, deviceId, scanCommand);
    await sleep(2000);
    console.log(`[SNSPosting] Media scanner triggered for: ${filePath}`);
  } catch (error: any) {
    console.error(`[SNSPosting] Failed to trigger media scan:`, error.message);
  }
}

/**
 * Download multiple media files to device
 * Returns array of local file paths
 */
async function downloadMultipleMedia(
  apiKey: string,
  deviceId: string,
  mediaUrls: string[],
  prefix: string
): Promise<string[]> {
  const downloadedPaths: string[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < mediaUrls.length; i++) {
    const mediaUrl = mediaUrls[i];
    const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('video');
    const extension = isVideo ? 'mp4' : 'jpg';
    const mediaPath = `/sdcard/DCIM/Camera/${prefix}_${timestamp}_${i}.${extension}`;

    console.log(`[SNSPosting] Downloading media ${i + 1}/${mediaUrls.length}...`);
    const downloaded = await downloadMediaToDevice(apiKey, deviceId, mediaUrl, mediaPath);
    
    if (downloaded) {
      await triggerMediaScan(apiKey, deviceId, mediaPath);
      downloadedPaths.push(mediaPath);
    } else {
      console.error(`[SNSPosting] Failed to download media ${i + 1}`);
    }
  }

  // Wait for all media to be scanned
  await sleep(3000);
  
  return downloadedPaths;
}

/**
 * Post to X (Twitter) using Web version (Chrome)
 * This uses the improved x-web-post-v2 implementation with:
 * - Chrome force-stop before navigation
 * - Page load verification
 * - Japanese text support via clipboard
 */
export async function postToTwitter(
  deviceId: string,
  content: string,
  mediaUrls?: string[]
): Promise<PostResult> {
  try {
    console.log(`[SNSPosting] Starting X Web post on device ${deviceId}`);
    console.log(`[SNSPosting] Content: ${content}`);
    
    // Use the improved Web version (x-web-post-v2)
    const result = await postToXWebV2(deviceId, content, mediaUrls?.[0]);
    
    if (result.success) {
      console.log(`[SNSPosting] X Web post successful on device ${deviceId}`);
      return {
        success: true,
        message: 'Post published successfully to X (Web)',
        screenshotUrl: result.screenshots?.[result.screenshots.length - 1]?.url,
      };
    } else {
      console.error(`[SNSPosting] X Web post failed: ${result.error}`);
      return {
        success: false,
        message: result.error || 'Failed to post to X (Web)',
        error: result.error,
        screenshotUrl: result.screenshots?.[result.screenshots.length - 1]?.url,
      };
    }
  } catch (error: any) {
    console.error(`[SNSPosting] X Web post failed on device ${deviceId}:`, error.message);
    return { 
      success: false, 
      message: 'Failed to post to X (Web)', 
      error: error.message 
    };
  }
}

/**
 * Post to TikTok with video (supports multiple videos for photo mode)
 */
export async function postToTikTok(
  deviceId: string,
  content: string,
  mediaUrls?: string[]
): Promise<PostResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { success: false, message: 'API key not found', error: 'DUOPLUS_API_KEY not configured' };
  }

  try {
    console.log(`[SNSPosting] Starting TikTok post on device ${deviceId}`);

    if (!mediaUrls || mediaUrls.length === 0) {
      return {
        success: false,
        message: 'TikTok requires video content. Please provide a video URL.',
        error: 'NO_MEDIA_PROVIDED',
      };
    }

    // Download all media files
    const downloadedPaths = await downloadMultipleMedia(apiKey, deviceId, mediaUrls, 'tiktok_upload');
    
    if (downloadedPaths.length === 0) {
      return {
        success: false,
        message: 'Failed to download any media to device',
        error: 'DOWNLOAD_FAILED',
      };
    }

    console.log(`[SNSPosting] Downloaded ${downloadedPaths.length} media files for TikTok`);

    // Go to home screen
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(1000);

    // Force stop TikTok
    await executeAdbCommand(apiKey, deviceId, 'am force-stop com.zhiliaoapp.musically');
    await sleep(500);

    // Launch TikTok
    await executeAdbCommand(
      apiKey,
      deviceId,
      'monkey -p com.zhiliaoapp.musically -c android.intent.category.LAUNCHER 1'
    );
    await sleep(10000);

    // Tap the create button (center bottom)
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 1850');
    await sleep(3000);

    // Tap "Upload" to select from gallery
    await executeAdbCommand(apiKey, deviceId, 'input tap 100 1800');
    await sleep(3000);

    // For multiple media, we need to select multiple items
    if (downloadedPaths.length > 1) {
      // Tap "Multiple" or long press to enable multi-select mode
      // Long press on first item to enable multi-select
      await executeAdbCommand(apiKey, deviceId, 'input swipe 150 400 150 400 1000');
      await sleep(2000);

      // Select additional items (grid positions)
      const gridPositions = [
        { x: 150, y: 400 },   // First item
        { x: 350, y: 400 },   // Second item
        { x: 550, y: 400 },   // Third item
        { x: 750, y: 400 },   // Fourth item
        { x: 150, y: 600 },   // Fifth item
        { x: 350, y: 600 },   // Sixth item
        { x: 550, y: 600 },   // Seventh item
        { x: 750, y: 600 },   // Eighth item
        { x: 150, y: 800 },   // Ninth item
        { x: 350, y: 800 },   // Tenth item
      ];

      // Select items based on downloaded count (max 10 for TikTok photo mode)
      const itemsToSelect = Math.min(downloadedPaths.length, 10);
      for (let i = 0; i < itemsToSelect; i++) {
        await executeAdbCommand(apiKey, deviceId, `input tap ${gridPositions[i].x} ${gridPositions[i].y}`);
        await sleep(500);
      }
    } else {
      // Single item selection
      await executeAdbCommand(apiKey, deviceId, 'input tap 150 400');
    }
    await sleep(2000);

    // Tap "Next" button
    await executeAdbCommand(apiKey, deviceId, 'input tap 950 1800');
    await sleep(3000);

    // Tap "Next" again (skip editing)
    await executeAdbCommand(apiKey, deviceId, 'input tap 950 1800');
    await sleep(3000);

    // Tap on caption area
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 300');
    await sleep(1000);

    // Input caption
    const escapedContent = content.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, ' ');
    await executeAdbCommand(apiKey, deviceId, `input text "${escapedContent}"`);
    await sleep(1000);

    // Tap "Post" button
    await executeAdbCommand(apiKey, deviceId, 'input tap 950 1800');
    await sleep(8000); // Wait for post to complete

    // Verify post
    console.log(`[SNSPosting] Verifying TikTok post...`);
    const verification = await verifyTikTokPost(deviceId);
    
    const mediaCount = downloadedPaths.length;
    
    if (!verification.verified) {
      console.log(`[SNSPosting] TikTok post verification failed: ${verification.message}`);
      return {
        success: false,
        message: `Post command executed but verification failed: ${verification.message}`,
        error: 'VERIFICATION_FAILED',
        screenshotUrl: verification.screenshotPath || undefined,
      };
    }
    
    console.log(`[SNSPosting] TikTok post verified successfully with ${mediaCount} media on device ${deviceId}`);
    return { 
      success: true, 
      message: `Posted and verified ${mediaCount} media file(s) to TikTok`,
      screenshotUrl: verification.screenshotPath || undefined,
    };
  } catch (error: any) {
    console.error(`[SNSPosting] TikTok post failed on device ${deviceId}:`, error.message);
    return { success: false, message: 'Failed to post to TikTok', error: error.message };
  }
}

/**
 * Post to Instagram with carousel support (multiple images/videos)
 */
export async function postToInstagram(
  deviceId: string,
  content: string,
  mediaUrls?: string[]
): Promise<PostResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { success: false, message: 'API key not found', error: 'DUOPLUS_API_KEY not configured' };
  }

  try {
    console.log(`[SNSPosting] Starting Instagram post on device ${deviceId}`);

    // Validate media URLs
    if (!mediaUrls || mediaUrls.length === 0) {
      console.error(`[SNSPosting] Instagram post failed on device ${deviceId}: NO_MEDIA_PROVIDED`);
      return {
        success: false,
        message: 'Instagram requires image/video content. Please provide a media URL.',
        error: 'NO_MEDIA_PROVIDED',
      };
    }

    // Additional validation: ensure mediaUrls are not empty strings
    if (Array.isArray(mediaUrls) && mediaUrls.every(url => !url || url.trim() === '')) {
      console.error(`[SNSPosting] Instagram post failed on device ${deviceId}: INVALID_MEDIA_URLS`);
      return {
        success: false,
        message: 'Instagram requires valid media URLs. All URLs are empty.',
        error: 'INVALID_MEDIA_URLS',
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

    // Tap the create button (center bottom)
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 1850');
    await sleep(3000);

    // Tap "Post" option
    await executeAdbCommand(apiKey, deviceId, 'input tap 540 1700');
    await sleep(2000);

    if (isCarousel) {
      // For carousel: tap the "Select multiple" icon (usually a stacked squares icon)
      // This is typically in the bottom right of the gallery preview
      await executeAdbCommand(apiKey, deviceId, 'input tap 950 1200');
      await sleep(2000);

      // Select multiple items from gallery
      // Grid positions for Instagram gallery (most recent items first)
      const gridPositions = [
        { x: 150, y: 600 },   // First item
        { x: 350, y: 600 },   // Second item
        { x: 550, y: 600 },   // Third item
        { x: 750, y: 600 },   // Fourth item
        { x: 150, y: 800 },   // Fifth item
        { x: 350, y: 800 },   // Sixth item
        { x: 550, y: 800 },   // Seventh item
        { x: 750, y: 800 },   // Eighth item
        { x: 150, y: 1000 },  // Ninth item
        { x: 350, y: 1000 },  // Tenth item
      ];

      // Select items based on downloaded count (max 10 for Instagram carousel)
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
    console.log(`[SNSPosting] Verifying Instagram post...`);
    const verification = await verifyInstagramPost(deviceId);
    
    const mediaCount = downloadedPaths.length;
    const postType = isCarousel ? 'carousel' : 'single';
    
    if (!verification.verified) {
      console.log(`[SNSPosting] Instagram post verification failed: ${verification.message}`);
      return {
        success: false,
        message: `Post command executed but verification failed: ${verification.message}`,
        error: 'VERIFICATION_FAILED',
        screenshotUrl: verification.screenshotPath || undefined,
      };
    }
    
    console.log(`[SNSPosting] Instagram ${postType} post verified successfully with ${mediaCount} media on device ${deviceId}`);
    return { 
      success: true, 
      message: `Posted and verified ${mediaCount} media file(s) to Instagram as ${postType}`,
      screenshotUrl: verification.screenshotPath || undefined,
    };
  } catch (error: any) {
    console.error(`[SNSPosting] Instagram post failed on device ${deviceId}:`, error.message);
    return { success: false, message: 'Failed to post to Instagram', error: error.message };
  }
}

/**
 * Post to Facebook
 */
export async function postToFacebook(
  deviceId: string,
  content: string,
  mediaUrls?: string[]
): Promise<PostResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { success: false, message: 'API key not found', error: 'DUOPLUS_API_KEY not configured' };
  }

  try {
    console.log(`[SNSPosting] Starting Facebook post on device ${deviceId}`);

    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(1000);

    await executeAdbCommand(apiKey, deviceId, 'am force-stop com.facebook.katana');
    await sleep(500);

    await executeAdbCommand(
      apiKey,
      deviceId,
      'monkey -p com.facebook.katana -c android.intent.category.LAUNCHER 1'
    );
    await sleep(8000);

    await executeAdbCommand(apiKey, deviceId, 'input tap 540 300');
    await sleep(3000);

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        const escapedLine = line.replace(/"/g, '\\"').replace(/'/g, "\\'");
        await executeAdbCommand(apiKey, deviceId, `input text "${escapedLine}"`);
      }
      if (i < lines.length - 1) {
        await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_ENTER');
      }
      await sleep(300);
    }
    await sleep(1000);

    await executeAdbCommand(apiKey, deviceId, 'input tap 540 100');
    await sleep(8000); // Wait for post to complete

    // Verify post
    console.log(`[SNSPosting] Verifying Facebook post...`);
    const verification = await verifyFacebookPost(deviceId);
    
    if (!verification.verified) {
      console.log(`[SNSPosting] Facebook post verification failed: ${verification.message}`);
      return {
        success: false,
        message: `Post command executed but verification failed: ${verification.message}`,
        error: 'VERIFICATION_FAILED',
        screenshotUrl: verification.screenshotPath || undefined,
      };
    }
    
    console.log(`[SNSPosting] Facebook post verified successfully on device ${deviceId}`);
    return { 
      success: true, 
      message: 'Post published and verified successfully to Facebook',
      screenshotUrl: verification.screenshotPath || undefined,
    };
  } catch (error: any) {
    console.error(`[SNSPosting] Facebook post failed on device ${deviceId}:`, error.message);
    return { success: false, message: 'Failed to post to Facebook', error: error.message };
  }
}

/**
 * Post to SNS based on platform
 */
export async function postToSNS(
  platform: string,
  deviceId: string,
  content: string,
  mediaUrls?: string[]
): Promise<PostResult> {
  const normalizedPlatform = platform.toLowerCase();

  switch (normalizedPlatform) {
    case 'twitter':
    case 'x':
      return postToTwitter(deviceId, content, mediaUrls);
    case 'tiktok':
      return postToTikTok(deviceId, content, mediaUrls);
    case 'instagram':
      return postToInstagram(deviceId, content, mediaUrls);
    case 'facebook':
      return postToFacebook(deviceId, content, mediaUrls);
    default:
      return {
        success: false,
        message: `Unsupported platform: ${platform}`,
        error: 'UNSUPPORTED_PLATFORM',
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
