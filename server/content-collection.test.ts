import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "./db";
import { users, collectionSchedules, collectedContents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Content Collection Feature", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-collection-${Date.now()}`,
        name: "Test Collection User",
        email: `test-collection-${Date.now()}@example.com`,
        loginMethod: "google",
      })
      .$returningId();
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(collectedContents).where(eq(collectedContents.userId, testUserId));
    await db.delete(collectionSchedules).where(eq(collectionSchedules.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should create collection schedule", async () => {
    const [schedule] = await db
      .insert(collectionSchedules)
      .values({
        userId: testUserId,
        platform: "twitter",
        targetUrl: "https://twitter.com/test",
        frequency: "daily",
        isActive: true,
      })
      .$returningId();

    expect(schedule.id).toBeDefined();

    const [created] = await db
      .select()
      .from(collectionSchedules)
      .where(eq(collectionSchedules.id, schedule.id));

    expect(created).toBeDefined();
    expect(created.platform).toBe("twitter");
    expect(created.targetUrl).toBe("https://twitter.com/test");
    expect(created.frequency).toBe("daily");
  });

  it("should collect content", async () => {
    const [content] = await db
      .insert(collectedContents)
      .values({
        userId: testUserId,
        platform: "twitter",
        sourceUrl: "https://twitter.com/test/status/123",
        content: "Test collected content",
        author: "test_author",
        collectedAt: new Date(),
      })
      .$returningId();

    expect(content.id).toBeDefined();

    const [created] = await db
      .select()
      .from(collectedContents)
      .where(eq(collectedContents.id, content.id));

    expect(created).toBeDefined();
    expect(created.content).toBe("Test collected content");
    expect(created.platform).toBe("twitter");
  });

  it("should list collected contents", async () => {
    const contents = await db
      .select()
      .from(collectedContents)
      .where(eq(collectedContents.userId, testUserId));

    expect(contents.length).toBeGreaterThan(0);
  });
});
