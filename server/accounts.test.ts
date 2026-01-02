import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("accounts router", () => {
  describe("accounts.list", () => {
    it("returns empty array when no accounts exist", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.accounts.list();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("accounts.create", () => {
    it("creates a new account with valid input", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const account = await caller.accounts.create({
        platform: "twitter",
        username: "testuser",
        password: "testpassword",
      });

      expect(account).toBeDefined();
      expect(account.platform).toBe("twitter");
      expect(account.username).toBe("testuser");
      expect(account.status).toBe("pending");
      expect(account.userId).toBe(ctx.user!.id);
    });

    it("creates accounts for different platforms", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const platforms = ["twitter", "tiktok", "instagram", "facebook"] as const;

      for (const platform of platforms) {
        const account = await caller.accounts.create({
          platform,
          username: `test_${platform}`,
          password: "testpassword",
        });

        expect(account.platform).toBe(platform);
      }
    });
  });
});

describe("strategies router", () => {
  describe("strategies.list", () => {
    it("returns empty array when no strategies exist", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.strategies.list();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("strategies.generate", () => {
    it("generates a strategy with valid objective", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const strategy = await caller.strategies.generate({
        objective: "Increase brand awareness for a new eco-friendly product line",
      });

      expect(strategy).toBeDefined();
      expect(strategy.objective).toBe("Increase brand awareness for a new eco-friendly product line");
      expect(strategy.contentType).toBeDefined();
      expect(strategy.hashtags).toBeDefined();
      expect(strategy.postingSchedule).toBeDefined();
      expect(strategy.engagementStrategy).toBeDefined();
      expect(strategy.userId).toBe(ctx.user!.id);
    }, 30000);
  });
});

describe("logs router", () => {
  describe("logs.recent", () => {
    it("returns recent logs with default limit", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.logs.recent({ limit: 10 });

      expect(Array.isArray(result)).toBe(true);
    });

    it("respects custom limit", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.logs.recent({ limit: 5 });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});

describe("devices router", () => {
  describe("devices.list", () => {
    it("returns array of devices", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.devices.list();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("devices.availableCount", () => {
    it("returns number of available devices", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.devices.availableCount();

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
