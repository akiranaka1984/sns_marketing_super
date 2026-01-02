import { tap, inputText, openApp, screenshot, randomWait } from './duoplus';
import { getAccountById } from './db';
import { invokeLLM } from './_core/llm';
import { notifyOwner } from './_core/notification';

/**
 * Post Automation
 * Automatically generates and publishes posts based on AI strategies
 */

interface PostContent {
  text: string;
  hashtags: string[];
  mediaUrls?: string[];
}

interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

/**
 * Generate post content using AI
 */
async function generatePostContent(platform: string, topic: string, strategy?: string): Promise<PostContent> {
  try {
    const prompt = `Generate a ${platform} post about "${topic}".
${strategy ? `Strategy: ${strategy}` : ''}

Requirements:
- Engaging and authentic tone
- Include relevant hashtags (3-5)
- Optimize for ${platform} platform
- Length: ${platform === 'twitter' ? '280 characters max' : '500 characters max'}

Return JSON format:
{
  "text": "post content",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a social media content creator. Generate engaging posts in JSON format.' },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'post_content',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The main post content' },
              hashtags: { type: 'array', items: { type: 'string' }, description: 'List of hashtags without # symbol' },
            },
            required: ['text', 'hashtags'],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const contentStr = typeof messageContent === 'string' ? messageContent : '{}';
    const content = JSON.parse(contentStr);
    return {
      text: content.text || '',
      hashtags: content.hashtags || [],
    };
  } catch (error) {
    console.error('[PostAutomation] Failed to generate post content:', error);
    throw new Error('Failed to generate post content');
  }
}

/**
 * Post to Twitter
 */
async function postToTwitter(deviceId: string, content: PostContent): Promise<PostResult> {
  try {
    // Open Twitter app
    await openApp(deviceId, 'com.twitter.android');
    await randomWait(2000, 3000);

    // Tap compose button (coordinates may need adjustment)
    await tap(deviceId, 900, 1800);
    await randomWait(1000, 2000);

    // Input post text with hashtags
    const fullText = `${content.text}\n\n${content.hashtags.map(tag => `#${tag}`).join(' ')}`;
    await inputText(deviceId, fullText);
    await randomWait(1000, 2000);

    // Tap post button (coordinates may need adjustment)
    await tap(deviceId, 900, 100);
    await randomWait(2000, 3000);

    // Verify post was published
    const screenshotData = await screenshot(deviceId);
    // TODO: Implement verification logic

    return {
      success: true,
      postId: `twitter_${Date.now()}`,
    };
  } catch (error: any) {
    console.error('[PostAutomation] Failed to post to Twitter:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post to TikTok
 */
async function postToTikTok(deviceId: string, content: PostContent): Promise<PostResult> {
  try {
    // TODO: Implement TikTok posting logic
    return {
      success: false,
      error: 'TikTok posting not implemented',
    };
  } catch (error: any) {
    console.error('[PostAutomation] Failed to post to TikTok:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post to Instagram
 */
async function postToInstagram(deviceId: string, content: PostContent): Promise<PostResult> {
  try {
    // TODO: Implement Instagram posting logic
    return {
      success: false,
      error: 'Instagram posting not implemented',
    };
  } catch (error: any) {
    console.error('[PostAutomation] Failed to post to Instagram:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post to Facebook
 */
async function postToFacebook(deviceId: string, content: PostContent): Promise<PostResult> {
  try {
    // TODO: Implement Facebook posting logic
    return {
      success: false,
      error: 'Facebook posting not implemented',
    };
  } catch (error: any) {
    console.error('[PostAutomation] Failed to post to Facebook:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Publish a post to a specific account
 */
export async function publishPost(
  accountId: string,
  deviceId: string,
  topic: string,
  strategy?: string
): Promise<boolean> {
  try {
    const account = await getAccountById(parseInt(accountId));
    if (!account) {
      console.error(`[PostAutomation] Account not found: ${accountId}`);
      return false;
    }

    // Generate post content
    const content = await generatePostContent(account.platform, topic, strategy);
    console.log(`[PostAutomation] Generated content for ${account.platform}:`, content);

    // Post to platform
    let result: PostResult;
    switch (account.platform.toLowerCase()) {
      case 'twitter':
        result = await postToTwitter(deviceId, content);
        break;
      case 'tiktok':
        result = await postToTikTok(deviceId, content);
        break;
      case 'instagram':
        result = await postToInstagram(deviceId, content);
        break;
      case 'facebook':
        result = await postToFacebook(deviceId, content);
        break;
      default:
        console.error(`[PostAutomation] Unsupported platform: ${account.platform}`);
        return false;
    }

    if (!result.success) {
      console.error(`[PostAutomation] Failed to publish post: ${result.error}`);
      return false;
    }

    // Notify owner of successful post
    await notifyOwner({
      title: 'Post Published Successfully',
      content: `Posted to ${account.platform} (@${account.username}): ${content.text.substring(0, 100)}...`,
    });

    console.log(`[PostAutomation] Successfully published post for account ${accountId}`);
    return true;
  } catch (error) {
    console.error(`[PostAutomation] Error publishing post for account ${accountId}:`, error);
    
    // Notify owner of error
    await notifyOwner({
      title: 'Post Publishing Failed',
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    
    return false;
  }
}

/**
 * Schedule posts for all active accounts
 */
export async function schedulePostsForAllAccounts(): Promise<void> {
  try {
    console.log('[PostAutomation] Starting scheduled posting for all accounts');
    
    // TODO: Implement batch posting logic
    // Get all active accounts
    // For each account, generate and publish post based on strategy
    
    console.log('[PostAutomation] Batch posting not yet implemented');
  } catch (error) {
    console.error('[PostAutomation] Error in batch posting:', error);
  }
}
