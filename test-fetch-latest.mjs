import { db } from "./server/db";
import { getLatestTweets, buildTweetUrl } from "./server/x-api-service";
import { accounts, postUrls } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function testFetchLatest() {
  console.log("=== Testing fetchLatestPosts ===");
  
  // 全アカウントを取得
  const allAccounts = await db.select().from(accounts);
  console.log("All accounts:", allAccounts.map(a => ({ id: a.id, username: a.username, xHandle: a.xHandle, deviceId: a.deviceId })));
  
  // arnold@bkkeyforceservices.phを検索
  const account = allAccounts.find(a => a.username === 'arnold@bkkeyforceservices.ph');
  
  console.log("Selected account:", account);
  
  if (!account?.xHandle) {
    console.error("X Handle not found");
    return;
  }
  
  console.log("Fetching tweets for:", account.xHandle);
  const tweets = await getLatestTweets(account.xHandle, 5);
  console.log("Tweets found:", tweets.length);
  console.log("Tweets:", JSON.stringify(tweets, null, 2));
  
  if (tweets.length > 0) {
    const firstTweet = tweets[0];
    const postUrl = buildTweetUrl(account.xHandle, firstTweet.id);
    console.log("First post URL:", postUrl);
  }
}

testFetchLatest().catch(console.error).finally(() => process.exit(0));
