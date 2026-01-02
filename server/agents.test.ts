import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { agents, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("SNS Agents (Persona Management)", () => {
  let testUserId: number;

  beforeEach(async () => {
    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-agent-user-${Date.now()}`,
        name: "Agent Test User",
        email: "agent-test@example.com",
      })
      .$returningId();
    testUserId = user.id;
  });

  it("should create a new agent with required fields", async () => {
    const [newAgent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Tech Influencer",
        theme: "Latest Technology and Gadget Reviews",
        tone: "casual",
        style: "review",
      })
      .$returningId();

    expect(newAgent.id).toBeDefined();

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, newAgent.id));

    expect(agent).toBeDefined();
    expect(agent.name).toBe("Tech Influencer");
    expect(agent.theme).toBe("Latest Technology and Gadget Reviews");
    expect(agent.tone).toBe("casual");
    expect(agent.style).toBe("review");
    expect(agent.userId).toBe(testUserId);
  });

  it("should create an agent with all optional fields", async () => {
    const [newAgent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Fitness Coach",
        theme: "Health and Wellness Tips",
        tone: "friendly",
        style: "tutorial",
        targetAudience: "25-40 year old fitness enthusiasts",
        description: "A friendly fitness coach sharing workout tips and nutrition advice",
      })
      .$returningId();

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, newAgent.id));

    expect(agent.targetAudience).toBe("25-40 year old fitness enthusiasts");
    expect(agent.description).toBe(
      "A friendly fitness coach sharing workout tips and nutrition advice"
    );
  });

  it("should list all agents for a user", async () => {
    // Create multiple agents
    await db.insert(agents).values([
      {
        userId: testUserId,
        name: "Agent 1",
        theme: "Theme 1",
        tone: "formal",
        style: "news",
      },
      {
        userId: testUserId,
        name: "Agent 2",
        theme: "Theme 2",
        tone: "humorous",
        style: "trivia",
      },
      {
        userId: testUserId,
        name: "Agent 3",
        theme: "Theme 3",
        tone: "professional",
        style: "ranking",
      },
    ]);

    const userAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, testUserId));

    expect(userAgents.length).toBeGreaterThanOrEqual(3);
    expect(userAgents.map((a) => a.name)).toContain("Agent 1");
    expect(userAgents.map((a) => a.name)).toContain("Agent 2");
    expect(userAgents.map((a) => a.name)).toContain("Agent 3");
  });

  it("should update an agent", async () => {
    const [newAgent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Original Name",
        theme: "Original Theme",
        tone: "casual",
        style: "story",
      })
      .$returningId();

    await db
      .update(agents)
      .set({
        name: "Updated Name",
        theme: "Updated Theme",
        tone: "professional",
      })
      .where(eq(agents.id, newAgent.id));

    const [updatedAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, newAgent.id));

    expect(updatedAgent.name).toBe("Updated Name");
    expect(updatedAgent.theme).toBe("Updated Theme");
    expect(updatedAgent.tone).toBe("professional");
    expect(updatedAgent.style).toBe("story"); // Should remain unchanged
  });

  it("should delete an agent", async () => {
    const [newAgent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "To Be Deleted",
        theme: "Delete Me",
        tone: "casual",
        style: "story",
      })
      .$returningId();

    await db.delete(agents).where(eq(agents.id, newAgent.id));

    const deletedAgent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, newAgent.id));

    expect(deletedAgent.length).toBe(0);
  });

  it("should support all tone options", async () => {
    const tones: Array<"formal" | "casual" | "friendly" | "professional" | "humorous"> = [
      "formal",
      "casual",
      "friendly",
      "professional",
      "humorous",
    ];

    for (const tone of tones) {
      const [agent] = await db
        .insert(agents)
        .values({
          userId: testUserId,
          name: `Agent ${tone}`,
          theme: `Theme ${tone}`,
          tone,
          style: "story",
        })
        .$returningId();

      const [createdAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agent.id));

      expect(createdAgent.tone).toBe(tone);
    }
  });

  it("should support all style options", async () => {
    const styles: Array<"ranking" | "trivia" | "story" | "tutorial" | "news" | "review"> = [
      "ranking",
      "trivia",
      "story",
      "tutorial",
      "news",
      "review",
    ];

    for (const style of styles) {
      const [agent] = await db
        .insert(agents)
        .values({
          userId: testUserId,
          name: `Agent ${style}`,
          theme: `Theme ${style}`,
          tone: "casual",
          style,
        })
        .$returningId();

      const [createdAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agent.id));

      expect(createdAgent.style).toBe(style);
    }
  });

  it("should link agent to a project", async () => {
    // Note: This test assumes projects table exists
    // If you want to test project linking, you'll need to create a test project first
    const [agent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Project Agent",
        theme: "Project Theme",
        tone: "casual",
        style: "story",
        projectId: null, // Can be linked to a project
      })
      .$returningId();

    const [createdAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agent.id));

    expect(createdAgent.projectId).toBeNull();
  });

  it("should have default values for isActive", async () => {
    const [agent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Active Agent",
        theme: "Active Theme",
        tone: "casual",
        style: "story",
      })
      .$returningId();

    const [createdAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agent.id));

    expect(createdAgent.isActive).toBe(true);
  });

  it("should have timestamps", async () => {
    const [agent] = await db
      .insert(agents)
      .values({
        userId: testUserId,
        name: "Timestamped Agent",
        theme: "Timestamp Theme",
        tone: "casual",
        style: "story",
      })
      .$returningId();

    const [createdAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agent.id));

    expect(createdAgent.createdAt).toBeDefined();
    expect(createdAgent.updatedAt).toBeDefined();
    expect(createdAgent.createdAt instanceof Date).toBe(true);
    expect(createdAgent.updatedAt instanceof Date).toBe(true);
  });
});
