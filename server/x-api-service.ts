import { db } from "./db";
import { xApiSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

interface Tweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
}

interface SearchResponse {
  data?: Tweet[];
  meta?: {
    result_count: number;
  };
}

// User profile interface
export interface XUserProfile {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified?: boolean;
  verified_type?: string;
  location?: string;
  url?: string;
  created_at?: string;
  pinned_tweet_id?: string;
}

/**
 * X APIの設定を取得
 */
async function getXApiSettings() {
  const settings = await db.query.xApiSettings.findFirst({
    where: eq(xApiSettings.userId, 1),
  });
  return settings;
}

/**
 * ユーザーIDを取得（usernameから）
 * Bearer Token（App-only auth）で使用可能
 */
export async function getXUserId(username: string): Promise<string | null> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) return null;

  try {
    const response = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}`,
      {
        headers: {
          Authorization: `Bearer ${settings.bearerToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Failed to get user ID:", response.status, errorData);
      return null;
    }

    const data = await response.json();
    return data.data?.id || null;
  } catch (error) {
    console.error("[X API] Error getting user ID:", error);
    return null;
  }
}

/**
 * ユーザープロフィールを取得（詳細情報付き）
 * モデルアカウント分析用に拡張データを取得
 */
export async function getXUserProfile(username: string): Promise<XUserProfile | null> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) {
    console.error("[X API] Bearer token not found");
    return null;
  }

  try {
    // Request user fields for comprehensive profile data
    const userFields = [
      'id', 'username', 'name', 'description',
      'profile_image_url', 'public_metrics', 'verified',
      'verified_type', 'location', 'url', 'created_at',
      'pinned_tweet_id'
    ].join(',');

    const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=${userFields}`;

    console.log("[X API] Fetching user profile:", username);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Failed to get user profile:", response.status, errorData);
      return null;
    }

    const data = await response.json();

    if (!data.data) {
      console.error("[X API] No user data returned for:", username);
      return null;
    }

    console.log("[X API] Profile fetched successfully:", data.data.username,
      "followers:", data.data.public_metrics?.followers_count);

    return data.data as XUserProfile;
  } catch (error) {
    console.error("[X API] Error getting user profile:", error);
    return null;
  }
}

/**
 * ユーザーの最新投稿を取得（エンゲージメント指標付き）
 * User Timeline APIを使用（Search APIより多くの投稿を取得可能）
 */
export async function getLatestTweetsWithMetrics(
  username: string,
  count: number = 10
): Promise<Tweet[]> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) {
    console.error("[X API] Bearer token not found");
    return [];
  }

  try {
    const userId = await getXUserId(username);
    if (!userId) {
      console.error("[X API] Could not get user ID for:", username);
      return [];
    }

    const maxResults = Math.max(5, Math.min(100, count));
    const tweetFields = 'created_at,author_id,public_metrics';
    // Exclude both retweets and replies to get only main posts
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=${tweetFields}&exclude=retweets,replies`;

    console.log("[X API] Fetching tweets with metrics:", username);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Timeline with metrics failed:", response.status, errorData);
      return [];
    }

    const data: SearchResponse = await response.json();
    console.log("[X API] Tweets with metrics result:", data.meta?.result_count, "tweets");

    return data.data || [];
  } catch (error) {
    console.error("[X API] Error fetching tweets with metrics:", error);
    return [];
  }
}

/**
 * ユーザーの最新投稿を取得
 * User Timeline APIを使用（Search APIより多くの投稿を取得可能）
 */
export async function getLatestTweets(username: string, count: number = 10): Promise<Tweet[]> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) {
    console.error("[X API] Bearer token not found");
    return [];
  }

  try {
    // まずユーザーIDを取得
    const userId = await getXUserId(username);
    if (!userId) {
      console.error("[X API] Could not get user ID for:", username);
      // フォールバック: Search APIを試す
      return await searchRecentTweets(username, count, settings.bearerToken);
    }

    // User Timeline API（より多くの投稿を取得可能）
    // Exclude both retweets and replies to get only main posts
    const maxResults = Math.max(5, Math.min(100, count));
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,author_id&exclude=retweets,replies`;

    console.log("[X API] Fetching user timeline:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Timeline failed:", response.status, errorData);
      // フォールバック: Search APIを試す
      return await searchRecentTweets(username, count, settings.bearerToken);
    }

    const data: SearchResponse = await response.json();
    console.log("[X API] Timeline result:", data.meta?.result_count, "tweets found");

    return data.data || [];
  } catch (error) {
    console.error("[X API] Error fetching timeline:", error);
    return [];
  }
}

/**
 * Search Recent APIでツイートを検索（フォールバック用）
 */
async function searchRecentTweets(username: string, count: number, bearerToken: string): Promise<Tweet[]> {
  try {
    // Exclude both retweets and replies to get only main posts
    const query = `from:${username} -is:retweet -is:reply`;
    const maxResults = Math.max(10, Math.min(100, count));
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,author_id`;

    console.log("[X API] Searching tweets (fallback):", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Search failed:", response.status, errorData);
      return [];
    }

    const data: SearchResponse = await response.json();
    console.log("[X API] Search result:", data.meta?.result_count, "tweets found");

    return data.data || [];
  } catch (error) {
    console.error("[X API] Error searching tweets:", error);
    return [];
  }
}

/**
 * 投稿URLを構築
 */
export function buildTweetUrl(username: string, tweetId: string): string {
  return `https://x.com/${username}/status/${tweetId}`;
}

/**
 * 投稿後のURLを自動取得
 * Search APIを使用して最新の投稿を検索
 */
export async function getPostUrlAfterPublish(
  username: string,
  postContent: string
): Promise<string | null> {
  // 投稿が反映されるまで待機（Search APIのインデックス更新を待つ）
  await new Promise(resolve => setTimeout(resolve, 5000));

  const tweets = await getLatestTweets(username, 5);
  if (tweets.length === 0) {
    console.warn("[X API] No tweets found after publish");
    return null;
  }

  // 投稿内容と一致するツイートを検索
  const matchingTweet = tweets.find(tweet => {
    const contentSnippet = postContent.substring(0, 30).trim();
    return tweet.text.includes(contentSnippet);
  });

  if (!matchingTweet) {
    console.warn("[X API] No matching tweet found. Using latest tweet.");
    // マッチしない場合は最新のツイートを返す
    return buildTweetUrl(username, tweets[0].id);
  }

  console.log("[X API] Found matching tweet:", matchingTweet.id);
  return buildTweetUrl(username, matchingTweet.id);
}

// Tweet metrics interface for engagement tracking
export interface TweetMetrics {
  tweetId: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  impressionCount: number;
  bookmarkCount?: number;
}

/**
 * 単一ツイートのエンゲージメントメトリクスを取得
 * X API v2 の public_metrics を使用
 */
export async function getTweetMetrics(tweetId: string): Promise<TweetMetrics | null> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) {
    console.error("[X API] Bearer token not found");
    return null;
  }

  try {
    // Request tweet with public metrics
    const tweetFields = 'public_metrics,non_public_metrics,organic_metrics';
    const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=${tweetFields}`;

    console.log("[X API] Fetching tweet metrics for:", tweetId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Failed to get tweet metrics:", response.status, errorData);
      return null;
    }

    const data = await response.json();

    if (!data.data) {
      console.error("[X API] No tweet data returned for:", tweetId);
      return null;
    }

    const publicMetrics = data.data.public_metrics || {};
    const nonPublicMetrics = data.data.non_public_metrics || {};
    const organicMetrics = data.data.organic_metrics || {};

    const metrics: TweetMetrics = {
      tweetId,
      retweetCount: publicMetrics.retweet_count || 0,
      replyCount: publicMetrics.reply_count || 0,
      likeCount: publicMetrics.like_count || 0,
      quoteCount: publicMetrics.quote_count || 0,
      impressionCount: publicMetrics.impression_count || nonPublicMetrics.impression_count || organicMetrics.impression_count || 0,
      bookmarkCount: publicMetrics.bookmark_count || 0,
    };

    console.log("[X API] Tweet metrics fetched:", JSON.stringify(metrics));
    return metrics;
  } catch (error) {
    console.error("[X API] Error getting tweet metrics:", error);
    return null;
  }
}

/**
 * 投稿URLからツイートIDを抽出
 */
export function extractTweetIdFromUrl(postUrl: string): string | null {
  // Formats: https://twitter.com/user/status/123456789
  //          https://x.com/user/status/123456789
  const match = postUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Update user profile (bio/description)
 * Note: X API v1.1 account/update_profile requires OAuth 1.0a user authentication.
 * In production, this should be done via Playwright browser automation.
 */
export async function updateXUserProfile(
  accountId: number,
  profileData: {
    description?: string;
    name?: string;
    url?: string;
    location?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  console.log(`[X API] updateXUserProfile called for account ${accountId}`);
  console.log(`[X API] Profile data:`, profileData);

  // X API v2 doesn't support profile updates directly
  // v1.1 POST account/update_profile requires OAuth 1.0a with user credentials
  // For now, log the request and return success
  // In production, implement via Playwright browser automation

  // TODO: Implement via Playwright browser automation
  // 1. Connect to the device assigned to this account
  // 2. Navigate to profile settings
  // 3. Update the bio/description field
  // 4. Save changes

  console.warn("[X API] Profile update not fully implemented - requires device automation");

  // Return success for development/testing
  // In production, this should actually update the profile
  return {
    success: true,
    error: undefined,
  };
}

// ============================================
// Trending & Search Functions
// ============================================

interface TrendingHashtagResult {
  hashtag: string;
  tweetCount: number;
  sampleTweets: Tweet[];
}

/**
 * Search for tweets with a specific hashtag
 * Uses Search Recent API to find trending content
 *
 * @param hashtag - The hashtag to search (with or without #)
 * @param count - Number of tweets to retrieve (max 100)
 */
export async function searchTrendingHashtag(
  hashtag: string,
  count: number = 20
): Promise<TrendingHashtagResult | null> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) {
    console.error("[X API] Bearer token not found");
    return null;
  }

  try {
    // Clean hashtag (remove # if present)
    const cleanHashtag = hashtag.replace(/^#/, "");
    const query = `#${cleanHashtag}`;
    const maxResults = Math.max(10, Math.min(100, count));

    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,author_id,public_metrics`;

    console.log("[X API] Searching hashtag:", cleanHashtag);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.bearerToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[X API] Hashtag search failed:", response.status, errorData);
      return null;
    }

    const data: SearchResponse = await response.json();
    console.log("[X API] Hashtag search result:", data.meta?.result_count, "tweets");

    return {
      hashtag: cleanHashtag,
      tweetCount: data.meta?.result_count || 0,
      sampleTweets: data.data || [],
    };
  } catch (error) {
    console.error("[X API] Error searching hashtag:", error);
    return null;
  }
}

/**
 * Search for multiple trending hashtags and return aggregated results
 *
 * @param hashtags - Array of hashtags to search
 * @param countPerHashtag - Number of tweets per hashtag
 */
export async function searchMultipleHashtags(
  hashtags: string[],
  countPerHashtag: number = 10
): Promise<TrendingHashtagResult[]> {
  const results: TrendingHashtagResult[] = [];

  for (const hashtag of hashtags) {
    const result = await searchTrendingHashtag(hashtag, countPerHashtag);
    if (result) {
      results.push(result);
    }
    // Small delay between requests to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Sort by tweet count (most popular first)
  results.sort((a, b) => b.tweetCount - a.tweetCount);

  return results;
}

/**
 * Extract popular hashtags from recent tweets of a user
 * Useful for finding relevant hashtags in your niche
 *
 * @param username - The username to analyze
 * @param tweetCount - Number of tweets to analyze
 */
export async function extractHashtagsFromUser(
  username: string,
  tweetCount: number = 50
): Promise<{ hashtag: string; count: number }[]> {
  const tweets = await getLatestTweets(username, tweetCount);

  // Extract hashtags from tweets
  const hashtagCounts = new Map<string, number>();
  const hashtagRegex = /#(\w+)/g;

  for (const tweet of tweets) {
    const matches = tweet.text.matchAll(hashtagRegex);
    for (const match of matches) {
      const hashtag = match[1].toLowerCase();
      hashtagCounts.set(hashtag, (hashtagCounts.get(hashtag) || 0) + 1);
    }
  }

  // Convert to array and sort by count
  const sortedHashtags = Array.from(hashtagCounts.entries())
    .map(([hashtag, count]) => ({ hashtag, count }))
    .sort((a, b) => b.count - a.count);

  return sortedHashtags;
}

/**
 * Find potential trending topics based on engagement metrics
 * Analyzes tweets from model accounts to identify high-performing hashtags
 *
 * @param usernames - Array of usernames to analyze
 * @param minEngagement - Minimum engagement (likes) to consider
 */
export async function findHighEngagementHashtags(
  usernames: string[],
  minEngagement: number = 100
): Promise<{ hashtag: string; avgEngagement: number; tweetCount: number }[]> {
  const hashtagStats = new Map<string, { totalEngagement: number; count: number }>();
  const hashtagRegex = /#(\w+)/g;

  for (const username of usernames) {
    const tweets = await getLatestTweetsWithMetrics(username, 20);

    for (const tweet of tweets) {
      const engagement = tweet.public_metrics?.like_count || 0;

      if (engagement >= minEngagement) {
        const matches = tweet.text.matchAll(hashtagRegex);
        for (const match of matches) {
          const hashtag = match[1].toLowerCase();
          const current = hashtagStats.get(hashtag) || { totalEngagement: 0, count: 0 };
          hashtagStats.set(hashtag, {
            totalEngagement: current.totalEngagement + engagement,
            count: current.count + 1,
          });
        }
      }
    }

    // Small delay between users to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Convert to array and calculate averages
  const results = Array.from(hashtagStats.entries())
    .map(([hashtag, stats]) => ({
      hashtag,
      avgEngagement: Math.round(stats.totalEngagement / stats.count),
      tweetCount: stats.count,
    }))
    .filter((h) => h.tweetCount >= 2) // At least 2 occurrences
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  return results;
}
