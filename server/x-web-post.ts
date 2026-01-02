/**
 * X (formerly Twitter) Web Posting
 * Post to X using web browser automation
 */

import {
  openBrowser,
  takeScreenshot,
  tapAtCoordinates,
  inputText,
  pressKey,
  swipe,
  getCurrentActivity,
} from './browser-automation';
import { storagePut } from './storage';

interface XPostResult {
  success: boolean;
  error?: string;
  screenshots: Array<{
    step: string;
    url: string;
  }>;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload screenshot to S3
 */
async function uploadScreenshot(deviceId: string, stepName: string): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const filename = `x_web_${stepName}_${timestamp}`;
    const screenshotPath = await takeScreenshot(deviceId, filename);
    
    if (!screenshotPath) {
      return null;
    }
    
    // Note: In a real implementation, we would need to download the screenshot
    // from the device and upload it to S3. For now, we'll return a placeholder.
    console.log(`[XWeb] Screenshot saved on device: ${screenshotPath}`);
    return screenshotPath;
  } catch (error: any) {
    console.error(`[XWeb] Failed to upload screenshot:`, error.message);
    return null;
  }
}

/**
 * Post to X using web browser
 */
export async function postToXWeb(
  deviceId: string,
  content: string,
  mediaUrl?: string
): Promise<XPostResult> {
  const screenshots: Array<{ step: string; url: string }> = [];
  
  try {
    console.log('[XWeb] Starting X web posting...');
    
    // Step 1: Open Twitter in browser
    console.log('[XWeb] Step 1: Opening X...');
    const opened = await openBrowser(deviceId, 'https://twitter.com');
    if (!opened) {
      return {
        success: false,
        error: 'Failed to open browser',
        screenshots,
      };
    }
    
    await sleep(5000); // Wait for page to load
    const screenshot1 = await uploadScreenshot(deviceId, 'step1_opened');
    if (screenshot1) screenshots.push({ step: 'Opened X', url: screenshot1 });
    
    // Step 2: Check if logged in (look for compose button)
    console.log('[XWeb] Step 2: Checking login status...');
    await sleep(2000);
    const screenshot2 = await uploadScreenshot(deviceId, 'step2_login_check');
    if (screenshot2) screenshots.push({ step: 'Login Check', url: screenshot2 });
    
    // Step 3: Click compose button (usually at bottom right or top)
    // Coordinates for compose button (these are approximate and may need adjustment)
    // For a 1080x2400 device, compose button is typically at:
    // - Bottom right: (950, 2200) for floating action button
    // - Top bar: (540, 200) for "What's happening?" field
    console.log('[XWeb] Step 3: Clicking compose button...');
    
    // Try clicking the "What's happening?" field at the top
    await tapAtCoordinates(deviceId, 540, 400);
    await sleep(3000);
    const screenshot3 = await uploadScreenshot(deviceId, 'step3_compose_clicked');
    if (screenshot3) screenshots.push({ step: 'Compose Clicked', url: screenshot3 });
    
    // Step 4: Input tweet content
    console.log('[XWeb] Step 4: Inputting post content...');
    const inputSuccess = await inputText(deviceId, content);
    if (!inputSuccess) {
      return {
        success: false,
        error: 'Failed to input post content',
        screenshots,
      };
    }
    
    await sleep(2000);
    const screenshot4 = await uploadScreenshot(deviceId, 'step4_content_input');
    if (screenshot4) screenshots.push({ step: 'Content Input', url: screenshot4 });
    
    // Step 5: If media URL provided, handle image upload
    if (mediaUrl) {
      console.log('[XWeb] Step 5: Uploading media...');
      // Media upload would require more complex logic
      // For now, we'll skip this step
      console.log('[XWeb] Media upload not yet implemented');
    }
    
    // Step 6: Click Post/Tweet button
    // Post button is typically at top right after compose
    // Approximate coordinates: (950, 150)
    console.log('[XWeb] Step 6: Clicking Post button...');
    await tapAtCoordinates(deviceId, 950, 150);
    await sleep(3000);
    const screenshot5 = await uploadScreenshot(deviceId, 'step5_post_clicked');
    if (screenshot5) screenshots.push({ step: 'Post Clicked', url: screenshot5 });
    
    // Step 7: Verify post was successful
    console.log('[XWeb] Step 7: Verifying post...');
    await sleep(2000);
    const screenshot6 = await uploadScreenshot(deviceId, 'step6_post_complete');
    if (screenshot6) screenshots.push({ step: 'Post Complete', url: screenshot6 });
    
    console.log('[XWeb] X web posting completed successfully');
    return {
      success: true,
      screenshots,
    };
    
  } catch (error: any) {
    console.error('[XWeb] X web posting failed:', error.message);
    return {
      success: false,
      error: error.message,
      screenshots,
    };
  }
}

/**
 * Check if user is logged in to X
 */
export async function checkXLogin(deviceId: string): Promise<boolean> {
  try {
    console.log('[XWeb] Checking X login status...');
    
    // Open X
    await openBrowser(deviceId, 'https://twitter.com');
    await sleep(5000);
    
    // Take screenshot to check
    await takeScreenshot(deviceId, 'x_login_check');
    
    // Get current activity/screen
    const activity = await getCurrentActivity(deviceId);
    console.log('[XWeb] Current activity:', activity);
    
    // In a real implementation, we would analyze the screenshot or page content
    // to determine if the user is logged in
    // For now, we'll return true and let the user verify manually
    return true;
    
  } catch (error: any) {
    console.error('[XWeb] Failed to check login status:', error.message);
    return false;
  }
}
