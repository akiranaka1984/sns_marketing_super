import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Projects API", () => {
  let testUserId: number;
  let testProjectId: number;
  let testAccountId: number;

  beforeAll(async () => {
    // Create a test user
    testUserId = 1; // Assuming user with ID 1 exists from auth tests
    
    // Create a test account
    testAccountId = await db.createAccount({
      userId: testUserId,
      platform: "twitter",
      username: "test_project_account",
      password: "test_password",
      status: "pending",
    });
  });

  it("should create a new project", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.projects.create({
      name: "Test Marketing Campaign",
      objective: "Increase brand awareness and gain 1000 followers",
      description: "Q1 2024 marketing campaign",
      targetFollowers: 1000,
      targetEngagementRate: 550, // 5.5%
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    testProjectId = result.id;
  });

  it("should list all projects", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const projects = await caller.projects.list();

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]).toHaveProperty("name");
    expect(projects[0]).toHaveProperty("objective");
  });

  it("should get project by ID", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const project = await caller.projects.byId({ id: testProjectId });

    expect(project).not.toBeNull();
    expect(project?.name).toBe("Test Marketing Campaign");
    expect(project?.objective).toBe("Increase brand awareness and gain 1000 followers");
    expect(project?.accounts).toBeDefined();
    expect(project?.strategies).toBeDefined();
    expect(project?.posts).toBeDefined();
  });

  it("should update project", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.projects.update({
      id: testProjectId,
      status: "active",
      targetFollowers: 2000,
    });

    expect(result.success).toBe(true);

    const updatedProject = await caller.projects.byId({ id: testProjectId });
    expect(updatedProject?.status).toBe("active");
    expect(updatedProject?.targetFollowers).toBe(2000);
  });

  it("should add account to project with persona", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.projects.addAccount({
      projectId: testProjectId,
      accountId: testAccountId,
      personaRole: "Technical Expert",
      personaTone: "Professional",
      personaCharacteristics: JSON.stringify({
        age: "30-40",
        interests: ["technology", "innovation"],
        expertise: "software development",
      }),
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");

    const project = await caller.projects.byId({ id: testProjectId });
    expect(project?.accounts.length).toBeGreaterThan(0);
    expect(project?.accounts[0].personaRole).toBe("Technical Expert");
    expect(project?.accounts[0].personaTone).toBe("Professional");
  });

  it("should create post for project", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.projects.createPost({
      projectId: testProjectId,
      accountId: testAccountId,
      content: "Exciting news! Our new product is launching soon. Stay tuned! #innovation #tech",
      hashtags: "#innovation #tech",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");

    const project = await caller.projects.byId({ id: testProjectId });
    expect(project?.posts.length).toBeGreaterThan(0);
    expect(project?.posts[0].content).toContain("Exciting news!");
  });

  it("should get posts by project", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const posts = await caller.projects.posts({ projectId: testProjectId });

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]).toHaveProperty("content");
    expect(posts[0]).toHaveProperty("status");
  });

  it("should delete project", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: "test", name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.projects.delete({ id: testProjectId });
    expect(result.success).toBe(true);

    const deletedProject = await caller.projects.byId({ id: testProjectId });
    expect(deletedProject).toBeNull();
  });
});
