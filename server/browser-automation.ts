/**
 * Browser Automation Helper
 * Web browser automation using ADB commands on DuoPlus cloud devices
 */

import axios from 'axios';
import { db } from './db';
import { settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

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
    console.error('[BrowserAutomation] Failed to get API key:', error);
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
    return { data: response.data.content };
  } catch (error: any) {
    console.error(`[BrowserAutomation] ADB command failed: ${command}`, error.message);
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
 * Open Chrome browser and navigate to URL
 */
export async function openBrowser(deviceId: string, url: string): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return false;
  }

  try {
    console.log(`[BrowserAutomation] Opening browser to: ${url}`);
    
    // Use am start with ACTION_VIEW intent to open URL directly in Chrome
    // This is the most reliable method
    await executeAdbCommand(
      apiKey,
      deviceId,
      `am start -a android.intent.action.VIEW -d "${url}"`
    );
    
    await sleep(5000); // Wait for browser and page to load
    console.log('[BrowserAutomation] Browser opened successfully');
    return true;
    
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to open browser:', error.message);
    return false;
  }
}

/**
 * Take screenshot
 */
export async function takeScreenshot(deviceId: string, filename: string): Promise<string | null> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return null;
  }

  try {
    const screenshotPath = `/sdcard/${filename}.png`;
    
    // Take screenshot
    await executeAdbCommand(apiKey, deviceId, `screencap -p ${screenshotPath}`);
    await sleep(1000);
    
    console.log(`[BrowserAutomation] Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to take screenshot:', error.message);
    return null;
  }
}

/**
 * Tap at coordinates
 */
export async function tapAtCoordinates(deviceId: string, x: number, y: number): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return false;
  }

  try {
    console.log(`[BrowserAutomation] Tapping at (${x}, ${y})`);
    await executeAdbCommand(apiKey, deviceId, `input tap ${x} ${y}`);
    await sleep(1000);
    return true;
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to tap:', error.message);
    return false;
  }
}

/**
 * Input text
 */
export async function inputText(deviceId: string, text: string): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return false;
  }

  try {
    console.log(`[BrowserAutomation] Inputting text: ${text.substring(0, 50)}...`);
    
    // Escape special characters for shell
    const escapedText = text.replace(/[\\$"`]/g, '\\$&').replace(/\s/g, '%s');
    
    await executeAdbCommand(apiKey, deviceId, `input text "${escapedText}"`);
    await sleep(1000);
    return true;
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to input text:', error.message);
    return false;
  }
}

/**
 * Press key (e.g., KEYCODE_ENTER, KEYCODE_BACK)
 */
export async function pressKey(deviceId: string, keycode: string): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return false;
  }

  try {
    console.log(`[BrowserAutomation] Pressing key: ${keycode}`);
    await executeAdbCommand(apiKey, deviceId, `input keyevent ${keycode}`);
    await sleep(500);
    return true;
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to press key:', error.message);
    return false;
  }
}

/**
 * Swipe gesture
 */
export async function swipe(
  deviceId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  duration: number = 300
): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return false;
  }

  try {
    console.log(`[BrowserAutomation] Swiping from (${x1}, ${y1}) to (${x2}, ${y2})`);
    await executeAdbCommand(apiKey, deviceId, `input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    await sleep(1000);
    return true;
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to swipe:', error.message);
    return false;
  }
}

/**
 * Get current activity (to check which app/screen is active)
 */
export async function getCurrentActivity(deviceId: string): Promise<string | null> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('[BrowserAutomation] API key not configured');
    return null;
  }

  try {
    const result = await executeAdbCommand(
      apiKey,
      deviceId,
      'dumpsys window windows | grep -E "mCurrentFocus"'
    );
    
    if (result.data) {
      const dataString = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
      console.log(`[BrowserAutomation] Current activity: ${dataString}`);
      return dataString;
    }
    
    return null;
  } catch (error: any) {
    console.error('[BrowserAutomation] Failed to get current activity:', error.message);
    return null;
  }
}
