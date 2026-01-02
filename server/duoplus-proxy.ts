/**
 * DuoPlus Proxy Integration
 * Functions to add proxies to DuoPlus and configure devices
 */

import { fetchWithTimeout } from './fetch-with-timeout';
import { deviceStatusCache } from './device-status-cache';
import { getSetting } from './db';

// Get API settings from database (with environment variable fallback)
async function getApiSettings() {
  const duoplusApiKey = await getSetting('DUOPLUS_API_KEY') || process.env.DUOPLUS_API_KEY;
  const duoplusApiUrl = process.env.DUOPLUS_API_URL || "https://openapi.duoplus.net";
  
  return {
    duoplusApiKey,
    duoplusApiUrl,
  };
}

interface DuoPlusProxyAddRequest {
  protocol: string;
  host: string;
  port: number;
  user: string;
  password: string;
  name?: string;
}

interface DuoPlusProxyAddResponse {
  code: number;
  data: {
    success: Array<{
      index: number;
      id: string;
    }>;
    fail: Array<{
      index: number;
      message: string;
    }>;
  };
  message: string;
}

interface DuoPlusDeviceUpdateRequest {
  images: Array<{
    image_id: string;
    proxy?: {
      id: string;
      dns?: number;
    };
  }>;
}

interface DuoPlusDeviceUpdateResponse {
  code: number;
  data: {
    success: string[];
    fail: string[];
    fail_reason: Record<string, string>;
  };
  message: string;
}

interface DuoPlusProxyListResponse {
  code: number;
  data: {
    list: Array<{
      id: string;
      name: string;
      host: string;
      port: string;
      user?: string;
      area?: string;
    }>;
    page: number;
    pagesize: number;
    total: number;
    total_page: number;
  };
  message: string;
}

/**
 * Get list of proxies from DuoPlus
 * @param page Page number (default: 1)
 * @param pagesize Number of entries per page (default: 100)
 * @returns Array of proxies
 */
export async function getProxyListFromDuoPlus(
  page: number = 1,
  pagesize: number = 100
): Promise<Array<{ id: string; name: string; host: string; port: string; user?: string; area?: string }>> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl || "https://openapi.duoplus.net";

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  const response = await fetchWithTimeout(`${duoplusApiUrl}/api/v1/proxy/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DuoPlus-API-Key": duoplusApiKey,
      Lang: "en",
    },
    body: JSON.stringify({ page, pagesize }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get proxy list from DuoPlus: ${response.status} ${errorText}`);
  }

  const result: DuoPlusProxyListResponse = await response.json();

  if (result.code !== 200) {
    throw new Error(`DuoPlus API error: ${result.message}`);
  }

  return result.data.list;
}

/**
 * Find proxy ID by host and port
 * @param host Proxy host
 * @param port Proxy port
 * @returns DuoPlus proxy ID or null if not found
 */
export async function findProxyIdByHostPort(host: string, port: number): Promise<string | null> {
  try {
    const proxies = await getProxyListFromDuoPlus(1, 100);
    
    // Match by host and port
    const matchedProxy = proxies.find(
      (p) => p.host === host && parseInt(p.port) === port
    );

    if (matchedProxy) {
      console.log(`[DuoPlus] Found existing proxy ID: ${matchedProxy.id} for ${host}:${port}`);
      return matchedProxy.id;
    }

    console.log(`[DuoPlus] No existing proxy found for ${host}:${port}`);
    return null;
  } catch (error: any) {
    console.error('[DuoPlus] Find proxy ID error:', error.message);
    return null;
  }
}

/**
 * Add a proxy to DuoPlus
 * @param proxyData Proxy information
 * @returns DuoPlus proxy ID
 */
export async function addProxyToDuoPlus(proxyData: {
  host: string;
  port: number;
  username: string;
  password: string;
  name?: string;
}): Promise<string> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl || "https://openapi.duoplus.net";

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  const requestBody: { proxy_list: DuoPlusProxyAddRequest[]; ip_scan_channel?: string } = {
    proxy_list: [
      {
        protocol: "socks5",
        host: proxyData.host,
        port: proxyData.port,
        user: proxyData.username,
        password: proxyData.password,
        name: proxyData.name,
      },
    ],
    ip_scan_channel: "ip2location",
  };

  const response = await fetchWithTimeout(`${duoplusApiUrl}/api/v1/proxy/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DuoPlus-API-Key": duoplusApiKey,
      Lang: "en",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add proxy to DuoPlus: ${response.status} ${errorText}`);
  }

  const result: DuoPlusProxyAddResponse = await response.json();

  if (result.code !== 200) {
    throw new Error(`DuoPlus API error: ${result.message}`);
  }

  // Check if proxy already exists
  if (result.data.fail.length > 0) {
    const failMessage = result.data.fail[0].message;
    
    // If proxy already exists, try to find its ID
    if (failMessage.toLowerCase().includes("already") || failMessage.toLowerCase().includes("exist")) {
      console.log('[DuoPlus] Proxy already exists, fetching existing ID...');
      const existingProxyId = await findProxyIdByHostPort(proxyData.host, proxyData.port);
      if (existingProxyId) {
        return existingProxyId;
      }
      throw new Error(`Proxy exists but ID not found: ${failMessage}`);
    }
    
    throw new Error(`Failed to add proxy: ${failMessage}`);
  }

  if (result.data.success.length === 0) {
    throw new Error("No proxy was added");
  }

  return result.data.success[0].id;
}

/**
 * Set proxy for a device
 * @param deviceId Device ID (e.g., snap_1nTNY)
 * @param duoplusProxyId DuoPlus proxy ID
 */
export async function setDeviceProxy(deviceId: string, duoplusProxyId: string): Promise<void> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl || "https://openapi.duoplus.net";

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  // Remove "snap_" prefix if present
  const actualDeviceId = deviceId.startsWith("snap_") ? deviceId.substring(5) : deviceId;
  
  // Check device status before setting proxy
  console.log(`[DuoPlus] Checking device status for: ${deviceId} (actual ID: ${actualDeviceId})`);
  try {
    const devices = await getDeviceListFromDuoPlus(1, 100);
    const device = devices.find(d => d.id === actualDeviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found in DuoPlus account`);
    }
    
    // Status: 0 = Powered Off, 1 = Powered On, 2 = Starting, 4 = Stopping
    if (device.status === 0) {
      throw new Error(`Device ${deviceId} is powered off. Please start the device first.`);
    }
    
    if (device.status === 2 || device.status === 4) {
      throw new Error(`Device ${deviceId} is in transition (starting/stopping). Please wait and try again.`);
    }
    
    console.log(`[DuoPlus] Device ${deviceId} is powered on (status: ${device.status})`);
  } catch (error: any) {
    console.error(`[DuoPlus] Device status check failed:`, error.message);
    // Throw error to prevent setting proxy on powered-off devices
    throw error;
  }
  
  const requestBody: DuoPlusDeviceUpdateRequest = {
    images: [
      {
        image_id: actualDeviceId,
        proxy: {
          id: duoplusProxyId,
          dns: 1, // Enable DNS
        },
      },
    ],
  };
  
  console.log(`[DuoPlus] Setting proxy for device: ${deviceId} (actual ID: ${actualDeviceId}), proxy ID: ${duoplusProxyId}`);
  console.log(`[DuoPlus] Request body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetchWithTimeout(`${duoplusApiUrl}/api/v1/cloudPhone/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DuoPlus-API-Key": duoplusApiKey,
      Lang: "en",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set device proxy: ${response.status} ${errorText}`);
  }

  const result: DuoPlusDeviceUpdateResponse = await response.json();

  if (result.code !== 200) {
    throw new Error(`DuoPlus API error: ${result.message}`);
  }

  if (result.data.fail.length > 0) {
    const failReason = result.data.fail_reason[actualDeviceId] || result.data.fail_reason[deviceId] || "Unknown error";
    console.log(`[DuoPlus] Failed to set proxy. Fail reason:`, result.data.fail_reason);
    
    // Provide user-friendly error messages
    if (failReason.includes('not been initialized')) {
      throw new Error(`Device ${deviceId} is not initialized. Please start the device first.`);
    }
    throw new Error(`Failed to set proxy for device ${deviceId}: ${failReason}`);
  }
  
  console.log(`[DuoPlus] Successfully set proxy ${duoplusProxyId} for device ${deviceId}`);
}

interface DuoPlusDeviceListResponse {
  code: number;
  data: {
    list: Array<{
      id: string;
      name: string;
      status: number;
      android_x: string;
      ip: string;
      adb: number;
      group: string;
      tag: string;
      startup_mode: string;
      sharing_status: string;
    }>;
    page: number;
    pagesize: number;
    total: number;
    total_page: number;
  };
  message: string;
}

/**
 * Get list of devices from DuoPlus
 * @param page Page number (default: 1)
 * @param pagesize Number of entries per page (default: 100)
 * @returns Array of devices
 */
export async function getDeviceListFromDuoPlus(
  page: number = 1,
  pagesize: number = 100
): Promise<Array<{ id: string; name: string; status: number; android_x: string; ip: string }>> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl || "https://openapi.duoplus.net";

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  const response = await fetchWithTimeout(`${duoplusApiUrl}/api/v1/cloudPhone/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DuoPlus-API-Key": duoplusApiKey,
      Lang: "en",
    },
    body: JSON.stringify({ 
      page, 
      pagesize,
      link_status: [0, 1, 2, 4], // All statuses
      group_id: "all",
      fid: -1
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get device list from DuoPlus: ${response.status} ${errorText}`);
  }

  const result: DuoPlusDeviceListResponse = await response.json();

  if (result.code !== 200) {
    throw new Error(`DuoPlus API error: ${result.message}`);
  }

  return result.data.list.map(device => ({
    id: device.id,
    name: device.name,
    status: device.status,
    android_x: device.android_x,
    ip: device.ip
  }));
}

/**
 * Find device ID by account name
 * @param accountName Account name (e.g., snap_x647M)
 * @returns DuoPlus device ID or null if not found
 */
export async function findDeviceIdByAccountName(accountName: string): Promise<string | null> {
  try {
    const devices = await getDeviceListFromDuoPlus(1, 100);
    
    // Match by name
    const matchedDevice = devices.find(
      (d) => d.name === accountName || d.id === accountName
    );

    if (matchedDevice) {
      console.log(`[DuoPlus] Found device ID: ${matchedDevice.id} for account ${accountName}`);
      return matchedDevice.id;
    }

    console.log(`[DuoPlus] No device found for account ${accountName}`);
    return null;
  } catch (error: any) {
    console.error('[DuoPlus] Find device ID error:', error.message);
    return null;
  }
}

/**
 * Get proxy configuration status for a device
 * @param deviceId Device ID (e.g., snap_x647M)
 * @returns Proxy configuration status or null if not configured
 */
export async function getDeviceProxyStatus(deviceId: string): Promise<{
  proxyId: string | null;
  proxyHost: string | null;
  proxyPort: string | null;
  isConfigured: boolean;
} | null> {
  try {
    const devices = await getDeviceListFromDuoPlus(1, 100);
    const device = devices.find(d => d.id === deviceId || d.name === deviceId);
    
    if (!device) {
      console.log(`[DuoPlus] Device not found: ${deviceId}`);
      return null;
    }

    // Check if device has proxy configured by checking IP
    // If IP is set and not empty, proxy is likely configured
    const isConfigured = !!(device.ip && device.ip !== '-' && device.ip.trim() !== '');
    
    return {
      proxyId: null, // DuoPlus API doesn't return proxy ID in device list
      proxyHost: null,
      proxyPort: null,
      isConfigured,
    };
  } catch (error: any) {
    console.error('[DuoPlus] Get device proxy status error:', error.message);
    return null;
  }
}

/**
 * Batch get proxy configuration status for multiple devices
 * @param deviceIds Array of device IDs
 * @returns Map of device ID to proxy status
 */
export async function batchGetDeviceProxyStatus(
  deviceIds: string[]
): Promise<Map<string, boolean>> {
  const statusMap = new Map<string, boolean>();
  
  try {
    const devices = await getDeviceListFromDuoPlus(1, 100);
    
    for (const deviceId of deviceIds) {
      const device = devices.find(d => d.id === deviceId || d.name === deviceId);
      if (device) {
        const isConfigured = !!(device.ip && device.ip !== '-' && device.ip.trim() !== '');
        statusMap.set(deviceId, isConfigured);
      } else {
        statusMap.set(deviceId, false);
      }
    }
  } catch (error: any) {
    console.error('[DuoPlus] Batch get device proxy status error:', error.message);
  }
  
  return statusMap;
}

/**
 * Power on a device
 * @param deviceId Device ID (with or without snap_ prefix)
 * @returns Success status
 */
export async function powerOnDevice(deviceId: string): Promise<void> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl || "https://openapi.duoplus.net";

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  // Remove "snap_" prefix if present
  const actualDeviceId = deviceId.startsWith("snap_") ? deviceId.substring(5) : deviceId;
  
  console.log(`[DuoPlus] Powering on device: ${deviceId} (actual ID: ${actualDeviceId})`);

  const response = await fetchWithTimeout(`${duoplusApiUrl}/api/v1/cloudPhone/powerOn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DuoPlus-API-Key": duoplusApiKey,
      Lang: "en",
    },
    body: JSON.stringify({
      image_ids: [actualDeviceId],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to power on device: ${response.status} ${errorText}`);
  }

  const result: any = await response.json();
  
  // Check if the device was successfully powered on
  if (result.data?.fail?.includes(actualDeviceId)) {
    throw new Error(`Failed to power on device ${deviceId}: Device in fail list`);
  }
  
  console.log(`[DuoPlus] Successfully powered on device: ${deviceId}`);
}

/**
 * Power off a device
 * @param deviceId Device ID (with or without snap_ prefix)
 * @returns Success status
 */
export async function powerOffDevice(deviceId: string): Promise<void> {
  const settings = await getApiSettings();
  const duoplusApiKey = settings.duoplusApiKey;
  const duoplusApiUrl = settings.duoplusApiUrl || "https://openapi.duoplus.net";

  if (!duoplusApiKey) {
    throw new Error("DuoPlus API key is not configured");
  }

  // Remove "snap_" prefix if present
  const actualDeviceId = deviceId.startsWith("snap_") ? deviceId.substring(5) : deviceId;
  
  console.log(`[DuoPlus] Powering off device: ${deviceId} (actual ID: ${actualDeviceId})`);

  const response = await fetchWithTimeout(`${duoplusApiUrl}/api/v1/cloudPhone/powerOff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DuoPlus-API-Key": duoplusApiKey,
      Lang: "en",
    },
    body: JSON.stringify({
      image_ids: [actualDeviceId],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to power off device: ${response.status} ${errorText}`);
  }

  const result: any = await response.json();
  
  // Check if the device was successfully powered off
  if (result.data?.fail?.includes(actualDeviceId)) {
    throw new Error(`Failed to power off device ${deviceId}: Device in fail list`);
  }
  
  console.log(`[DuoPlus] Successfully powered off device: ${deviceId}`);
}

/**
 * Get device status with detailed information
 * @param deviceId Device ID (with or without snap_ prefix)
 * @returns Device status information
 */
export async function getDeviceStatus(deviceId: string): Promise<{
  id: string;
  name: string;
  status: number;
  statusText: string;
  android_x: string;
  ip: string;
}> {
  // Check cache first
  const cached = deviceStatusCache.get(deviceId);
  if (cached) {
    return cached;
  }

  const actualDeviceId = deviceId.startsWith("snap_") ? deviceId.substring(5) : deviceId;
  
  const devices = await getDeviceListFromDuoPlus(1, 100);
  const device = devices.find(d => d.id === actualDeviceId);
  
  if (!device) {
    throw new Error(`Device ${deviceId} not found in DuoPlus account`);
  }
  
  // Map status code to text
  const statusMap: { [key: number]: string } = {
    0: "Powered Off",
    1: "Powered On",
    2: "Starting",
    4: "Stopping",
  };
  
  const result = {
    id: device.id,
    name: device.name,
    status: device.status,
    statusText: statusMap[device.status] || "Unknown",
    android_x: device.android_x,
    ip: device.ip,
  };

  // Cache the result
  deviceStatusCache.set(deviceId, result);
  
  return result;
}
