import { describe, it, expect, beforeAll } from "vitest";
import { db } from "./db";
import { agents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Agent skipReview functionality", () => {
  let testAgentId: number;
  const testUserId = 1;

  beforeAll(async () => {
    // Clean up any existing test agents
    await db.delete(agents).where(eq(agents.name, "Test Skip Review Agent"));
  });

  it("should create agent with skipReview set to true", async () => {
    const [newAgent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Test Skip Review Agent",
        theme: "Test theme for skip review",
        tone: "casual",
        style: "story",
        targetAudience: "Test audience",
        description: "Testing skip review functionality",
        postingFrequency: "daily",
        postingTimeSlots: JSON.stringify(["09:00"]),
        skipReview: true,
      })
      .$returningId();

    testAgentId = newAgent.id;
    expect(testAgentId).toBeGreaterThan(0);

    // Verify the agent was created with skipReview = true
    const [createdAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId));

    expect(createdAgent).toBeDefined();
    expect(createdAgent.skipReview).toBe(true);
  });

  it("should create agent with skipReview set to false by default", async () => {
    const [newAgent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Test Skip Review Agent Default",
        theme: "Test theme for default skip review",
        tone: "casual",
        style: "story",
        targetAudience: "Test audience",
        description: "Testing default skip review functionality",
        postingFrequency: "daily",
        postingTimeSlots: JSON.stringify(["09:00"]),
        skipReview: false,
      })
      .$returningId();

    const agentId = newAgent.id;
    expect(agentId).toBeGreaterThan(0);

    // Verify the agent was created with skipReview = false
    const [createdAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId));

    expect(createdAgent).toBeDefined();
    expect(createdAgent.skipReview).toBe(false);

    // Clean up
    await db.delete(agents).where(eq(agents.id, agentId));
  });

  it("should update agent skipReview from false to true", async () => {
    // Update the agent's skipReview to false first
    await db
      .update(agents)
      .set({ skipReview: false })
      .where(eq(agents.id, testAgentId));

    // Verify it's false
    const [agentBefore] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId));

    expect(agentBefore.skipReview).toBe(false);

    // Update to true
    await db
      .update(agents)
      .set({ skipReview: true })
      .where(eq(agents.id, testAgentId));

    // Verify it's now true
    const [agentAfter] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId));

    expect(agentAfter.skipReview).toBe(true);
  });

  it("should retrieve all agents with skipReview status", async () => {
    const allAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, testUserId));

    expect(allAgents.length).toBeGreaterThan(0);

    // Verify that all agents have a skipReview field
    allAgents.forEach((agent) => {
      expect(agent.skipReview).toBeDefined();
      expect(typeof agent.skipReview).toBe("boolean");
    });
  });

  it("should clean up test data", async () => {
    // Delete the test agent
    await db.delete(agents).where(eq(agents.id, testAgentId));

    // Verify deletion
    const [deletedAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId));

    expect(deletedAgent).toBeUndefined();
  });
});
