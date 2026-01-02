/**
 * X (Twitter) Web Posting - Version 3.0
 * Using Local ADB Connection for Japanese Input
 * 
 * Key improvements:
 * - Local ADB connection bypasses API permission restrictions
 * - Direct Japanese text input via ADBKeyboard
 * - No 10-second timeout limitation
 * - More reliable text input
 */

import * as localADB from './local-adb';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, settings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface XPostResult {
  success: boolean;
  error?: string;
  screenshots: string[];
  loginStatus?: boolean;
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
// Verified Coordinates
// ============================================================================

const COORDINATES: VerifiedCoordinates = {
  composeButton: { x: 943, y: 1633 },
  discardButton: { x: 284, y: 614 },
  gotItButton: { x: 284, y: 862 },
  postButton: { x: 503, y: 171 },
  textInput: { x: 300, y: 400 },
  addressBar: { x: 540, y: 160 },
};

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get account info from database
 */
async function getAccountInfo(accountId: number) {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);
  
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  
  await connection.end();
  
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  
  if (!account.deviceId) {
    throw new Error(`Account ${accountId} has no device ID`);
  }
  
  // Get ADB info from DuoPlus API
  // For now, we'll use the stored ADB info from the device
  // In production, you should query DuoPlus API to get the latest ADB info
  
  return account;
}

/**
 * Get device ADB info from DuoPlus API
 */
async function getDeviceADBInfo(deviceId: string): Promise<string> {
  try {
    // Get API key from database
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    const db = drizzle(connection);
    
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DUOPLUS_API_KEY'))
      .limit(1);
    
    await connection.end();
    
    if (!setting) {
      throw new Error('DuoPlus API key not found in database');
    }
    
    const apiKey = setting.value || '';
    const apiUrl = process.env.DUOPLUS_API_URL || 'https://openapi.duoplus.net';
    
    // Query DuoPlus API to get device list
    const response = await fetch(`${apiUrl}/api/v1/cloudPhone/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DuoPlus-API-Key': apiKey,
      },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    if (data.code !== 200 || !data.data || !data.data.list) {
      throw new Error('Failed to get device list from DuoPlus API');
    }
    
    // Find device by ID
    const device = data.data.list.find((d: any) => d.id === deviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found in DuoPlus`);
    }
    
    if (!device.adb) {
      throw new Error(`Device ${deviceId} has no ADB info`);
    }
    
    console.log(`[XWebV3] Got ADB info for device ${deviceId}: ${device.adb}`);
    return device.adb; // Example: "98.98.125.9:23385"
  } catch (error: any) {
    console.error('[XWebV3] Failed to get device ADB info:', error.message);
    throw error;
  }
}

// ============================================================================
// Main Posting Flow
// ============================================================================

/**
 * Step 1: Connect to device via local ADB
 */
async function connectToDevice(deviceId: string): Promise<localADB.ADBDevice> {
  console.log('[XWebV3] Step 1: Connecting to device via local ADB...');
  
  const adbInfo = await getDeviceADBInfo(deviceId);
  const device = localADB.createADBDevice(adbInfo, deviceId);
  
  const connected = await localADB.connectADB(device);
  
  if (!connected) {
    throw new Error('Failed to connect to device via ADB');
  }
  
  console.log('[XWebV3] Successfully connected to device');
  return device;
}

/**
 * Step 2: Navigate to X.com
 */
async function navigateToX(device: localADB.ADBDevice): Promise<boolean> {
  console.log('[XWebV3] Step 2: Navigating to X.com...');
  
  try {
    // Force stop Chrome
    await localADB.executeADBCommand(device, 'am force-stop com.android.chrome');
    await sleep(1000);
    
    // Start Chrome with X.com URL
    await localADB.executeADBCommand(
      device,
      'am start -a android.intent.action.VIEW -d "https://x.com" com.android.chrome'
    );
    
    await sleep(5000); // Wait for page to load
    
    console.log('[XWebV3] Navigated to X.com');
    return true;
  } catch (error: any) {
    console.error('[XWebV3] Failed to navigate to X.com:', error.message);
    return false;
  }
}

/**
 * Step 3: Open compose screen
 */
async function openComposeScreen(device: localADB.ADBDevice): Promise<boolean> {
  console.log('[XWebV3] Step 3: Opening compose screen...');
  
  try {
    // Tap compose button
    await localADB.tap(device, COORDINATES.composeButton.x, COORDINATES.composeButton.y);
    await sleep(3000);
    
    // Check for "Got it" dialog
    const uiDump = await localADB.executeADBCommand(
      device,
      'uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml'
    );
    
    if (uiDump.output.includes('Got it')) {
      console.log('[XWebV3] Dismissing "Got it" dialog...');
      await localADB.tap(device, COORDINATES.gotItButton.x, COORDINATES.gotItButton.y);
      await sleep(1000);
    }
    
    console.log('[XWebV3] Compose screen opened');
    return true;
  } catch (error: any) {
    console.error('[XWebV3] Failed to open compose screen:', error.message);
    return false;
  }
}

/**
 * Step 4: Input Japanese text content
 */
async function inputContent(device: localADB.ADBDevice, content: string): Promise<boolean> {
  console.log('[XWebV3] Step 4: Inputting content...');
  console.log(`[XWebV3] Content to input: ${content}`);
  
  try {
    // Tap text input area to focus
    await localADB.tap(device, COORDINATES.textInput.x, COORDINATES.textInput.y);
    await sleep(2000);
    
    // Input Japanese text via ADBKeyboard
    const success = await localADB.inputJapaneseText(device, content);
    
    if (!success) {
      throw new Error('Failed to input Japanese text');
    }
    
    await sleep(1000);
    
    console.log('[XWebV3] Content input successful');
    return true;
  } catch (error: any) {
    console.error('[XWebV3] Failed to input content:', error.message);
    return false;
  }
}

/**
 * Step 5: Submit post
 */
async function submitPost(device: localADB.ADBDevice): Promise<boolean> {
  console.log('[XWebV3] Step 5: Submitting post...');
  
  try {
    // Tap post button
    await localADB.tap(device, COORDINATES.postButton.x, COORDINATES.postButton.y);
    await sleep(3000);
    
    console.log('[XWebV3] Post submitted');
    return true;
  } catch (error: any) {
    console.error('[XWebV3] Failed to submit post:', error.message);
    return false;
  }
}

/**
 * Step 6: Verify post success
 */
async function verifyPostSuccess(device: localADB.ADBDevice): Promise<boolean> {
  console.log('[XWebV3] Step 6: Verifying post success...');
  
  try {
    // Check if we're back on the home screen
    const uiDump = await localADB.executeADBCommand(
      device,
      'uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml'
    );
    
    // If compose screen is still open, post failed
    if (uiDump.output.includes("What's happening")) {
      console.error('[XWebV3] Post failed - still on compose screen');
      return false;
    }
    
    console.log('[XWebV3] Post verified successful');
    return true;
  } catch (error: any) {
    console.error('[XWebV3] Failed to verify post:', error.message);
    return false;
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Post to X (Twitter) using local ADB connection
 */
export async function postToXWeb(accountId: number, content: string): Promise<XPostResult> {
  console.log('[XWebV3] Starting X Web posting flow...');
  console.log(`[XWebV3] Account ID: ${accountId}`);
  console.log(`[XWebV3] Content: ${content}`);
  
  const screenshots: string[] = [];
  let device: localADB.ADBDevice | null = null;
  
  try {
    // Get account info
    const account = await getAccountInfo(accountId);
    
    if (!account.deviceId) {
      throw new Error('Account has no device ID');
    }
    
    // Step 1: Connect to device
    device = await connectToDevice(account.deviceId);
    
    // Take initial screenshot
    const screenshot1 = `/tmp/x_post_${Date.now()}_1_initial.png`;
    await localADB.takeScreenshot(device, screenshot1);
    screenshots.push(screenshot1);
    
    // Step 2: Navigate to X.com
    const navigated = await navigateToX(device);
    if (!navigated) {
      throw new Error('Failed to navigate to X.com');
    }
    
    // Take screenshot after navigation
    const screenshot2 = `/tmp/x_post_${Date.now()}_2_navigated.png`;
    await localADB.takeScreenshot(device, screenshot2);
    screenshots.push(screenshot2);
    
    // Step 3: Open compose screen
    const opened = await openComposeScreen(device);
    if (!opened) {
      throw new Error('Failed to open compose screen');
    }
    
    // Take screenshot after opening compose screen
    const screenshot3 = `/tmp/x_post_${Date.now()}_3_compose.png`;
    await localADB.takeScreenshot(device, screenshot3);
    screenshots.push(screenshot3);
    
    // Step 4: Input content
    const inputted = await inputContent(device, content);
    if (!inputted) {
      throw new Error('Failed to input content');
    }
    
    // Take screenshot after input
    const screenshot4 = `/tmp/x_post_${Date.now()}_4_input.png`;
    await localADB.takeScreenshot(device, screenshot4);
    screenshots.push(screenshot4);
    
    // Step 5: Submit post
    const submitted = await submitPost(device);
    if (!submitted) {
      throw new Error('Failed to submit post');
    }
    
    // Take screenshot after submission
    const screenshot5 = `/tmp/x_post_${Date.now()}_5_submitted.png`;
    await localADB.takeScreenshot(device, screenshot5);
    screenshots.push(screenshot5);
    
    // Step 6: Verify success
    const verified = await verifyPostSuccess(device);
    if (!verified) {
      throw new Error('Post verification failed');
    }
    
    // Take final screenshot
    const screenshot6 = `/tmp/x_post_${Date.now()}_6_final.png`;
    await localADB.takeScreenshot(device, screenshot6);
    screenshots.push(screenshot6);
    
    console.log('[XWebV3] X Web posting completed successfully');
    
    return {
      success: true,
      screenshots,
      loginStatus: true,
    };
  } catch (error: any) {
    console.error('[XWebV3] X Web posting failed:', error.message);
    
    // Take error screenshot
    if (device) {
      try {
        const errorScreenshot = `/tmp/x_post_${Date.now()}_error.png`;
        await localADB.takeScreenshot(device, errorScreenshot);
        screenshots.push(errorScreenshot);
      } catch (e) {
        console.error('[XWebV3] Failed to take error screenshot');
      }
    }
    
    return {
      success: false,
      error: error.message,
      screenshots,
    };
  } finally {
    // Disconnect from device
    if (device) {
      await localADB.disconnectADB(device);
    }
  }
}
