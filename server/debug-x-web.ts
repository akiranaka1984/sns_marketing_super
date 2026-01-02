/**
 * Debug X Web Posting
 * Test X web posting with step-by-step screenshots
 */

import { postToXWebV2, checkXLoginV2 } from './x-web-post-v2';

export interface DebugXWebResult {
  success: boolean;
  error?: string;
  screenshots: Array<{
    step: string;
    url: string;
  }>;
  loginStatus?: boolean;
}

/**
 * Debug X web posting
 */
export async function debugXWebPost(
  deviceId: string,
  content: string,
  mediaUrl?: string
): Promise<DebugXWebResult> {
  try {
    console.log('[DebugXWeb] Starting debug session...');
    console.log('[DebugXWeb] Device ID:', deviceId);
    console.log('[DebugXWeb] Content:', content);
    
    // Check login status first
    console.log('[DebugXWeb] Checking login status...');
    const loginStatus = await checkXLoginV2(deviceId);
    console.log('[DebugXWeb] Login status:', loginStatus);
    
    if (!loginStatus) {
      return {
        success: false,
        error: 'User is not logged in to X',
        screenshots: [],
        loginStatus: false,
      };
    }
    
    // Attempt to post
    console.log('[DebugXWeb] Attempting to post...');
    const result = await postToXWebV2(deviceId, content, mediaUrl);
    
    return {
      ...result,
      loginStatus: true,
    };
    
  } catch (error: any) {
    console.error('[DebugXWeb] Debug session failed:', error.message);
    return {
      success: false,
      error: error.message,
      screenshots: [],
    };
  }
}
