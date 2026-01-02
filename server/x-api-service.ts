import { db } from "./db";
import { xApiSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

interface Tweet {
  id: string;
  text: string;
  author_id?: string;
}

interface SearchResponse {
  data?: Tweet[];
  meta?: {
    result_count: number;
  };
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
 * ユーザーの最新投稿を取得
 * Bearer Token（App-only auth）でSearch APIを使用
 */
export async function getLatestTweets(username: string, count: number = 10): Promise<Tweet[]> {
  const settings = await getXApiSettings();
  if (!settings?.bearerToken) {
    console.error("[X API] Bearer token not found");
    return [];
  }

  try {
    // Search Recent Tweets API (Bearer Tokenで使用可能)
    // from:username で特定ユーザーの投稿を検索
    const query = `from:${username} -is:retweet -is:reply`;
    // X API requires max_results to be between 10 and 100
    const maxResults = Math.max(10, Math.min(100, count));
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,author_id`;
    
    console.log("[X API] Searching tweets:", url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.bearerToken}`,
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
