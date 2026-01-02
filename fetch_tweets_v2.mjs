import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// X API設定を取得（カラム名を確認）
const [settings] = await connection.execute(
  "SELECT * FROM x_api_settings LIMIT 1"
);

console.log("Settings found:", settings.length);

if (!settings || settings.length === 0) {
  console.error("No X API settings found");
  await connection.end();
  process.exit(1);
}

const setting = settings[0];
console.log("Setting keys:", Object.keys(setting));

// apiKeyフィールドを使用（スキーマではbearerTokenではなくapiKeyの可能性）
const bearerToken = setting.apiKey || setting.bearerToken;

if (!bearerToken) {
  console.error("Bearer token not found in settings");
  await connection.end();
  process.exit(1);
}

// @muran95271の投稿を検索
const username = "muran95271";
const query = `from:${username} -is:retweet -is:reply`;
const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id`;

console.log("\nFetching tweets for @" + username + "...\n");

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
  if (data.meta) {
    console.log("Meta:", JSON.stringify(data.meta, null, 2));
  }
}

await connection.end();
