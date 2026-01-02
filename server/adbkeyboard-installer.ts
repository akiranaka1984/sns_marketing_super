/**
 * ADBKeyboard Installer
 * Automatically installs ADBKeyboard APK on Android devices
 */

import axios from 'axios';
import { getSetting } from './db';

/**
 * Execute ADB command via DuoPlus API
 */
async function executeCommand(deviceId: string, command: string): Promise<{ success: boolean; output: string }> {
  const apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY || '';
  const apiUrl = process.env.DUOPLUS_API_URL || 'https://openapi.duoplus.net';
  
  try {
    console.log(`[ADBKeyboard] Executing command: ${command.substring(0, 100)}...`);
    
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
        timeout: 120000, // 2 minutes timeout for APK installation
      }
    );
    
    console.log(`[ADBKeyboard] Response code: ${response.data.code}`);
    console.log(`[ADBKeyboard] Response data:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 200 && response.data.data) {
      const success = response.data.data.success !== false;
      const output = response.data.data.content || response.data.data.message || '';
      
      console.log(`[ADBKeyboard] Command ${success ? 'succeeded' : 'failed'}: ${output.substring(0, 200)}`);
      
      return {
        success,
        output,
      };
    }
    
    console.error('[ADBKeyboard] Unexpected response structure:', response.data);
    return { 
      success: false, 
      output: response.data.message || 'Unknown error' 
    };
  } catch (error: any) {
    console.error('[ADBKeyboard] Command execution failed:', error.message);
    if (error.response) {
      console.error('[ADBKeyboard] Response status:', error.response.status);
      console.error('[ADBKeyboard] Response data:', error.response.data);
    }
    return { 
      success: false, 
      output: error.response?.data?.message || error.message 
    };
  }
}

const ADBKEYBOARD_APK_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663209474318/mVjTbmzXsamFGxlj.apk';
const ADBKEYBOARD_PACKAGE = 'com.android.adbkeyboard';
const ADBKEYBOARD_IME = 'com.android.adbkeyboard/.AdbIME';

export interface InstallResult {
  success: boolean;
  message: string;
  alreadyInstalled?: boolean;
}

/**
 * Check if ADBKeyboard is installed on the device
 */
export async function isADBKeyboardInstalled(deviceId: string): Promise<boolean> {
  try {
    const result = await executeCommand(
      deviceId,
      `pm list packages | grep ${ADBKEYBOARD_PACKAGE}`
    );
    
    return result.success && result.output.includes(ADBKEYBOARD_PACKAGE);
  } catch (error: any) {
    console.error(`[ADBKeyboard] Failed to check installation:`, error.message);
    return false;
  }
}

/**
 * Download ADBKeyboard APK to device using wget
 * This method downloads the APK directly from a public URL
 */
async function downloadAPK(deviceId: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const apkPath = '/sdcard/Download/ADBKeyboard.apk';
    
    console.log('[ADBKeyboard] Removing existing APK if any...');
    await executeCommand(deviceId, `rm -f ${apkPath}`);
    
    console.log('[ADBKeyboard] Downloading APK from CDN...');
    console.log(`[ADBKeyboard] URL: ${ADBKEYBOARD_APK_URL}`);
    
    // Download APK using wget
    const downloadResult = await executeCommand(
      deviceId,
      `wget -O ${apkPath} "${ADBKEYBOARD_APK_URL}"`
    );
    
    if (!downloadResult.success) {
      console.error('[ADBKeyboard] Download failed:', downloadResult.output);
      return {
        success: false,
        error: `Failed to download APK: ${downloadResult.output}`
      };
    }
    
    console.log('[ADBKeyboard] Download completed, verifying file...');
    
    // Verify file exists and has content
    const verifyResult = await executeCommand(deviceId, `ls -lh ${apkPath}`);
    if (verifyResult.success && verifyResult.output.includes('ADBKeyboard.apk')) {
      console.log('[ADBKeyboard] APK file verified on device:', verifyResult.output);
      return { success: true, path: apkPath };
    } else {
      return {
        success: false,
        error: 'APK file not found on device after download'
      };
    }
  } catch (error: any) {
    console.error(`[ADBKeyboard] Failed to download APK:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Install ADBKeyboard APK on device
 */
async function installAPK(deviceId: string, apkPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ADBKeyboard] Installing APK...');
    
    // Install APK using pm install
    const installResult = await executeCommand(
      deviceId,
      `pm install -r ${apkPath}`
    );
    
    if (!installResult.success) {
      return {
        success: false,
        error: `Installation failed: ${installResult.output}`
      };
    }
    
    // Check if installation was successful
    if (installResult.output.includes('Success') || installResult.output.includes('success')) {
      console.log('[ADBKeyboard] APK installed successfully');
      return { success: true };
    } else {
      return {
        success: false,
        error: `Installation failed: ${installResult.output}`
      };
    }
  } catch (error: any) {
    console.error(`[ADBKeyboard] Failed to install APK:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enable ADBKeyboard as input method
 */
async function enableIME(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ADBKeyboard] Enabling IME...');
    
    // Enable ADBKeyboard IME
    const enableResult = await executeCommand(
      deviceId,
      `ime enable ${ADBKEYBOARD_IME}`
    );
    
    if (!enableResult.success) {
      console.warn('[ADBKeyboard] Failed to enable IME, but continuing...');
    }
    
    console.log('[ADBKeyboard] IME enabled');
    return { success: true };
  } catch (error: any) {
    console.error(`[ADBKeyboard] Failed to enable IME:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up downloaded APK file
 */
async function cleanupAPK(deviceId: string, apkPath: string): Promise<void> {
  try {
    await executeCommand(deviceId, `rm ${apkPath}`);
    console.log('[ADBKeyboard] Cleaned up APK file');
  } catch (error: any) {
    console.warn(`[ADBKeyboard] Failed to clean up APK:`, error.message);
  }
}

/**
 * Main function to install ADBKeyboard on device
 */
export async function installADBKeyboard(deviceId: string): Promise<InstallResult> {
  try {
    console.log('[ADBKeyboard] Starting installation process...');
    
    // Check if already installed
    const isInstalled = await isADBKeyboardInstalled(deviceId);
    if (isInstalled) {
      console.log('[ADBKeyboard] Already installed');
      
      // Enable IME anyway to ensure it's enabled
      await enableIME(deviceId);
      
      return {
        success: true,
        message: 'ADBKeyboard is already installed',
        alreadyInstalled: true
      };
    }
    
    // Download APK
    const downloadResult = await downloadAPK(deviceId);
    if (!downloadResult.success || !downloadResult.path) {
      return {
        success: false,
        message: `Failed to download APK: ${downloadResult.error}`
      };
    }
    
    // Install APK
    const installResult = await installAPK(deviceId, downloadResult.path);
    if (!installResult.success) {
      // Clean up even if installation failed
      await cleanupAPK(deviceId, downloadResult.path);
      
      return {
        success: false,
        message: `Failed to install APK: ${installResult.error}`
      };
    }
    
    // Enable IME
    const enableResult = await enableIME(deviceId);
    if (!enableResult.success) {
      console.warn('[ADBKeyboard] IME enable failed, but installation succeeded');
    }
    
    // Clean up APK file
    await cleanupAPK(deviceId, downloadResult.path);
    
    console.log('[ADBKeyboard] Installation completed successfully');
    return {
      success: true,
      message: 'ADBKeyboard installed successfully'
    };
  } catch (error: any) {
    console.error(`[ADBKeyboard] Installation failed:`, error.message);
    return {
      success: false,
      message: `Installation failed: ${error.message}`
    };
  }
}

/**
 * Get ADBKeyboard status for a device
 */
export async function getADBKeyboardStatus(deviceId: string): Promise<{
  installed: boolean;
  enabled?: boolean;
}> {
  try {
    const installed = await isADBKeyboardInstalled(deviceId);
    
    if (!installed) {
      return { installed: false };
    }
    
    // Check if IME is enabled
    const imeListResult = await executeCommand(deviceId, 'ime list -s');
    const enabled = imeListResult.success && imeListResult.output.includes(ADBKEYBOARD_IME);
    
    return {
      installed: true,
      enabled
    };
  } catch (error: any) {
    console.error(`[ADBKeyboard] Failed to get status:`, error.message);
    return { installed: false };
  }
}
