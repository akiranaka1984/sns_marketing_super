import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { db } from "./db";
import { agents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("AI Agent Generation", () => {
  const caller = appRouter.createCaller({
    user: {
      id: 1,
      openId: "test-open-id",
      name: "Test User",
      email: "test@example.com",
      role: "admin",
      loginMethod: "google",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });

  // Clean up test agents before tests
  beforeAll(async () => {
    await db.delete(agents).where(eq(agents.userId, 1));
  });

  it("should generate multiple agents with AI", async () => {
    const result = await caller.agents.generateAgents({
      count: 3,
      industry: "Technology",
      targetPlatforms: ["twitter", "instagram"],
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(result.agents).toHaveLength(3);

    // Verify agents were created in database
    const createdAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, 1));

    expect(createdAgents.length).toBeGreaterThanOrEqual(3);

    // Check that agents have required fields
    for (const agent of createdAgents.slice(0, 3)) {
      expect(agent.name).toBeTruthy();
      expect(agent.theme).toBeTruthy();
      expect(agent.tone).toBeTruthy();
      expect(agent.style).toBeTruthy();
      expect(agent.targetAudience).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.postingFrequency).toBeTruthy();
      expect(agent.postingTimeSlots).toBeTruthy();

      // Verify posting time slots is valid JSON array
      const timeSlots = JSON.parse(agent.postingTimeSlots!);
      expect(Array.isArray(timeSlots)).toBe(true);
      expect(timeSlots.length).toBeGreaterThan(0);
    }
  }, 30000); // 30 second timeout for AI generation

  it("should create agent with posting schedule", async () => {
    const result = await caller.agents.create({
      name: "Test Scheduled Agent",
      theme: "Daily Tech News",
      tone: "professional",
      style: "news",
      targetAudience: "Tech professionals",
      description: "Delivers daily tech news updates",
      postingFrequency: "twice_daily",
      postingTimeSlots: ["09:00", "18:00"],
    });

    expect(result.id).toBeTruthy();

    // Verify agent was created with schedule
    const agent = await caller.agents.getById({ id: result.id });
    expect(agent.postingFrequency).toBe("twice_daily");
    
    const timeSlots = JSON.parse(agent.postingTimeSlots!);
    expect(timeSlots).toEqual(["09:00", "18:00"]);
  });

  it("should update agent schedule", async () => {
    // Create an agent first
    const createResult = await caller.agents.create({
      name: "Schedule Update Test",
      theme: "Test Theme",
      tone: "casual",
      style: "story",
    });

    // Update the schedule
    const updateResult = await caller.agents.updateSchedule({
      id: createResult.id,
      postingFrequency: "three_times_daily",
      postingTimeSlots: ["08:00", "14:00", "20:00"],
      isActive: true,
    });

    expect(updateResult.success).toBe(true);

    // Verify the update
    const agent = await caller.agents.getById({ id: createResult.id });
    expect(agent.postingFrequency).toBe("three_times_daily");
    
    const timeSlots = JSON.parse(agent.postingTimeSlots!);
    expect(timeSlots).toEqual(["08:00", "14:00", "20:00"]);
    expect(agent.isActive).toBe(true);
  });

  it("should toggle agent active status", async () => {
    // Create an agent
    const createResult = await caller.agents.create({
      name: "Toggle Test Agent",
      theme: "Test Theme",
    });

    // Deactivate
    await caller.agents.updateSchedule({
      id: createResult.id,
      isActive: false,
    });

    let agent = await caller.agents.getById({ id: createResult.id });
    expect(agent.isActive).toBe(false);

    // Reactivate
    await caller.agents.updateSchedule({
      id: createResult.id,
      isActive: true,
    });

    agent = await caller.agents.getById({ id: createResult.id });
    expect(agent.isActive).toBe(true);
  });

  it("should list all agents with schedule info", async () => {
    const agents = await caller.agents.list();

    expect(agents.length).toBeGreaterThan(0);

    // Check that agents have schedule fields
    for (const agent of agents) {
      expect(agent.postingFrequency).toBeTruthy();
      expect(agent.postingTimeSlots).toBeTruthy();
      expect(typeof agent.isActive).toBe("boolean");
    }
  });
});
