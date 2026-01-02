const bearerToken = "AAAAAAAAAAAAAAAAAMpn6QEAAAAAwgRxZP9C9mbly%2B%2FN4dpppyY2TZI%3DK4ZLelBQsP0MwPjepxhudSLgqadKnDeJcXPcXff2uNsYVgrPRf";

// @muran95271の投稿を検索
const username = "muran95271";
const query = `from:${username} -is:retweet -is:reply`;
const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id`;

console.log("Fetching tweets for @" + username + "...\n");

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${bearerToken}`,
  },
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error("API Error:", response.status, JSON.stringify(errorData, null, 2));
  process.exit(1);
}

const data = await response.json();

if (data.data && data.data.length > 0) {
  console.log(`Found ${data.data.length} tweets:\n`);
  data.data.forEach((tweet, index) => {
    console.log(`--- Tweet ${index + 1} ---`);
    console.log(`ID: ${tweet.id}`);
    console.log(`Created: ${tweet.created_at}`);
    console.log(`Text: ${tweet.text}`);
    console.log(`URL: https://twitter.com/${username}/status/${tweet.id}`);
    console.log();
  });
  
  // JSON形式でも出力
  console.log("\n=== JSON Output ===");
  console.log(JSON.stringify(data.data, null, 2));
} else {
  console.log("No tweets found for @" + username);
  if (data.meta) {
    console.log("Meta:", JSON.stringify(data.meta, null, 2));
  }
}
