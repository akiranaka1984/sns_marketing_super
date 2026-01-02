import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection, { schema, mode: "default" });

console.log("🌱 Seeding analytics data...");

// Get all accounts
const accounts = await db.select().from(schema.accounts);
console.log(`Found ${accounts.length} accounts`);

if (accounts.length === 0) {
  console.log("No accounts found. Please create accounts first.");
  process.exit(0);
}

// Generate sample analytics data for the past 30 days
const now = new Date();
const analyticsData = [];

for (const account of accounts) {
  // Generate 5-10 posts per account
  const postCount = Math.floor(Math.random() * 6) + 5;
  
  for (let i = 0; i < postCount; i++) {
    // Random date within the past 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const recordedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Generate random metrics
    const views = Math.floor(Math.random() * 10000) + 100;
    const likes = Math.floor(Math.random() * views * 0.1);
    const comments = Math.floor(Math.random() * likes * 0.2);
    const shares = Math.floor(Math.random() * likes * 0.1);
    const saves = Math.floor(Math.random() * likes * 0.15);
    const clicks = Math.floor(Math.random() * views * 0.05);
    const reach = Math.floor(views * (0.8 + Math.random() * 0.4));
    const impressions = Math.floor(views * (1.2 + Math.random() * 0.5));
    
    // Calculate engagement rate (percentage * 100)
    const totalEngagements = likes + comments + shares;
    const engagementRate = impressions > 0
      ? Math.round((totalEngagements / impressions) * 10000)
      : 0;
    
    analyticsData.push({
      postId: 60001 + i, // Dummy post ID
      accountId: account.id,
      platform: account.platform,
      viewsCount: views,
      likesCount: likes,
      commentsCount: comments,
      sharesCount: shares,
      savesCount: saves,
      clicksCount: clicks,
      engagementRate,
      reachCount: reach,
      impressionsCount: impressions,
      recordedAt,
    });
  }
}

console.log(`Generated ${analyticsData.length} analytics records`);

// Insert analytics data in batches
const batchSize = 100;
for (let i = 0; i < analyticsData.length; i += batchSize) {
  const batch = analyticsData.slice(i, i + batchSize);
  await db.insert(schema.postAnalytics).values(batch);
  console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(analyticsData.length / batchSize)}`);
}

console.log("✅ Analytics data seeded successfully!");

await connection.end();
process.exit(0);
