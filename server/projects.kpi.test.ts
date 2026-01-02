import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCaller(user: AuthenticatedUser) {
  const ctx: TrpcContext = {
    user,
    req: {} as any,
    res: {} as any,
  };
  return appRouter.createCaller(ctx);
}

describe("Projects KPI Targets", () => {
  let testUserId: number;
  let testProjectId: number;

  beforeAll(async () => {
    // Create test user
    testUserId = await db.upsertUser({
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
    });
  });

  it("should create project with flexible KPI targets", async () => {
    const caller = createCaller({
      id: testUserId,
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
      role: "admin",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const result = await caller.projects.create({
      name: "KPI Test Project",
      objective: "Test flexible KPI targets",
      description: "Testing multiple KPI types",
      targets: {
        followers: 1000,
        clicks: 500,
        engagement: 5.5,
        conversions: 100,
        url: "https://example.com",
      },
    });

    expect(result.id).toBeTypeOf("number");
    testProjectId = result.id;
  });

  it("should retrieve project with parsed KPI targets", async () => {
    const caller = createCaller({
      id: testUserId,
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
      role: "admin",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const project = await caller.projects.byId({ id: testProjectId });

    expect(project).toBeDefined();
    expect(project?.name).toBe("KPI Test Project");
    expect(project?.targets).toBeTypeOf("string");

    // Parse targets JSON
    const targets = JSON.parse(project!.targets!);
    expect(targets.followers).toBe(1000);
    expect(targets.clicks).toBe(500);
    expect(targets.engagement).toBe(5.5);
    expect(targets.conversions).toBe(100);
    expect(targets.url).toBe("https://example.com");
  });

  it("should create project with partial KPI targets", async () => {
    const caller = createCaller({
      id: testUserId,
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
      role: "admin",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const result = await caller.projects.create({
      name: "Partial KPI Project",
      objective: "Test partial KPI targets",
      targets: {
        clicks: 300,
        url: "https://test.com",
      },
    });

    expect(result.id).toBeTypeOf("number");

    const project = await caller.projects.byId({ id: result.id });
    const targets = JSON.parse(project!.targets!);
    
    expect(targets.clicks).toBe(300);
    expect(targets.url).toBe("https://test.com");
    expect(targets.followers).toBeUndefined();
    expect(targets.conversions).toBeUndefined();
  });

  it("should create project without any KPI targets", async () => {
    const caller = createCaller({
      id: testUserId,
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
      role: "admin",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const result = await caller.projects.create({
      name: "No KPI Project",
      objective: "Test project without KPI targets",
    });

    expect(result.id).toBeTypeOf("number");

    const project = await caller.projects.byId({ id: result.id });
    expect(project?.targets).toBeNull();
  });

  it("should update project KPI targets", async () => {
    const caller = createCaller({
      id: testUserId,
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
      role: "admin",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    await caller.projects.update({
      id: testProjectId,
      targets: {
        followers: 2000,
        clicks: 1000,
        engagement: 7.5,
      },
    });

    const project = await caller.projects.byId({ id: testProjectId });
    const targets = JSON.parse(project!.targets!);

    expect(targets.followers).toBe(2000);
    expect(targets.clicks).toBe(1000);
    expect(targets.engagement).toBe(7.5);
  });

  it("should list projects with KPI targets", async () => {
    const caller = createCaller({
      id: testUserId,
      openId: "test-kpi-user",
      name: "Test KPI User",
      email: "kpi@test.com",
      role: "admin",
      loginMethod: "manus" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const projects = await caller.projects.list();

    expect(projects.length).toBeGreaterThan(0);
    
    const projectWithTargets = projects.find((p) => p.id === testProjectId);
    expect(projectWithTargets).toBeDefined();
    expect(projectWithTargets?.targets).toBeTypeOf("string");

    const targets = JSON.parse(projectWithTargets!.targets!);
    expect(targets).toHaveProperty("followers");
    expect(targets).toHaveProperty("clicks");
  });
});
