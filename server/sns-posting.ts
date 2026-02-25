/**
 * SNS Posting via Playwright Browser Automation
 * Supports X/Twitter posting only via Playwright.
 * Other platforms (TikTok, Instagram, Facebook) are no longer supported.
 */

import { postToXViaPlaywright } from './playwright';
import { createLogger } from './utils/logger';

const logger = createLogger('sns-posting');

interface PostResult {
  success: boolean;
  message: string;
  error?: string;
  postUrl?: string;
  screenshotUrl?: string;
}

/**
 * Post to SNS based on platform (Playwright only)
 * Only X/Twitter is supported. Other platforms return an error.
 */
export async function postToSNS(
  platform: string,
  content: string,
  accountId: number,
  mediaUrls?: string[],
): Promise<PostResult> {
  const normalizedPlatform = platform.toLowerCase();

  if (normalizedPlatform === 'twitter' || normalizedPlatform === 'x') {
    logger.info({ accountId }, "Using Playwright mode");
    const result = await postToXViaPlaywright(accountId, content, mediaUrls);
    return {
      success: result.success,
      message: result.message,
      error: result.error,
    };
  }

  return {
    success: false,
    message: `プラットフォーム "${platform}" はサポートされていません。現在はX/Twitterのみ対応しています。`,
    error: 'UNSUPPORTED_PLATFORM',
  };
}
