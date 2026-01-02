import axios from 'axios';
import { getSetting } from './db';

/**
 * DuoPlus API Wrapper (Official Endpoint Compatible)
 * Based on official documentation: https://help.duoplus.net/docs/api-reference
 */

const DUOPLUS_API_BASE = 'https://openapi.duoplus.net'; // Fixed base URL from official documentation

// Create axios client without API key in headers (will be added dynamically)
const duoplusClient = axios.create({
  baseURL: DUOPLUS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Lang': 'en',
  },
  timeout: 30000,
});

// Add interceptor to dynamically set API key from database or environment
duoplusClient.interceptors.request.use(async (config) => {
  // Try to get API key from database first, then fall back to environment variable
  let apiKey = '';
  try {
    apiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY || '';
  } catch (error) {
    // If database is not available, fall back to environment variable
    apiKey = process.env.DUOPLUS_API_KEY || '';
  }
  
  if (apiKey) {
    config.headers['DuoPlus-API-Key'] = apiKey;
  }
  return config;
});

export interface DuoPlusDevice {
  id: string;
  name: string;
  status: number; // 0: Not configured; 1: Powered on; 2: Powered off; 3: Expired; 4: Renewal overdue; 10: Powering on; 11: Configuring; 12: Configuration failed
  os: string;
  size: string;
  created_at: string;
  expired_at: string;
  ip: string;
  area: string;
  remark: string;
  adb: string;
  adb_password: string;
}

export interface TapOptions {
  x: number;
  y: number;
}

export interface InputTextOptions {
  text: string;
  elementId?: string;
}

export interface CloudDriveFile {
  id: string;
  name: string;
  original_file_name: string;
}

export interface FilePushOptions {
  fileIds: string[];
  deviceIds: string[];
  destDir: string;
}

/**
 * Get list of available devices (Official Endpoint)
 * Endpoint: POST /api/v1/cloudPhone/list
 */
export async function listDevices(): Promise<DuoPlusDevice[]> {
  try {
    console.log('[DuoPlus] Fetching device list...');
    const apiKey = await getSetting('DUOPLUS_API_KEY') || '';
    console.log('[DuoPlus] API Key present:', !!apiKey);
    console.log('[DuoPlus] API Key length:', apiKey?.length || 0);
    
    // Request body according to API documentation
    const requestBody = {
      page: 1,
      pagesize: 10,
    };
    console.log('[DuoPlus] Request body:', JSON.stringify(requestBody));
    
    const response = await duoplusClient.post('/api/v1/cloudPhone/list', requestBody);
    
    console.log('[DuoPlus] Response status:', response.status);
    console.log('[DuoPlus] Response data:', JSON.stringify(response.data, null, 2));
    
    // Handle different response structures
    if (response.data?.data?.list) {
      return response.data.data.list;
    } else if (response.data?.list) {
      return response.data.list;
    } else if (Array.isArray(response.data?.data)) {
      return response.data.data;
    } else if (Array.isArray(response.data)) {
      return response.data;
    }
    
    console.log('[DuoPlus] No devices found in response');
    return [];
  } catch (error: any) {
    console.error('[DuoPlus] Failed to list devices:', error.message);
    if (error.response) {
      console.error('[DuoPlus] Response status:', error.response.status);
      console.error('[DuoPlus] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error('Failed to fetch devices from DuoPlus');
  }
}

/**
 * Get device by ID
 */
export async function getDevice(deviceId: string): Promise<DuoPlusDevice | null> {
  try {
    const devices = await listDevices();
    return devices.find(d => d.id === deviceId) || null;
  } catch (error) {
    console.error(`[DuoPlus] Failed to get device ${deviceId}:`, error);
    throw new Error(`Failed to get device ${deviceId}`);
  }
}

/**
 * Execute ADB command (Official Endpoint)
 * Endpoint: POST /api/v1/cloudPhone/executeAdb
 */
async function executeAdb(deviceId: string, command: string): Promise<{success: boolean, content: string, message: string}> {
  try {
    console.log('[DuoPlus] executeAdb called with:', { deviceId, command });
    const requestBody = {
      image_id: deviceId,  // 正しいパラメータ名
      command: command,     // adb shell プレフィックス不要
    };
    console.log('[DuoPlus] Request body:', JSON.stringify(requestBody));
    const response = await duoplusClient.post('/api/v1/cloudPhone/command', requestBody);
    
    // レスポンス形式: {code: 200, data: {success: true, content: "...", message: "..."}}
    console.log('[DuoPlus] Response:', JSON.stringify(response.data));
    if ((response.data.code === 0 || response.data.code === 200) && response.data.data) {
      console.log('[DuoPlus] Command executed successfully');
      return response.data.data;
    }
    
    console.error('[DuoPlus] Unexpected response code:', response.data.code);
    throw new Error(response.data.message || 'ADB command failed');
  } catch (error: any) {
    console.error(`[DuoPlus] Failed to execute ADB command on device ${deviceId}:`, error.message);
    let errorDetails = '';
    if (error.response) {
      console.error('[DuoPlus] Error response:', JSON.stringify(error.response.data));
      errorDetails = JSON.stringify(error.response.data);
    }
    // 詳細なエラー情報を含めてスロー
    throw new Error(`Failed to execute ADB command: ${command}. Device: ${deviceId}. Error: ${error.message}. Details: ${errorDetails}`);
  }
}

// Export executeAdb for external use
export { executeAdb };

/**
 * Tap on screen at specific coordinates (via ADB)
 */
export async function tap(deviceId: string, x: number, y: number): Promise<void> {
  await executeAdb(deviceId, `input tap ${x} ${y}`);
}

/**
 * Input text into a field (via ADB)
 */
export async function inputText(deviceId: string, text: string, elementId?: string): Promise<void> {
  // Escape special characters for shell
  const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "\\'");
  await executeAdb(deviceId, `input text "${escapedText}"`);
}

/**
 * Take a screenshot (via ADB)
 * Returns base64 encoded image data
 */
export async function screenshot(deviceId: string): Promise<string> {
  try {
    // Take screenshot and save to device
    await executeAdb(deviceId, 'screencap -p /sdcard/screenshot.png');
    
    // Read screenshot file and convert to base64
    const result = await executeAdb(deviceId, 'cat /sdcard/screenshot.png | base64');
    
    // Clean up
    await executeAdb(deviceId, 'rm /sdcard/screenshot.png');
    
    return result.content || '';
  } catch (error) {
    console.error(`[DuoPlus] Failed to take screenshot on device ${deviceId}:`, error);
    throw new Error(`Failed to take screenshot on device ${deviceId}`);
  }
}

/**
 * Set proxy for device (Official Endpoint)
 * Endpoint: POST /api/v1/cloudPhone/setProxy
 */
export async function setProxy(deviceId: string, proxyIp: string, proxyPort: number): Promise<void> {
  try {
    await duoplusClient.post('/api/v1/cloudPhone/setProxy', {
      cloudPhoneId: deviceId,
      proxyIp: proxyIp,
      proxyPort: proxyPort,
    });
  } catch (error) {
    console.error(`[DuoPlus] Failed to set proxy on device ${deviceId}:`, error);
    throw new Error(`Failed to set proxy on device ${deviceId}`);
  }
}

/**
 * Open an app on the device (via ADB)
 */
export async function openApp(deviceId: string, appPackage: string): Promise<void> {
  await executeAdb(deviceId, `monkey -p ${appPackage} -c android.intent.category.LAUNCHER 1`);
}

/**
 * Close an app on the device (via ADB)
 */
export async function closeApp(deviceId: string, appPackage: string): Promise<void> {
  await executeAdb(deviceId, `am force-stop ${appPackage}`);
}

/**
 * Wait for a specific duration (in milliseconds)
 */
export async function wait(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * Random wait to simulate human behavior
 */
export async function randomWait(min: number = 1000, max: number = 3000): Promise<void> {
  const duration = Math.floor(Math.random() * (max - min + 1)) + min;
  return wait(duration);
}

/**
 * Find element on screen by text (via ADB uiautomator)
 * Returns coordinates if found, null otherwise
 */
export async function findElement(deviceId: string, query: string): Promise<{ x: number; y: number } | null> {
  try {
    // Use uiautomator to find element
    const result = await executeAdb(
      deviceId,
      `uiautomator dump /sdcard/ui.xml && grep "${query}" /sdcard/ui.xml`
    );
    
    // Parse XML to extract coordinates (simplified)
    // In production, use proper XML parsing
    const boundsMatch = result.content?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (boundsMatch) {
      const x1 = parseInt(boundsMatch[1]);
      const y1 = parseInt(boundsMatch[2]);
      const x2 = parseInt(boundsMatch[3]);
      const y2 = parseInt(boundsMatch[4]);
      
      // Return center coordinates
      return {
        x: Math.floor((x1 + x2) / 2),
        y: Math.floor((y1 + y2) / 2),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[DuoPlus] Failed to find element on device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Swipe on screen (via ADB)
 */
export async function swipe(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration: number = 300): Promise<void> {
  await executeAdb(deviceId, `input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);
}

/**
 * Press back button (via ADB)
 */
export async function pressBack(deviceId: string): Promise<void> {
  await executeAdb(deviceId, 'input keyevent 4');
}

/**
 * Press home button (via ADB)
 */
export async function pressHome(deviceId: string): Promise<void> {
  await executeAdb(deviceId, 'input keyevent 3');
}

/**
 * Batch power on devices (Official Endpoint)
 * Endpoint: POST /api/v1/cloudPhone/batchPowerOn
 */
export async function batchPowerOn(deviceIds: string[]): Promise<void> {
  try {
    await duoplusClient.post('/api/v1/cloudPhone/batchPowerOn', {
      cloudPhoneIds: deviceIds,
    });
  } catch (error) {
    console.error('[DuoPlus] Failed to batch power on devices:', error);
    throw new Error('Failed to batch power on devices');
  }
}

/**
 * Batch power off devices (Official Endpoint)
 * Endpoint: POST /api/v1/cloudPhone/batchPowerOff
 */
export async function batchPowerOff(deviceIds: string[]): Promise<void> {
  try {
    await duoplusClient.post('/api/v1/cloudPhone/batchPowerOff', {
      cloudPhoneIds: deviceIds,
    });
  } catch (error) {
    console.error('[DuoPlus] Failed to batch power off devices:', error);
    throw new Error('Failed to batch power off devices');
  }
}

/**
 * Batch restart devices (Official Endpoint)
 * Endpoint: POST /api/v1/cloudPhone/batchRestart
 */
export async function batchRestart(deviceIds: string[]): Promise<void> {
  try {
    await duoplusClient.post('/api/v1/cloudPhone/batchRestart', {
      cloudPhoneIds: deviceIds,
    });
  } catch (error) {
    console.error('[DuoPlus] Failed to batch restart devices:', error);
    throw new Error('Failed to batch restart devices');
  }
}

/**
 * Batch install app (Inferred Endpoint)
 * Endpoint: POST /api/v1/app/install
 */
export async function batchInstallApp(deviceIds: string[], appId: string): Promise<void> {
  try {
    console.log(`[DuoPlus] Installing app ${appId} on ${deviceIds.length} devices...`);
    await duoplusClient.post('/api/v1/app/install', {
      cloudPhoneIds: deviceIds,
      appId: appId,
    });
    console.log(`[DuoPlus] Successfully installed app ${appId}`);
  } catch (error: any) {
    console.error(`[DuoPlus] Failed to install app ${appId}:`, error.message);
    if (error.response) {
      console.error('[DuoPlus] Response status:', error.response.status);
      console.error('[DuoPlus] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to install app ${appId}`);
  }
}

/**
 * Batch uninstall app (Inferred Endpoint)
 * Endpoint: POST /api/v1/app/uninstall
 */
export async function batchUninstallApp(deviceIds: string[], appId: string): Promise<void> {
  try {
    console.log(`[DuoPlus] Uninstalling app ${appId} from ${deviceIds.length} devices...`);
    await duoplusClient.post('/api/v1/app/uninstall', {
      cloudPhoneIds: deviceIds,
      appId: appId,
    });
    console.log(`[DuoPlus] Successfully uninstalled app ${appId}`);
  } catch (error: any) {
    console.error(`[DuoPlus] Failed to uninstall app ${appId}:`, error.message);
    if (error.response) {
      console.error('[DuoPlus] Response status:', error.response.status);
      console.error('[DuoPlus] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to uninstall app ${appId}`);
  }
}

/**
 * Update app by uninstalling and reinstalling
 * This is a workaround since DuoPlus API doesn't have a direct update endpoint
 */
export async function updateApp(deviceId: string, appId: string): Promise<void> {
  try {
    console.log(`[DuoPlus] Updating app ${appId} on device ${deviceId}...`);
    
    // Step 1: Uninstall the app
    console.log(`[DuoPlus] Step 1: Uninstalling app ${appId}...`);
    await batchUninstallApp([deviceId], appId);
    
    // Wait a bit for uninstall to complete
    await wait(3000);
    
    // Step 2: Reinstall the app
    console.log(`[DuoPlus] Step 2: Reinstalling app ${appId}...`);
    await batchInstallApp([deviceId], appId);
    
    console.log(`[DuoPlus] Successfully updated app ${appId}`);
  } catch (error: any) {
    console.error(`[DuoPlus] Failed to update app ${appId}:`, error.message);
    throw new Error(`Failed to update app ${appId}: ${error.message}`);
  }
}

/**
 * Get cloud drive file list (Official Endpoint)
 * Endpoint: POST /api/v1/cloudDisk/list
 * Note: Documentation shows /pushFiles but that's for pushing, /list is for listing
 */
export async function listCloudDriveFiles(keyword?: string, page: number = 1, pagesize: number = 100): Promise<CloudDriveFile[]> {
  try {
    console.log(`[DuoPlus] Fetching cloud drive files (keyword: "${keyword || 'none'}")...`);
    const response = await duoplusClient.post('/api/v1/cloudDisk/list', {
      keyword: keyword || '',
      page,
      pagesize,
    });
    
    console.log('[DuoPlus] Cloud drive response:', JSON.stringify(response.data, null, 2));
    
    if (response.data?.data?.list) {
      return response.data.data.list;
    } else if (response.data?.list) {
      return response.data.list;
    } else if (Array.isArray(response.data?.data)) {
      return response.data.data;
    }
    
    console.log('[DuoPlus] No files found in cloud drive');
    return [];
  } catch (error: any) {
    console.error('[DuoPlus] Failed to list cloud drive files:', error.message);
    if (error.response) {
      console.error('[DuoPlus] Response status:', error.response.status);
      console.error('[DuoPlus] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to list cloud drive files: ${error.message}`);
  }
}

/**
 * Push files from cloud drive to devices (Official Endpoint)
 * Endpoint: POST /api/v1/cloudDisk/pushFiles
 */
export async function pushFilesToDevices(options: FilePushOptions): Promise<void> {
  try {
    console.log(`[DuoPlus] Pushing ${options.fileIds.length} files to ${options.deviceIds.length} devices...`);
    console.log(`[DuoPlus] File IDs: ${options.fileIds.join(', ')}`);
    console.log(`[DuoPlus] Device IDs: ${options.deviceIds.join(', ')}`);
    console.log(`[DuoPlus] Destination: ${options.destDir}`);
    
    const response = await duoplusClient.post('/api/v1/cloudDisk/pushFiles', {
      ids: options.fileIds,
      image_ids: options.deviceIds,
      dest_dir: options.destDir,
    });
    
    console.log('[DuoPlus] Push files response:', JSON.stringify(response.data, null, 2));
    
    if (response.data?.code !== 200 && response.data?.message !== 'Success') {
      throw new Error(`Failed to push files: ${response.data?.message || 'Unknown error'}`);
    }
    
    console.log('[DuoPlus] Successfully pushed files to devices');
  } catch (error: any) {
    console.error('[DuoPlus] Failed to push files:', error.message);
    if (error.response) {
      console.error('[DuoPlus] Response status:', error.response.status);
      console.error('[DuoPlus] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to push files to devices: ${error.message}`);
  }
}

/**
 * Find a file in cloud drive by name
 */
export async function findCloudDriveFile(filename: string): Promise<CloudDriveFile | null> {
  try {
    console.log(`[DuoPlus] Searching for file: ${filename}`);
    
    // Get all files (use empty keyword to get all files)
    const files = await listCloudDriveFiles('');
    
    console.log(`[DuoPlus] Total files in cloud drive: ${files.length}`);
    console.log(`[DuoPlus] Files:`, files.map(f => `${f.name} (${f.original_file_name})`).join(', '));
    
    // Find exact match (case-insensitive)
    let file = files.find(f => 
      f.name.toLowerCase() === filename.toLowerCase() || 
      f.original_file_name.toLowerCase() === filename.toLowerCase()
    );
    
    // If not found, try partial match
    if (!file) {
      console.log(`[DuoPlus] Exact match not found, trying partial match...`);
      file = files.find(f => 
        f.name.toLowerCase().includes(filename.toLowerCase()) || 
        f.original_file_name.toLowerCase().includes(filename.toLowerCase())
      );
    }
    
    if (file) {
      console.log(`[DuoPlus] Found file: ${file.name} (Original: ${file.original_file_name}, ID: ${file.id})`);
      return file;
    }
    
    console.log(`[DuoPlus] File not found: ${filename}`);
    return null;
  } catch (error: any) {
    console.error(`[DuoPlus] Failed to find file ${filename}:`, error.message);
    throw error;
  }
}
