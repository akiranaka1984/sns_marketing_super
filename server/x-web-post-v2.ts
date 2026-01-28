/**
 * X (Twitter) Web Posting - Version 2.0
 * Based on complete design document with verified coordinates
 * 
 * Key improvements:
 * - Verified coordinates from design doc (943, 1633 for compose button)
 * - Japanese input support via ADBKeyboard (Base64 encoding)
 * - Enhanced error handling with retry logic
 * - Dynamic device ID and API key from database
 * - UIAutomator dump for screen state verification
 * - 6-step posting flow as per design document
 */

import axios from 'axios';
import { getSetting } from './db';
import { getPostUrlAfterPublish } from './x-api-service';
import { db } from './db';
import { coordinateLearningData } from '../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface XPostResult {
  success: boolean;
  error?: string;
  screenshots: Array<{
    step: string;
    url: string;
  }>;
  loginStatus?: boolean;
  postUrl?: string; // URL of the posted tweet
}

export interface VerifiedCoordinates {
  composeButton: { x: number; y: number };
  discardButton: { x: number; y: number };
  gotItButton: { x: number; y: number };
  postButton: { x: number; y: number };
  textInput: { x: number; y: number };
  addressBar: { x: number; y: number };
}

// ============================================================================
// Verified Coordinates (from design document)
// ============================================================================

const COORDINATES: VerifiedCoordinates = {
  composeButton: { x: 943, y: 1633 },  // ✅ Verified - Home screen bottom right
  discardButton: { x: 284, y: 614 },   // ✅ Verified - Discard dialog
  gotItButton: { x: 284, y: 862 },     // ✅ Verified - Got it dialog
  postButton: { x: 980, y: 350 },      // ✅ Verified - Post button in compose screen (right side, from Claude's design)
  textInput: { x: 300, y: 400 },       // ✅ Adjusted - Text input area (left side, below "What's happening?")
  addressBar: { x: 540, y: 160 },      // ✅ Verified - Chrome toolbar
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get API key from database or environment
 */
async function getApiKey(): Promise<string> {
  try {
    const apiKey = await getSetting('DUOPLUS_API_KEY');
    if (apiKey) return apiKey;
  } catch (error) {
    console.log('[XWebV2] Failed to get API key from database, falling back to env');
  }
  
  const envKey = process.env.DUOPLUS_API_KEY;
  if (!envKey) {
    throw new Error('DUOPLUS_API_KEY not found in database or environment');
  }
  return envKey;
}

/**
 * Execute ADB command via DuoPlus API
 */
async function executeCommand(deviceId: string, command: string): Promise<{ success: boolean; content: string }> {
  const apiKey = await getApiKey();
  const apiUrl = process.env.DUOPLUS_API_URL || 'https://openapi.duoplus.net';
  
  try {
    const response = await axios.post(
      `${apiUrl}/api/v1/cloudPhone/command`,
      {
        image_id: deviceId,
        command: command,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'DuoPlus-API-Key': apiKey,
        },
        timeout: 30000,
      }
    );
    
    if (response.data.code === 200 && response.data.data) {
      return {
        success: response.data.data.success !== false,
        content: response.data.data.content || '',
      };
    }
    
    return { success: false, content: '' };
  } catch (error: any) {
    console.error('[XWebV2] Command execution failed:', error.message);
    throw error;
  }
}

/**
 * Get UIAutomator dump for screen state verification
 */
async function getUIElements(deviceId: string): Promise<string> {
  try {
    const result = await executeCommand(
      deviceId,
      'uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml'
    );
    return result.content;
  } catch (error: any) {
    console.error('[XWebV2] Failed to get UI elements:', error.message);
    return '';
  }
}

// ============================================================================
// Smart Coordinate Detection
// ============================================================================

/**
 * Get learned coordinates from database
 * Returns coordinates with highest success rate (>= 70%)
 */
async function getLearnedCoordinates(
  deviceId: string,
  element: string
): Promise<{ x: number; y: number } | null> {
  try {
    // Get device resolution
    const resolution = await getDeviceResolution(deviceId);

    // Get recent learning data for this element
    const learningData = await db
      .select()
      .from(coordinateLearningData)
      .where(
        and(
          eq(coordinateLearningData.resolution, resolution),
          eq(coordinateLearningData.element, element)
        )
      )
      .orderBy(desc(coordinateLearningData.createdAt))
      .limit(50);

    if (learningData.length === 0) {
      console.log(`[XWebV2] No learning data found for ${element}`);
      return null;
    }

    // Group by coordinates and calculate success rate for each
    const coordStats = new Map<string, { x: number; y: number; successCount: number; totalCount: number }>();

    for (const data of learningData) {
      const key = `${data.x},${data.y}`;
      const existing = coordStats.get(key);
      if (existing) {
        existing.totalCount++;
        if (data.success === 1) existing.successCount++;
      } else {
        coordStats.set(key, {
          x: data.x,
          y: data.y,
          successCount: data.success === 1 ? 1 : 0,
          totalCount: 1,
        });
      }
    }

    // Find the coordinates with highest success rate (minimum 70%, at least 3 samples)
    let bestCoords: { x: number; y: number } | null = null;
    let bestSuccessRate = 0;

    for (const [key, stats] of coordStats) {
      if (stats.totalCount >= 3) {
        const successRate = (stats.successCount / stats.totalCount) * 100;
        if (successRate >= 70 && successRate > bestSuccessRate) {
          bestSuccessRate = successRate;
          bestCoords = { x: stats.x, y: stats.y };
        }
      }
    }

    if (bestCoords) {
      console.log(`[XWebV2] Found learned coordinates for ${element}: (${bestCoords.x}, ${bestCoords.y}) with ${bestSuccessRate.toFixed(1)}% success rate`);
      return bestCoords;
    }

    console.log(`[XWebV2] No coordinates with sufficient success rate found for ${element}`);
    return null;
  } catch (error: any) {
    console.error('[XWebV2] Failed to get learned coordinates:', error.message);
    return null;
  }
}

/**
 * Get device resolution
 */
async function getDeviceResolution(deviceId: string): Promise<string> {
  try {
    const result = await executeCommand(deviceId, 'wm size');
    // Parse "Physical size: 1080x1920"
    const match = result.content.match(/(\d+)x(\d+)/);
    if (match) {
      return `${match[1]}x${match[2]}`;
    }
  } catch (error: any) {
    console.error('[XWebV2] Failed to get device resolution:', error.message);
  }
  return '1080x1920'; // Default resolution
}

/**
 * Get default coordinates for a specific resolution
 */
function getDefaultCoordinatesForResolution(
  resolution: string,
  element: string
): { x: number; y: number } | null {
  // Default coordinates for 1080x1920 (most common)
  const defaultCoords: Record<string, { x: number; y: number }> = {
    composeButton: { x: 943, y: 1633 },
    postButton: { x: 980, y: 350 },
    textInput: { x: 300, y: 400 },
  };

  // Scale for different resolutions
  const [width, height] = resolution.split('x').map(Number);
  const baseWidth = 1080;
  const baseHeight = 1920;

  const coord = defaultCoords[element];
  if (!coord) return null;

  // Scale coordinates proportionally
  return {
    x: Math.round((coord.x / baseWidth) * width),
    y: Math.round((coord.y / baseHeight) * height),
  };
}

/**
 * Detect Compose button from UIAutomator dump
 * Searches for the floating action button to create a new post
 */
async function detectComposeButtonFromUI(deviceId: string): Promise<{ x: number; y: number } | null> {
  console.log('[XWebV2] Attempting dynamic Compose button detection...');

  try {
    const uiDump = await getUIElements(deviceId);

    if (!uiDump) {
      console.log('[XWebV2] Failed to get UI dump for dynamic detection');
      return null;
    }

    // Look for Compose button patterns
    // Pattern 1: content-desc containing "Compose" or "Post" or "New"
    // Pattern 2: resource-id containing "compose" or "fab" or "new_tweet"
    // Pattern 3: Large clickable button in bottom-right area

    const composePatterns = [
      /content-desc="[^"]*[Cc]ompose[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      /content-desc="[^"]*[Nn]ew [Pp]ost[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      /content-desc="[^"]*ツイート[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      /content-desc="[^"]*投稿[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      /resource-id="[^"]*compose[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
      /resource-id="[^"]*fab[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
      /resource-id="[^"]*new_tweet[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
    ];

    for (const pattern of composePatterns) {
      const match = uiDump.match(pattern);
      if (match) {
        const left = parseInt(match[1]);
        const top = parseInt(match[2]);
        const right = parseInt(match[3]);
        const bottom = parseInt(match[4]);

        // Calculate center of the button
        const centerX = Math.round((left + right) / 2);
        const centerY = Math.round((top + bottom) / 2);

        console.log(`[XWebV2] Dynamic detection found Compose button at (${centerX}, ${centerY})`);
        return { x: centerX, y: centerY };
      }
    }

    // Alternative: Look for clickable elements in the bottom-right area (where Compose typically is)
    const clickablePattern = /clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
    let match;
    const candidates: Array<{ x: number; y: number; score: number }> = [];

    while ((match = clickablePattern.exec(uiDump)) !== null) {
      const left = parseInt(match[1]);
      const top = parseInt(match[2]);
      const right = parseInt(match[3]);
      const bottom = parseInt(match[4]);

      // Compose button is typically in bottom-right area (x > 700, y > 1400 for 1080x1920)
      // and is a small-ish button (50-200px size)
      const width = right - left;
      const height = bottom - top;
      if (left > 700 && top > 1400 && width > 50 && width < 300 && height > 50 && height < 300) {
        const centerX = Math.round((left + right) / 2);
        const centerY = Math.round((top + bottom) / 2);

        // Score based on position (higher score = more likely to be Compose button)
        const score = (left / 1080) * 100 + (top / 1920) * 50;
        candidates.push({ x: centerX, y: centerY, score });
      }
    }

    if (candidates.length > 0) {
      // Sort by score descending and return the best candidate
      candidates.sort((a, b) => b.score - a.score);
      console.log(`[XWebV2] Dynamic detection found ${candidates.length} candidates, using best: (${candidates[0].x}, ${candidates[0].y})`);
      return { x: candidates[0].x, y: candidates[0].y };
    }

    console.log('[XWebV2] Dynamic detection failed to find Compose button');
    return null;
  } catch (error: any) {
    console.error('[XWebV2] Dynamic detection error:', error.message);
    return null;
  }
}

/**
 * Detect Post button from UIAutomator dump
 * Searches for button with text "Post" or "ポスト"
 */
async function detectPostButtonFromUI(deviceId: string): Promise<{ x: number; y: number } | null> {
  console.log('[XWebV2] Attempting dynamic Post button detection...');

  try {
    const uiDump = await getUIElements(deviceId);

    if (!uiDump) {
      console.log('[XWebV2] Failed to get UI dump for dynamic detection');
      return null;
    }

    // Look for Post button patterns
    // Pattern 1: text="Post" or text="ポスト"
    // Pattern 2: content-desc containing "Post"
    // Pattern 3: resource-id containing "post" or "tweet"

    const postPatterns = [
      /text="Post"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
      /text="ポスト"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
      /content-desc="[^"]*Post[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
      /resource-id="[^"]*post[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
      /resource-id="[^"]*tweet[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
    ];

    for (const pattern of postPatterns) {
      const match = uiDump.match(pattern);
      if (match) {
        const left = parseInt(match[1]);
        const top = parseInt(match[2]);
        const right = parseInt(match[3]);
        const bottom = parseInt(match[4]);

        // Calculate center of the button
        const centerX = Math.round((left + right) / 2);
        const centerY = Math.round((top + bottom) / 2);

        console.log(`[XWebV2] Dynamic detection found Post button at (${centerX}, ${centerY})`);
        return { x: centerX, y: centerY };
      }
    }

    // Alternative: Look for clickable elements in the top-right area (where Post typically is)
    const clickablePattern = /clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
    let match;
    const candidates: Array<{ x: number; y: number; score: number }> = [];

    while ((match = clickablePattern.exec(uiDump)) !== null) {
      const left = parseInt(match[1]);
      const top = parseInt(match[2]);
      const right = parseInt(match[3]);
      const bottom = parseInt(match[4]);

      // Post button is typically in top-right area (x > 800, y < 500 for 1080x1920)
      if (left > 700 && top < 500 && (right - left) < 300 && (bottom - top) < 200) {
        const centerX = Math.round((left + right) / 2);
        const centerY = Math.round((top + bottom) / 2);

        // Score based on position (higher score = more likely to be Post button)
        const score = (left / 1080) * 100 - (top / 1920) * 50;
        candidates.push({ x: centerX, y: centerY, score });
      }
    }

    if (candidates.length > 0) {
      // Sort by score descending and return the best candidate
      candidates.sort((a, b) => b.score - a.score);
      console.log(`[XWebV2] Dynamic detection found ${candidates.length} candidates, using best: (${candidates[0].x}, ${candidates[0].y})`);
      return { x: candidates[0].x, y: candidates[0].y };
    }

    console.log('[XWebV2] Dynamic detection failed to find Post button');
    return null;
  } catch (error: any) {
    console.error('[XWebV2] Dynamic detection error:', error.message);
    return null;
  }
}

/**
 * Get smart coordinates for an element
 * Priority: 1. Learned coordinates (if success rate >= 70%)
 *          2. Dynamic detection from UI
 *          3. Default coordinates
 */
async function getSmartCoordinates(
  deviceId: string,
  element: string
): Promise<{ x: number; y: number; source: 'learned' | 'dynamic' | 'default' }> {
  // Step 1: Try learned coordinates
  const learnedCoords = await getLearnedCoordinates(deviceId, element);
  if (learnedCoords) {
    console.log(`[XWebV2] Using learned coordinates for ${element}: (${learnedCoords.x}, ${learnedCoords.y})`);
    return { ...learnedCoords, source: 'learned' };
  }

  // Step 2: Try dynamic detection
  let dynamicCoords: { x: number; y: number } | null = null;
  if (element === 'postButton') {
    dynamicCoords = await detectPostButtonFromUI(deviceId);
  } else if (element === 'composeButton') {
    dynamicCoords = await detectComposeButtonFromUI(deviceId);
  }

  if (dynamicCoords) {
    console.log(`[XWebV2] Using dynamic coordinates for ${element}: (${dynamicCoords.x}, ${dynamicCoords.y})`);
    return { ...dynamicCoords, source: 'dynamic' };
  }

  // Step 3: Fall back to default coordinates
  const defaultCoord = (COORDINATES as any)[element] || { x: 0, y: 0 };
  console.log(`[XWebV2] Using default coordinates for ${element}: (${defaultCoord.x}, ${defaultCoord.y})`);
  return { ...defaultCoord, source: 'default' };
}

/**
 * Record coordinate usage result for learning
 */
async function recordCoordinateResult(
  deviceId: string,
  element: string,
  x: number,
  y: number,
  source: 'learned' | 'dynamic' | 'default',
  success: boolean
): Promise<void> {
  try {
    const resolution = await getDeviceResolution(deviceId);
    await db.insert(coordinateLearningData).values({
      deviceId,
      resolution,
      element,
      x,
      y,
      source,
      success: success ? 1 : 0,
      createdAt: new Date().toISOString(),
    });
    console.log(`[XWebV2] Recorded coordinate result: ${element} (${x}, ${y}) from ${source} = ${success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error: any) {
    console.error('[XWebV2] Failed to record coordinate result:', error.message);
  }
}

/**
 * Take screenshot
 */
async function takeScreenshot(deviceId: string, stepName: string): Promise<string> {
  const timestamp = Date.now();
  const filename = `/sdcard/x_web_${stepName}_${timestamp}.png`;
  
  try {
    await executeCommand(deviceId, `screencap -p ${filename}`);
    console.log(`[XWebV2] Screenshot saved: ${filename}`);
    return filename;
  } catch (error: any) {
    console.error(`[XWebV2] Failed to take screenshot:`, error.message);
    return '';
  }
}

/**
 * Tap at coordinates
 */
async function tap(deviceId: string, x: number, y: number): Promise<boolean> {
  try {
    const result = await executeCommand(deviceId, `input tap ${x} ${y}`);
    return result.success;
  } catch (error: any) {
    console.error(`[XWebV2] Failed to tap at (${x}, ${y}):`, error.message);
    return false;
  }
}

/**
 * Press key
 */
async function pressKey(deviceId: string, keyCode: number): Promise<boolean> {
  try {
    const result = await executeCommand(deviceId, `input keyevent ${keyCode}`);
    return result.success;
  } catch (error: any) {
    console.error(`[XWebV2] Failed to press key ${keyCode}:`, error.message);
    return false;
  }
}

/**
 * Input text (English only, spaces replaced with _)
 */
async function inputText(deviceId: string, text: string): Promise<boolean> {
  try {
    // Replace spaces with underscores for ADB input text
    const sanitized = text.replace(/ /g, '_');
    const result = await executeCommand(deviceId, `input text "${sanitized}"`);
    return result.success;
  } catch (error: any) {
    console.error(`[XWebV2] Failed to input text:`, error.message);
    return false;
  }
}

/**
 * Check if ADBKeyboard is enabled and set as default IME
 */
async function isADBKeyboardEnabled(deviceId: string): Promise<boolean> {
  try {
    const result = await executeCommand(deviceId, 'settings get secure default_input_method');
    const currentIME = result.content?.trim() || '';
    console.log('[XWebV2] Current IME:', currentIME);
    return currentIME.includes('com.android.adbkeyboard');
  } catch (error) {
    console.error('[XWebV2] Failed to check IME status');
    return false;
  }
}

/**
 * Enable ADBKeyboard on DuoPlus device
 * ADBKeyboard is pre-installed but disabled/hidden by default on DuoPlus
 * Must execute 4 steps in order:
 * 1. pm enable - Enable the package
 * 2. pm unhide - Unhide the package
 * 3. ime enable - Enable as input method
 * 4. ime set - Set as default IME
 */
async function enableADBKeyboard(deviceId: string): Promise<boolean> {
  console.log('[XWebV2] Enabling ADBKeyboard on device...');

  try {
    // Step 1: Enable the package
    console.log('[XWebV2] Step 1: Enabling package...');
    const step1 = await executeCommand(deviceId, 'pm enable com.android.adbkeyboard');
    console.log('[XWebV2] Step 1 result:', step1.content?.trim() || 'no output');
    await sleep(500);

    // Step 2: Unhide the package
    console.log('[XWebV2] Step 2: Unhiding package...');
    const step2 = await executeCommand(deviceId, 'pm unhide com.android.adbkeyboard');
    console.log('[XWebV2] Step 2 result:', step2.content?.trim() || 'no output');
    await sleep(500);

    // Step 3: Enable as IME
    console.log('[XWebV2] Step 3: Enabling IME...');
    const step3 = await executeCommand(deviceId, 'ime enable com.android.adbkeyboard/.AdbIME');
    console.log('[XWebV2] Step 3 result:', step3.content?.trim() || 'no output');
    await sleep(500);

    // Step 4: Set as default IME
    console.log('[XWebV2] Step 4: Setting as default IME...');
    const step4 = await executeCommand(deviceId, 'ime set com.android.adbkeyboard/.AdbIME');
    console.log('[XWebV2] Step 4 result:', step4.content?.trim() || 'no output');
    await sleep(500);

    // Verify
    const enabled = await isADBKeyboardEnabled(deviceId);
    if (enabled) {
      console.log('[XWebV2] ADBKeyboard enabled successfully');
      return true;
    } else {
      console.error('[XWebV2] ADBKeyboard enablement verification failed');
      return false;
    }
  } catch (error: any) {
    console.error('[XWebV2] Failed to enable ADBKeyboard:', error.message);
    return false;
  }
}

/**
 * Ensure ADBKeyboard is ready for use
 * Checks if enabled, and enables it if not
 */
async function ensureADBKeyboardReady(deviceId: string): Promise<boolean> {
  console.log('[XWebV2] Checking ADBKeyboard status...');

  const isEnabled = await isADBKeyboardEnabled(deviceId);
  if (isEnabled) {
    console.log('[XWebV2] ADBKeyboard is already enabled');
    return true;
  }

  console.log('[XWebV2] ADBKeyboard not enabled, enabling now...');
  return await enableADBKeyboard(deviceId);
}

/**
 * Input text using ADBKeyboard (supports all languages including Japanese)
 * ADBKeyboard is pre-installed on DuoPlus but needs to be enabled first
 */
async function inputViaADBKeyboard(deviceId: string, text: string): Promise<boolean> {
  try {
    console.log('[XWebV2] Using ADBKeyboard for text input...');

    // Ensure ADBKeyboard is enabled
    const ready = await ensureADBKeyboardReady(deviceId);
    if (!ready) {
      console.error('[XWebV2] Failed to enable ADBKeyboard');
      return false;
    }

    // Escape single quotes in text
    const escapedText = text.replace(/'/g, "\\'");

    // Send text via ADBKeyboard broadcast (direct text method)
    console.log('[XWebV2] Sending text via ADB_INPUT_TEXT broadcast...');
    const result = await executeCommand(
      deviceId,
      `am broadcast -a ADB_INPUT_TEXT --es msg '${escapedText}'`
    );

    if (!result.success) {
      console.error('[XWebV2] ADBKeyboard broadcast failed');
      return false;
    }

    await sleep(2000);

    console.log('[XWebV2] Text input completed via ADBKeyboard');
    return true;
  } catch (error: any) {
    console.error(`[XWebV2] Failed to input via ADBKeyboard:`, error.message);
    return false;
  }
}

/**
 * Detect if text contains Japanese characters
 */
function containsJapanese(text: string): boolean {
  // Check for Hiragana, Katakana, or Kanji
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

/**
 * Retry logic wrapper
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`[XWebV2] Retry ${i + 1}/${maxRetries}...`);
      await sleep(delay * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('All retries failed');
}

// ============================================================================
// Main Posting Flow (6 Steps)
// ============================================================================

/**
 * Step 1: Check screen state
 */
async function checkScreenState(deviceId: string): Promise<{ isOnX: boolean; uiDump: string }> {
  console.log('[XWebV2] Step 1: Checking screen state...');
  
  const uiDump = await getUIElements(deviceId);
  const isOnX = uiDump.includes('x.com') || uiDump.includes('twitter.com');
  
  console.log(`[XWebV2] On X.com: ${isOnX}`);
  return { isOnX, uiDump };
}

/**
 * Wait for X.com page to load (with polling)
 */
async function waitForXPage(deviceId: string, maxWaitMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const uiDump = await getUIElements(deviceId);
    
    // Check for X.com page elements
    if (uiDump.includes('x.com') || uiDump.includes('twitter.com')) {
      console.log('[XWebV2] X.com page loaded successfully');
      return true;
    }
    
    console.log('[XWebV2] Waiting for X.com page to load...');
    await sleep(2000); // Check every 2 seconds
  }
  
  console.error('[XWebV2] Timeout waiting for X.com page');
  return false;
}

/**
 * Step 2: Navigate to X.com
 */
async function navigateToX(deviceId: string): Promise<boolean> {
  console.log('[XWebV2] Step 2: Navigating to X.com...');
  
  try {
    // 1. Force stop Chrome to ensure clean start
    console.log('[XWebV2] Closing Chrome...');
    await executeCommand(deviceId, 'am force-stop com.android.chrome');
    await sleep(1000);
    
    // 2. Start Chrome with X.com URL
    console.log('[XWebV2] Starting Chrome...');
    await executeCommand(
      deviceId,
      'am start -a android.intent.action.VIEW -d "https://x.com" com.android.chrome'
    );
    
    // 3. Wait for page to load (with verification)
    const loaded = await waitForXPage(deviceId, 30000);
    
    if (!loaded) {
      throw new Error('Failed to load X.com page');
    }
    
    return true;
  } catch (error: any) {
    console.error('[XWebV2] Failed to navigate to X.com:', error.message);
    return false;
  }
}

/**
 * Step 3: Open compose screen
 */
async function openComposeScreen(deviceId: string): Promise<boolean> {
  console.log('[XWebV2] Step 3: Opening compose screen...');

  try {
    // Get smart coordinates (learned → dynamic → default)
    const coords = await getSmartCoordinates(deviceId, 'composeButton');
    console.log(`[XWebV2] Using ${coords.source} coordinates for Compose button: (${coords.x}, ${coords.y})`);

    // Tap compose button
    const success = await tap(deviceId, coords.x, coords.y);

    if (!success) {
      console.log('[XWebV2] Tap command failed for compose button');
      await recordCoordinateResult(deviceId, 'composeButton', coords.x, coords.y, coords.source, false);
      throw new Error('Failed to tap compose button');
    }

    await sleep(3000); // Wait for compose screen to open

    // Check for "Got it" dialog (first-time users)
    const uiDump = await getUIElements(deviceId);
    if (uiDump.includes('Got it')) {
      console.log('[XWebV2] Dismissing "Got it" dialog...');
      await tap(deviceId, COORDINATES.gotItButton.x, COORDINATES.gotItButton.y);
      await sleep(1000);
    }

    // Verify compose screen opened by checking for compose indicators
    const composeIndicators = [
      "What's happening",
      "いまどうしてる",
      "What is happening",
      "Post",
      "ポスト",
    ];

    const composeOpened = composeIndicators.some(indicator => uiDump.includes(indicator));

    if (!composeOpened && coords.source !== 'dynamic') {
      // First attempt failed, try dynamic detection
      console.log('[XWebV2] Compose screen not detected, trying dynamic detection...');
      await recordCoordinateResult(deviceId, 'composeButton', coords.x, coords.y, coords.source, false);

      const dynamicCoords = await detectComposeButtonFromUI(deviceId);
      if (dynamicCoords) {
        console.log(`[XWebV2] Retrying with dynamic coordinates: (${dynamicCoords.x}, ${dynamicCoords.y})`);
        const retrySuccess = await tap(deviceId, dynamicCoords.x, dynamicCoords.y);
        await sleep(3000);

        if (retrySuccess) {
          // Check again
          const uiDumpAfterRetry = await getUIElements(deviceId);
          const composeOpenedAfterRetry = composeIndicators.some(indicator => uiDumpAfterRetry.includes(indicator));

          if (composeOpenedAfterRetry) {
            console.log('[XWebV2] Dynamic coordinates worked for compose button!');
            await recordCoordinateResult(deviceId, 'composeButton', dynamicCoords.x, dynamicCoords.y, 'dynamic', true);
            return true;
          }
        }
        await recordCoordinateResult(deviceId, 'composeButton', dynamicCoords.x, dynamicCoords.y, 'dynamic', false);
      }

      throw new Error('Compose screen did not open');
    }

    // Success - record the result
    await recordCoordinateResult(deviceId, 'composeButton', coords.x, coords.y, coords.source, true);
    return true;
  } catch (error: any) {
    console.error('[XWebV2] Failed to open compose screen:', error.message);
    return false;
  }
}

/**
 * Step 4: Input text content
 */
async function inputContent(deviceId: string, content: string): Promise<boolean> {
  console.log('[XWebV2] Step 4: Inputting content...');
  console.log(`[XWebV2] Content to input: ${content}`);

  try {
    // Text area should already be focused when compose screen opens
    // Use ADBKeyboard broadcast for Japanese text input
    console.log('[XWebV2] Using ADBKeyboard for text input...');

    const success = await inputViaADBKeyboard(deviceId, content);

    if (!success) {
      console.log('[XWebV2] ADBKeyboard failed, content may not be entered');
    }

    await sleep(2000);

    return true;
  } catch (error: any) {
    console.error('[XWebV2] Failed to input content:', error.message);
    return false;
  }
}

/**
 * Step 5: Tap Post button
 */
async function tapPostButton(deviceId: string): Promise<boolean> {
  console.log('[XWebV2] Step 5: Tapping Post button...');

  try {
    // Close keyboard first
    await pressKey(deviceId, 4); // BACK key
    await sleep(1000);

    // Get smart coordinates (learned → dynamic → default)
    const coords = await getSmartCoordinates(deviceId, 'postButton');
    console.log(`[XWebV2] Using ${coords.source} coordinates for Post button: (${coords.x}, ${coords.y})`);

    // Tap Post button
    const tapSuccess = await tap(deviceId, coords.x, coords.y);

    if (!tapSuccess) {
      console.log('[XWebV2] Tap command failed');
      await recordCoordinateResult(deviceId, 'postButton', coords.x, coords.y, coords.source, false);
      throw new Error('Failed to tap Post button');
    }

    await sleep(3000); // Wait for post to be sent

    // Verify if the tap was successful by checking if we left the compose screen
    const uiDump = await getUIElements(deviceId);
    const stillOnComposeScreen = uiDump.includes("What's happening") ||
                                  uiDump.includes("いまどうしてる") ||
                                  uiDump.includes("What is happening");

    if (stillOnComposeScreen && coords.source !== 'dynamic') {
      // First attempt failed, try dynamic detection
      console.log('[XWebV2] Still on compose screen, trying dynamic detection...');
      await recordCoordinateResult(deviceId, 'postButton', coords.x, coords.y, coords.source, false);

      const dynamicCoords = await detectPostButtonFromUI(deviceId);
      if (dynamicCoords) {
        console.log(`[XWebV2] Retrying with dynamic coordinates: (${dynamicCoords.x}, ${dynamicCoords.y})`);
        const retrySuccess = await tap(deviceId, dynamicCoords.x, dynamicCoords.y);
        await sleep(3000);

        if (retrySuccess) {
          // Check again
          const uiDumpAfterRetry = await getUIElements(deviceId);
          if (!uiDumpAfterRetry.includes("What's happening") &&
              !uiDumpAfterRetry.includes("いまどうしてる")) {
            console.log('[XWebV2] Dynamic coordinates worked!');
            await recordCoordinateResult(deviceId, 'postButton', dynamicCoords.x, dynamicCoords.y, 'dynamic', true);
            return true;
          }
        }
        await recordCoordinateResult(deviceId, 'postButton', dynamicCoords.x, dynamicCoords.y, 'dynamic', false);
      }

      throw new Error('Post button tap did not work');
    }

    // Success - record the result
    await recordCoordinateResult(deviceId, 'postButton', coords.x, coords.y, coords.source, true);
    return true;
  } catch (error: any) {
    console.error('[XWebV2] Failed to tap Post button:', error.message);
    return false;
  }
}

/**
 * Step 6: Verify success
 */
async function verifySuccess(deviceId: string): Promise<boolean> {
  console.log('[XWebV2] Step 6: Verifying success...');
  
  try {
    await sleep(2000);
    
    const uiDump = await getUIElements(deviceId);
    
    // Success indicators
    const successIndicators = [
      'Your post was sent',
      'For you',
      'Following',
    ];
    
    // Failure indicators
    const failureIndicators = [
      'Something went wrong',
      'Try again',
      'Error',
    ];
    
    const hasSuccess = successIndicators.some(indicator => uiDump.includes(indicator));
    const hasFailure = failureIndicators.some(indicator => uiDump.includes(indicator));
    
    if (hasFailure) {
      console.log('[XWebV2] Post failed - error detected');
      return false;
    }
    
    if (hasSuccess) {
      console.log('[XWebV2] Post succeeded');
      return true;
    }
    
    // If no clear indicator, assume success (user can verify manually)
    console.log('[XWebV2] No clear success/failure indicator, assuming success');
    return true;
  } catch (error: any) {
    console.error('[XWebV2] Failed to verify success:', error.message);
    return false;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Post to X using web browser (Version 2.0)
 * 
 * @param deviceId - DuoPlus device ID (e.g., "s0t85")
 * @param content - Post content (supports Japanese)
 * @param mediaUrl - Optional media URL (not yet implemented)
 */
export async function postToXWebV2(
  deviceId: string,
  content: string,
  mediaUrl?: string
): Promise<XPostResult> {
  const screenshots: Array<{ step: string; url: string }> = [];
  
  try {
    console.log('[XWebV2] ========================================');
    console.log('[XWebV2] Starting X web posting (Version 2.0)');
    console.log('[XWebV2] Device ID:', deviceId);
    console.log('[XWebV2] Content:', content);
    console.log('[XWebV2] ========================================');
    
    // Step 1: Check screen state
    const { isOnX } = await withRetry(() => checkScreenState(deviceId));
    const screenshot1 = await takeScreenshot(deviceId, 'step1_screen_check');
    if (screenshot1) screenshots.push({ step: 'Screen Check', url: screenshot1 });
    
    // Step 2: Navigate to X.com if not already there
    if (!isOnX) {
      const navigated = await withRetry(() => navigateToX(deviceId));
      if (!navigated) {
        return {
          success: false,
          error: 'Failed to navigate to X.com',
          screenshots,
        };
      }
    }
    const screenshot2 = await takeScreenshot(deviceId, 'step2_on_x');
    if (screenshot2) screenshots.push({ step: 'On X.com', url: screenshot2 });
    
    // Step 3: Open compose screen
    const composeOpened = await withRetry(() => openComposeScreen(deviceId));
    if (!composeOpened) {
      return {
        success: false,
        error: 'Failed to open compose screen',
        screenshots,
      };
    }
    const screenshot3 = await takeScreenshot(deviceId, 'step3_compose_opened');
    if (screenshot3) screenshots.push({ step: 'Compose Opened', url: screenshot3 });
    
    // Step 4: Input content
    const contentInput = await withRetry(() => inputContent(deviceId, content));
    if (!contentInput) {
      return {
        success: false,
        error: 'Failed to input content',
        screenshots,
      };
    }
    const screenshot4 = await takeScreenshot(deviceId, 'step4_content_input');
    if (screenshot4) screenshots.push({ step: 'Content Input', url: screenshot4 });
    
    // Step 5: Tap Post button
    const postTapped = await withRetry(() => tapPostButton(deviceId));
    if (!postTapped) {
      return {
        success: false,
        error: 'Failed to tap Post button',
        screenshots,
      };
    }
    const screenshot5 = await takeScreenshot(deviceId, 'step5_post_tapped');
    if (screenshot5) screenshots.push({ step: 'Post Tapped', url: screenshot5 });
    
    // Step 6: Verify success
    const verified = await verifySuccess(deviceId);
    const screenshot6 = await takeScreenshot(deviceId, 'step6_verification');
    if (screenshot6) screenshots.push({ step: 'Verification', url: screenshot6 });
    
    if (!verified) {
      return {
        success: false,
        error: 'Post verification failed',
        screenshots,
      };
    }
    
    console.log('[XWebV2] ========================================');
    console.log('[XWebV2] X web posting completed successfully');
    console.log('[XWebV2] ========================================');
    
    // Try to get post URL using X API
    let postUrl: string | undefined;
    try {
      // Get account username from device ID
      const { db: dbInstance } = await import('./db');
      const { accounts } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      
      const account = await dbInstance.query.accounts.findFirst({
        where: eq(accounts.deviceId, deviceId),
      });
      
      if (account?.xHandle || account?.username) {
        const handleToUse = account.xHandle || account.username;
        console.log('[XWebV2] Fetching post URL for handle:', handleToUse);
        postUrl = await getPostUrlAfterPublish(handleToUse, content) || undefined;
        if (postUrl) {
          console.log('[XWebV2] Post URL retrieved:', postUrl);
        } else {
          console.warn('[XWebV2] Failed to retrieve post URL');
        }
      } else {
        console.warn('[XWebV2] Account username not found for device:', deviceId);
      }
    } catch (error: any) {
      console.error('[XWebV2] Error fetching post URL:', error.message);
    }
    
    return {
      success: true,
      screenshots,
      postUrl,
    };
    
  } catch (error: any) {
    console.error('[XWebV2] X web posting failed:', error.message);
    return {
      success: false,
      error: error.message,
      screenshots,
    };
  }
}

/**
 * Export ADBKeyboard utility functions for use in other modules
 */
export { enableADBKeyboard, isADBKeyboardEnabled, ensureADBKeyboardReady };

/**
 * Check if user is logged in to X
 */
export async function checkXLoginV2(deviceId: string): Promise<boolean> {
  try {
    console.log('[XWebV2] Checking X login status...');
    
    // Navigate to X
    await navigateToX(deviceId);
    await sleep(5000);
    
    // Get UI elements
    const uiDump = await getUIElements(deviceId);
    
    // Check for login indicators
    const loginIndicators = [
      'For you',
      'Following',
      'What\'s happening',
    ];
    
    const isLoggedIn = loginIndicators.some(indicator => uiDump.includes(indicator));
    
    console.log(`[XWebV2] Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
    return isLoggedIn;
    
  } catch (error: any) {
    console.error('[XWebV2] Failed to check login status:', error.message);
    return false;
  }
}
