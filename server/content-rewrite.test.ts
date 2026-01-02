import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "./db";
import { users, agents, contentRewrites } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Content Rewrite Feature", () => {
  let testUserId: number;
  let testAgentId: number;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-rewrite-${Date.now()}`,
        name: "Test Rewrite User",
        email: `test-rewrite-${Date.now()}@example.com`,
        loginMethod: "google",
      })
      .$returningId();
    testUserId = user.id;

    // Create test agent
    const [agent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Test Agent",
        theme: "Technology",
        tone: "professional",
        style: "tutorial",
        targetAudience: "Developers",
        description: "Test agent for rewriting",
      })
      .$returningId();
    testAgentId = agent.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(contentRewrites).where(eq(contentRewrites.userId, testUserId));
    await db.delete(agents).where(eq(agents.id, testAgentId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should create rewrite record", async () => {
    const [rewrite] = await db
      .insert(contentRewrites)
      .values({
        userId: testUserId,
        agentId: testAgentId,
        originalContent: "Original content for testing",
        rewrittenContent: "Rewritten content with professional tone",
        status: "completed",
      })
      .$returningId();

    expect(rewrite.id).toBeDefined();

    const [created] = await db
      .select()
      .from(contentRewrites)
      .where(eq(contentRewrites.id, rewrite.id));

    expect(created).toBeDefined();
    expect(created.originalContent).toBe("Original content for testing");
    expect(created.rewrittenContent).toBe("Rewritten content with professional tone");
    expect(created.status).toBe("completed");
  });

  it("should list rewrites", async () => {
    const rewrites = await db
      .select()
      .from(contentRewrites)
      .where(eq(contentRewrites.userId, testUserId));

    expect(rewrites.length).toBeGreaterThan(0);
  });
});
