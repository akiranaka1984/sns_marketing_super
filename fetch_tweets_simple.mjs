import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// X API設定を取得
const [settings] = await connection.execute(
  "SELECT bearerToken FROM x_api_settings WHERE userId = 1 ORDER BY createdAt DESC LIMIT 1"
);

if (!settings || settings.length === 0 || !settings[0].bearerToken) {
  console.error("Bearer token not found");
  process.exit(1);
}

const bearerToken = settings[0].bearerToken;

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
  await connection.end();
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
} else {
  console.log("No tweets found for @" + username);
}

await connection.end();
