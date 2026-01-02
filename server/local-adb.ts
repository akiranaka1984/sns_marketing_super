/**
 * Local ADB Connection Module
 * 
 * This module provides direct ADB connection to DuoPlus devices
 * bypassing the API permission restrictions.
 * 
 * Features:
 * - Direct ADB connection via TCP/IP
 * - Japanese text input support via ADBKeyboard
 * - No API permission required
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ADBDevice {
  host: string;
  port: number;
  deviceId: string;
}

export interface ADBCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Connect to ADB device via TCP/IP
 */
export async function connectADB(device: ADBDevice): Promise<boolean> {
  try {
    const { host, port } = device;
    const { stdout, stderr } = await execAsync(`adb connect ${host}:${port}`);
    
    console.log('[LocalADB] Connect output:', stdout);
    
    if (stderr) {
      console.error('[LocalADB] Connect error:', stderr);
      return false;
    }
    
    // Check if connection was successful
    if (stdout.includes('connected') || stdout.includes('already connected')) {
      console.log(`[LocalADB] Successfully connected to ${host}:${port}`);
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error('[LocalADB] Failed to connect:', error.message);
    return false;
  }
}

/**
 * Disconnect from ADB device
 */
export async function disconnectADB(device: ADBDevice): Promise<boolean> {
  try {
    const { host, port } = device;
    const { stdout } = await execAsync(`adb disconnect ${host}:${port}`);
    
    console.log('[LocalADB] Disconnect output:', stdout);
    return true;
  } catch (error: any) {
    console.error('[LocalADB] Failed to disconnect:', error.message);
    return false;
  }
}

/**
 * Execute ADB command on connected device
 */
export async function executeADBCommand(
  device: ADBDevice,
  command: string
): Promise<ADBCommandResult> {
  try {
    const { host, port } = device;
    const deviceAddress = `${host}:${port}`;
    
    // Execute command with device specification
    const { stdout, stderr } = await execAsync(
      `adb -s ${deviceAddress} shell ${command}`
    );
    
    if (stderr && !stderr.includes('WARNING')) {
      console.error('[LocalADB] Command error:', stderr);
      return {
        success: false,
        output: stdout,
        error: stderr,
      };
    }
    
    return {
      success: true,
      output: stdout,
    };
  } catch (error: any) {
    console.error('[LocalADB] Failed to execute command:', error.message);
    return {
      success: false,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Check if ADBKeyboard is installed
 */
export async function checkADBKeyboard(device: ADBDevice): Promise<boolean> {
  const result = await executeADBCommand(
    device,
    'pm list packages | grep com.android.adbkeyboard'
  );
  
  return result.success && result.output.includes('com.android.adbkeyboard');
}

/**
 * Install ADBKeyboard APK
 */
export async function installADBKeyboard(device: ADBDevice): Promise<boolean> {
  try {
    const { host, port } = device;
    const deviceAddress = `${host}:${port}`;
    
    // Download ADBKeyboard APK
    console.log('[LocalADB] Downloading ADBKeyboard APK...');
    await execAsync(
      'curl -L -o /tmp/ADBKeyboard.apk https://github.com/senzhk/ADBKeyBoard/releases/download/v2.0/ADBKeyboard.apk'
    );
    
    // Install APK
    console.log('[LocalADB] Installing ADBKeyboard...');
    const { stdout, stderr } = await execAsync(
      `adb -s ${deviceAddress} install -r /tmp/ADBKeyboard.apk`
    );
    
    console.log('[LocalADB] Install output:', stdout);
    
    if (stderr) {
      console.error('[LocalADB] Install error:', stderr);
    }
    
    // Enable ADBKeyboard
    await executeADBCommand(
      device,
      'ime enable com.android.adbkeyboard/.AdbIME'
    );
    
    await executeADBCommand(
      device,
      'ime set com.android.adbkeyboard/.AdbIME'
    );
    
    console.log('[LocalADB] ADBKeyboard installed and enabled');
    return true;
  } catch (error: any) {
    console.error('[LocalADB] Failed to install ADBKeyboard:', error.message);
    return false;
  }
}

/**
 * Input Japanese text using ADBKeyboard
 */
export async function inputJapaneseText(
  device: ADBDevice,
  text: string
): Promise<boolean> {
  try {
    // Check if ADBKeyboard is installed
    const hasKeyboard = await checkADBKeyboard(device);
    
    if (!hasKeyboard) {
      console.log('[LocalADB] ADBKeyboard not found, installing...');
      const installed = await installADBKeyboard(device);
      
      if (!installed) {
        console.error('[LocalADB] Failed to install ADBKeyboard');
        return false;
      }
    }
    
    // Encode text to Base64
    const base64Text = Buffer.from(text, 'utf-8').toString('base64');
    
    // Send text via ADBKeyboard
    const result = await executeADBCommand(
      device,
      `am broadcast -a ADB_INPUT_B64 --es msg ${base64Text}`
    );
    
    if (!result.success) {
      console.error('[LocalADB] Failed to input text:', result.error);
      return false;
    }
    
    console.log('[LocalADB] Successfully input Japanese text');
    return true;
  } catch (error: any) {
    console.error('[LocalADB] Failed to input Japanese text:', error.message);
    return false;
  }
}

/**
 * Tap at coordinates
 */
export async function tap(
  device: ADBDevice,
  x: number,
  y: number
): Promise<boolean> {
  const result = await executeADBCommand(device, `input tap ${x} ${y}`);
  return result.success;
}

/**
 * Press key
 */
export async function pressKey(
  device: ADBDevice,
  keyCode: number
): Promise<boolean> {
  const result = await executeADBCommand(device, `input keyevent ${keyCode}`);
  return result.success;
}

/**
 * Take screenshot
 */
export async function takeScreenshot(
  device: ADBDevice,
  localPath: string
): Promise<boolean> {
  try {
    const { host, port } = device;
    const deviceAddress = `${host}:${port}`;
    const remotePath = '/sdcard/screenshot.png';
    
    // Take screenshot on device
    await executeADBCommand(device, `screencap -p ${remotePath}`);
    
    // Pull screenshot to local
    await execAsync(`adb -s ${deviceAddress} pull ${remotePath} ${localPath}`);
    
    console.log(`[LocalADB] Screenshot saved to ${localPath}`);
    return true;
  } catch (error: any) {
    console.error('[LocalADB] Failed to take screenshot:', error.message);
    return false;
  }
}

/**
 * Get device info from database and create ADBDevice object
 */
export function createADBDevice(adbInfo: string, deviceId: string): ADBDevice {
  // Parse ADB info: "98.98.125.9:23385"
  const [host, portStr] = adbInfo.split(':');
  const port = parseInt(portStr, 10);
  
  return {
    host,
    port,
    deviceId,
  };
}
