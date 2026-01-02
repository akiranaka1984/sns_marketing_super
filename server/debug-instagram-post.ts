/**
 * Debug Instagram Post
 * Test Instagram posting with step-by-step screenshots
 * to identify where the posting process fails
 */

import axios from 'axios';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { storagePut } from './storage';
import { getInstagramCoordinates, isValidResolution, type DeviceResolution } from './coordinate-calculator';

const API_URL = 'https://openapi.duoplus.net';

interface DebugStep {
  step: string;
  stepNumber: number;
  description: string;
  screenshotUrl?: string;
  error?: string;
  timestamp: Date;
}

interface DebugResult {
  success: boolean;
  failedAt?: string;
  steps: DebugStep[];
  deviceResolution?: { width: number; height: number } | null;
  error?: string;
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
    console.error('[DebugInstagram] Failed to get API key:', error);
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
    // Return the content field from DuoPlus API response
    return { data: response.data.content };
  } catch (error: any) {
    console.error(`[DebugInstagram] ADB command failed: ${command}`, error.message);
    throw error;
  }
}

/**
 * Take screenshot and upload to S3
 */
async function takeScreenshot(apiKey: string, deviceId: string, stepName: string): Promise<string | undefined> {
  try {
    console.log(`[DebugInstagram] Taking screenshot for step: ${stepName}`);
    
    const timestamp = Date.now();
    const screenshotPath = `/sdcard/debug_instagram_${stepName}_${timestamp}.png`;
    
    // Take screenshot using ADB screencap command
    await executeAdbCommand(apiKey, deviceId, `screencap -p ${screenshotPath}`);
    await sleep(2000);
    
    console.log(`[DebugInstagram] Screenshot saved to device: ${screenshotPath}`);
    
    // Download screenshot from device using base64 encoding
    const result = await executeAdbCommand(apiKey, deviceId, `cat ${screenshotPath} | base64`);
    
    console.log(`[DebugInstagram] ADB result for ${stepName}:`, JSON.stringify(result).substring(0, 200));
    
    if (!result || !result.data) {
      console.error(`[DebugInstagram] Failed to download screenshot from device. Result:`, result);
      return undefined;
    }
    
    // Clean up base64 string (remove newlines and whitespace)
    const base64String = result.data.toString().replace(/\s/g, '');
    const buffer = Buffer.from(base64String, 'base64');
    console.log(`[DebugInstagram] Downloaded ${buffer.length} bytes from device`);
    
    // Upload to S3
    const fileName = `debug-instagram/${deviceId}/${stepName}-${timestamp}.png`;
    const { url } = await storagePut(fileName, buffer, 'image/png');
    console.log(`[DebugInstagram] Screenshot uploaded: ${url}`);
    
    // Clean up screenshot from device
    try {
      await executeAdbCommand(apiKey, deviceId, `rm ${screenshotPath}`);
    } catch (cleanupError) {
      console.error(`[DebugInstagram] Failed to clean up screenshot from device`);
    }
    
    return url;
  } catch (error: any) {
    console.error(`[DebugInstagram] Failed to take screenshot for ${stepName}:`, error.message);
    return undefined;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get device resolution
 */
async function getDeviceResolution(apiKey: string, deviceId: string): Promise<{ width: number; height: number } | null> {
  try {
    const result = await executeAdbCommand(apiKey, deviceId, 'wm size');
    console.log(`[DebugInstagram] Device resolution raw result:`, JSON.stringify(result, null, 2));
    
    if (!result || !result.data) {
      console.error(`[DebugInstagram] No data in resolution result`);
      return null;
    }
    
    // Convert data to string if it's not already
    let dataString: string;
    if (typeof result.data === 'string') {
      dataString = result.data;
    } else if (typeof result.data === 'object') {
      // If data is an object, try to extract the output field
      dataString = result.data.output || result.data.content || JSON.stringify(result.data);
    } else {
      dataString = String(result.data);
    }
    
    console.log(`[DebugInstagram] Device resolution data string:`, dataString);
    
    // Parse "Physical size: 1080x2400" or "Override size: 1080x2400"
    const match = dataString.match(/(\d+)x(\d+)/);
    if (match) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      console.log(`[DebugInstagram] Parsed resolution: ${width}x${height}`);
      return { width, height };
    }
    
    console.error(`[DebugInstagram] Failed to parse resolution from:`, dataString);
    return null;
  } catch (error: any) {
    console.error(`[DebugInstagram] Failed to get device resolution:`, error.message);
    return null;
  }
}

/**
 * Debug Instagram post with step-by-step screenshots
 */
export async function debugInstagramPost(
  deviceId: string,
  content: string,
  mediaUrl?: string
): Promise<DebugResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'DUOPLUS_API_KEY not configured',
      steps: [],
    };
  }

  const steps: DebugStep[] = [];
  let currentStep = 0;

  try {
    console.log(`[DebugInstagram] Starting debug Instagram post on device ${deviceId}`);

    // Step 0: Get device resolution
    currentStep = 0;
    const resolution = await getDeviceResolution(apiKey, deviceId);
    console.log(`[DebugInstagram] Device resolution:`, resolution);

    // Validate resolution and calculate coordinates
    if (!isValidResolution(resolution)) {
      throw new Error('Failed to get valid device resolution. Cannot calculate tap coordinates.');
    }

    const coords = getInstagramCoordinates(resolution);
    console.log(`[DebugInstagram] Calculated Instagram coordinates:`, coords);

    // Step 1: Go to home screen
    currentStep = 1;
    console.log(`[DebugInstagram] Step ${currentStep}: Go to home screen`);
    await executeAdbCommand(apiKey, deviceId, 'input keyevent KEYCODE_HOME');
    await sleep(2000);
    const screenshot1 = await takeScreenshot(apiKey, deviceId, '1_home');
    steps.push({
      step: '1_home',
      stepNumber: 1,
      description: 'Go to home screen',
      screenshotUrl: screenshot1,
      timestamp: new Date(),
    });

    // Step 2: Force stop Instagram
    currentStep = 2;
    console.log(`[DebugInstagram] Step ${currentStep}: Force stop Instagram`);
    await executeAdbCommand(apiKey, deviceId, 'am force-stop com.instagram.android');
    await sleep(1000);
    steps.push({
      step: '2_force_stop',
      stepNumber: 2,
      description: 'Force stop Instagram app',
      timestamp: new Date(),
    });

    // Step 3: Launch Instagram
    currentStep = 3;
    console.log(`[DebugInstagram] Step ${currentStep}: Launch Instagram`);
    await executeAdbCommand(
      apiKey,
      deviceId,
      'monkey -p com.instagram.android -c android.intent.category.LAUNCHER 1'
    );
    await sleep(10000);
    const screenshot3 = await takeScreenshot(apiKey, deviceId, '3_app_opened');
    steps.push({
      step: '3_app_opened',
      stepNumber: 3,
      description: 'Launch Instagram app',
      screenshotUrl: screenshot3,
      timestamp: new Date(),
    });

    // Step 4: Tap create button (center bottom)
    currentStep = 4;
    console.log(`[DebugInstagram] Step ${currentStep}: Tap create button at (${coords.createButton.x}, ${coords.createButton.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.createButton.x} ${coords.createButton.y}`);
    await sleep(3000);
    const screenshot4 = await takeScreenshot(apiKey, deviceId, '4_create_button');
    steps.push({
      step: '4_create_button',
      stepNumber: 4,
      description: `Tap create button (${coords.createButton.x}, ${coords.createButton.y})`,
      screenshotUrl: screenshot4,
      timestamp: new Date(),
    });

    // Step 5: Tap "Post" option
    currentStep = 5;
    console.log(`[DebugInstagram] Step ${currentStep}: Tap Post option at (${coords.postOption.x}, ${coords.postOption.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.postOption.x} ${coords.postOption.y}`);
    await sleep(2000);
    const screenshot5 = await takeScreenshot(apiKey, deviceId, '5_post_option');
    steps.push({
      step: '5_post_option',
      stepNumber: 5,
      description: `Tap Post option (${coords.postOption.x}, ${coords.postOption.y})`,
      screenshotUrl: screenshot5,
      timestamp: new Date(),
    });

    // Step 6: Select media (first item in gallery)
    currentStep = 6;
    console.log(`[DebugInstagram] Step ${currentStep}: Select media at (${coords.mediaSelect.x}, ${coords.mediaSelect.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.mediaSelect.x} ${coords.mediaSelect.y}`);
    await sleep(2000);
    const screenshot6 = await takeScreenshot(apiKey, deviceId, '6_media_selected');
    steps.push({
      step: '6_media_selected',
      stepNumber: 6,
      description: `Select media from gallery (${coords.mediaSelect.x}, ${coords.mediaSelect.y})`,
      screenshotUrl: screenshot6,
      timestamp: new Date(),
    });

    // Step 7: Tap "Next" button (top right)
    currentStep = 7;
    console.log(`[DebugInstagram] Step ${currentStep}: Tap Next button at (${coords.nextButton.x}, ${coords.nextButton.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.nextButton.x} ${coords.nextButton.y}`);
    await sleep(3000);
    const screenshot7 = await takeScreenshot(apiKey, deviceId, '7_next');
    steps.push({
      step: '7_next',
      stepNumber: 7,
      description: `Tap Next button (${coords.nextButton.x}, ${coords.nextButton.y})`,
      screenshotUrl: screenshot7,
      timestamp: new Date(),
    });

    // Step 8: Tap "Next" again (skip filters)
    currentStep = 8;
    console.log(`[DebugInstagram] Step ${currentStep}: Tap Next again (skip filters) at (${coords.nextButton.x}, ${coords.nextButton.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.nextButton.x} ${coords.nextButton.y}`);
    await sleep(3000);
    const screenshot8 = await takeScreenshot(apiKey, deviceId, '8_skip_filters');
    steps.push({
      step: '8_skip_filters',
      stepNumber: 8,
      description: `Tap Next again to skip filters (${coords.nextButton.x}, ${coords.nextButton.y})`,
      screenshotUrl: screenshot8,
      timestamp: new Date(),
    });

    // Step 9: Tap caption area
    currentStep = 9;
    console.log(`[DebugInstagram] Step ${currentStep}: Tap caption area at (${coords.captionArea.x}, ${coords.captionArea.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.captionArea.x} ${coords.captionArea.y}`);
    await sleep(1000);
    const screenshot9 = await takeScreenshot(apiKey, deviceId, '9_caption_area');
    steps.push({
      step: '9_caption_area',
      stepNumber: 9,
      description: `Tap caption area (${coords.captionArea.x}, ${coords.captionArea.y})`,
      screenshotUrl: screenshot9,
      timestamp: new Date(),
    });

    // Step 10: Input caption
    currentStep = 10;
    console.log(`[DebugInstagram] Step ${currentStep}: Input caption`);
    const truncatedContent = content.substring(0, 100); // Shorter for testing
    const escapedContent = truncatedContent.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, ' ');
    await executeAdbCommand(apiKey, deviceId, `input text "${escapedContent}"`);
    await sleep(2000);
    const screenshot10 = await takeScreenshot(apiKey, deviceId, '10_caption_input');
    steps.push({
      step: '10_caption_input',
      stepNumber: 10,
      description: `Input caption: "${truncatedContent}"`,
      screenshotUrl: screenshot10,
      timestamp: new Date(),
    });

    // Step 11: Tap "Share" button
    currentStep = 11;
    console.log(`[DebugInstagram] Step ${currentStep}: Tap Share button at (${coords.shareButton.x}, ${coords.shareButton.y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${coords.shareButton.x} ${coords.shareButton.y}`);
    await sleep(8000);
    const screenshot11 = await takeScreenshot(apiKey, deviceId, '11_share');
    steps.push({
      step: '11_share',
      stepNumber: 11,
      description: `Tap Share button (${coords.shareButton.x}, ${coords.shareButton.y})`,
      screenshotUrl: screenshot11,
      timestamp: new Date(),
    });

    // Step 12: Final screenshot (verify post)
    currentStep = 12;
    console.log(`[DebugInstagram] Step ${currentStep}: Final screenshot`);
    await sleep(3000);
    const screenshot12 = await takeScreenshot(apiKey, deviceId, '12_final');
    steps.push({
      step: '12_final',
      stepNumber: 12,
      description: 'Final screenshot after posting',
      screenshotUrl: screenshot12,
      timestamp: new Date(),
    });

    console.log(`[DebugInstagram] Debug Instagram post completed successfully`);
    return {
      success: true,
      steps,
      deviceResolution: resolution,
    };
  } catch (error: any) {
    console.error(`[DebugInstagram] Debug Instagram post failed at step ${currentStep}:`, error.message);
    
    // Take error screenshot
    try {
      const errorScreenshot = await takeScreenshot(apiKey, deviceId, `error_step_${currentStep}`);
      steps.push({
        step: `error_step_${currentStep}`,
        stepNumber: currentStep,
        description: `Error occurred at step ${currentStep}`,
        screenshotUrl: errorScreenshot,
        error: error.message,
        timestamp: new Date(),
      });
    } catch (screenshotError) {
      console.error(`[DebugInstagram] Failed to take error screenshot:`, screenshotError);
    }

    return {
      success: false,
      failedAt: `Step ${currentStep}`,
      steps,
      error: error.message,
    };
  }
}
