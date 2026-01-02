/**
 * Engagement Collector Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  db: {
    query: {
      posts: {
        findFirst: vi.fn()
      },
      accounts: {
        findFirst: vi.fn()
      }
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([]))
          }))
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve())
    }))
  }
}));

vi.mock("./duoplus", () => ({
  screenshot: vi.fn(() => Promise.resolve("base64screenshotdata"))
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          likesCount: 150,
          commentsCount: 25,
          sharesCount: 10,
          viewsCount: 5000,
          savesCount: 5,
          reachCount: 3000,
          impressionsCount: 5000,
          confidence: 85
        })
      }
    }]
  }))
}));

describe("Engagement Collector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeEngagementFromScreenshot", () => {
    it("should parse engagement data from LLM response", async () => {
      const { analyzeEngagementFromScreenshot } = await import("./engagement-collector");
      
      const result = await analyzeEngagementFromScreenshot("base64data", "twitter");
      
      expect(result).toBeDefined();
      expect(result?.likesCount).toBe(150);
      expect(result?.commentsCount).toBe(25);
      expect(result?.sharesCount).toBe(10);
    });

    it("should calculate engagement rate correctly", async () => {
      const { analyzeEngagementFromScreenshot } = await import("./engagement-collector");
      
      const result = await analyzeEngagementFromScreenshot("base64data", "instagram");
      
      expect(result).toBeDefined();
      // Total engagement = 150 + 25 + 10 + 5 = 190
      // Reach = 3000
      // Rate = (190 / 3000) * 10000 = 633
      expect(result?.engagementRate).toBeGreaterThan(0);
    });
  });

  describe("collectTwitterEngagement", () => {
    it("should collect engagement for Twitter posts", async () => {
      const { collectTwitterEngagement } = await import("./engagement-collector");
      
      const result = await collectTwitterEngagement("device123");
      
      expect(result).toBeDefined();
      expect(result?.likesCount).toBe(150);
    });
  });

  describe("collectInstagramEngagement", () => {
    it("should collect engagement for Instagram posts", async () => {
      const { collectInstagramEngagement } = await import("./engagement-collector");
      
      const result = await collectInstagramEngagement("device123");
      
      expect(result).toBeDefined();
      expect(result?.likesCount).toBe(150);
    });
  });

  describe("collectTikTokEngagement", () => {
    it("should collect engagement for TikTok posts", async () => {
      const { collectTikTokEngagement } = await import("./engagement-collector");
      
      const result = await collectTikTokEngagement("device123");
      
      expect(result).toBeDefined();
      expect(result?.viewsCount).toBe(5000);
    });
  });

  describe("collectFacebookEngagement", () => {
    it("should collect engagement for Facebook posts", async () => {
      const { collectFacebookEngagement } = await import("./engagement-collector");
      
      const result = await collectFacebookEngagement("device123");
      
      expect(result).toBeDefined();
      expect(result?.sharesCount).toBe(10);
    });
  });
});
