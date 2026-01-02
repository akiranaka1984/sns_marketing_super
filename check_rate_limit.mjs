const bearerToken = "AAAAAAAAAAAAAAAAAAAAAMpn6QEAAAAA2KcI2hOObE36xIqCezXBuDW8Ot0%3DjEkya7EjfXNZ9OXn1le4OiS5S2odmSRo457crzb5qbLJdzgzsk";

const username = "muran95271";
const query = `from:${username} -is:retweet -is:reply`;
const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id`;

console.log("Checking Rate Limit for @" + username + "...\n");

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${bearerToken}`,
  },
});

console.log("Response Status:", response.status);
console.log("\n=== Rate Limit Headers ===");
console.log("x-rate-limit-limit:", response.headers.get("x-rate-limit-limit"));
console.log("x-rate-limit-remaining:", response.headers.get("x-rate-limit-remaining"));
console.log("x-rate-limit-reset:", response.headers.get("x-rate-limit-reset"));

const resetTime = response.headers.get("x-rate-limit-reset");
if (resetTime) {
  const resetDate = new Date(parseInt(resetTime) * 1000);
  console.log("Reset Time:", resetDate.toLocaleString("ja-JP"));
  const now = new Date();
  const minutesUntilReset = Math.ceil((resetDate - now) / 1000 / 60);
  console.log("Minutes until reset:", minutesUntilReset);
}

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.log("\n=== Error Response ===");
  console.log(JSON.stringify(errorData, null, 2));
} else {
  const data = await response.json();
  console.log("\n=== Success ===");
  console.log("Tweets found:", data.data?.length || 0);
}
