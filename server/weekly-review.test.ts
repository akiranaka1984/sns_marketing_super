import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "./db";
import { users, weeklyReviews } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Weekly Review Feature", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-review-${Date.now()}`,
        name: "Test Review User",
        email: `test-review-${Date.now()}@example.com`,
        loginMethod: "google",
      })
      .$returningId();
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(weeklyReviews).where(eq(weeklyReviews.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should create weekly review", async () => {
    const weekStart = new Date("2025-12-01");
    const weekEnd = new Date("2025-12-07");

    const [review] = await db
      .insert(weeklyReviews)
      .values({
        userId: testUserId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        totalPosts: 10,
        totalViews: 5000,
        totalLikes: 250,
        avgEngagement: 5.0,
        insights: JSON.stringify({
          topPerformingContent: "Tutorial posts performed best",
          engagementTrends: "Engagement increased by 20%",
        }),
        recommendations: JSON.stringify({
          contentStrategy: ["Post more tutorials", "Focus on video content"],
          postingSchedule: ["Post at 9 AM and 6 PM"],
        }),
      })
      .$returningId();

    expect(review.id).toBeDefined();

    const [created] = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.id, review.id));

    expect(created).toBeDefined();
    expect(created.totalPosts).toBe(10);
    expect(created.totalViews).toBe(5000);
    expect(created.avgEngagement).toBe(5.0);
  });

  it("should list weekly reviews", async () => {
    const reviews = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, testUserId));

    expect(reviews.length).toBeGreaterThan(0);
  });
});
