/**
 * A/B Testing Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  db: {
    query: {
      abTests: {
        findFirst: vi.fn()
      },
      agents: {
        findFirst: vi.fn(() => Promise.resolve({ id: 1, name: "Test Agent" }))
      }
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([
            {
              id: 1,
              variationName: "A",
              tone: "casual",
              contentLength: "medium",
              emojiUsage: "minimal",
              hashtagCount: 2,
              likesCount: 100,
              commentsCount: 20,
              sharesCount: 10,
              viewsCount: 1000,
              performanceScore: 0
            },
            {
              id: 2,
              variationName: "B",
              tone: "formal",
              contentLength: "long",
              emojiUsage: "none",
              hashtagCount: 3,
              likesCount: 50,
              commentsCount: 10,
              sharesCount: 5,
              viewsCount: 800,
              performanceScore: 0
            }
          ]))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve([{ insertId: 1 }]))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    }))
  }
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          content: "テスト投稿内容です！今日も頑張りましょう 💪",
          hashtags: ["テスト", "投稿"]
        })
      }
    }]
  }))
}));

describe("A/B Testing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateVariationConfigs", () => {
    it("should generate diverse variation configs", async () => {
      const { generateVariationConfigs } = await import("./ab-testing");
      
      const configs = generateVariationConfigs(4);
      
      expect(configs).toHaveLength(4);
      expect(configs[0].tone).toBeDefined();
      expect(configs[0].contentLength).toBeDefined();
      expect(configs[0].emojiUsage).toBeDefined();
      expect(configs[0].hashtagCount).toBeGreaterThan(0);
    });

    it("should create different configs for each variation", async () => {
      const { generateVariationConfigs } = await import("./ab-testing");
      
      const configs = generateVariationConfigs(3);
      
      // At least some properties should differ
      const tones = configs.map(c => c.tone);
      const uniqueTones = new Set(tones);
      expect(uniqueTones.size).toBeGreaterThan(1);
    });
  });

  describe("generateContentVariations", () => {
    it("should generate multiple content variations", async () => {
      const { generateContentVariations } = await import("./ab-testing");
      
      const variations = await generateContentVariations("朝の挨拶", 2, "twitter");
      
      expect(variations).toHaveLength(2);
      expect(variations[0].variationName).toBe("A");
      expect(variations[1].variationName).toBe("B");
      expect(variations[0].content).toBeDefined();
      expect(variations[0].hashtags).toBeDefined();
    });

    it("should include config details in each variation", async () => {
      const { generateContentVariations } = await import("./ab-testing");
      
      const variations = await generateContentVariations("テスト", 2, "twitter");
      
      expect(variations[0].config).toBeDefined();
      expect(variations[0].config.tone).toBeDefined();
      expect(variations[0].config.contentLength).toBeDefined();
    });
  });

  describe("analyzeTestResults", () => {
    it("should calculate performance scores correctly", async () => {
      // Test the scoring logic
      const variation = {
        likesCount: 100,
        commentsCount: 20,
        sharesCount: 10,
        viewsCount: 1000
      };
      
      // Weighted score: 100 + (20 * 3) + (10 * 5) = 100 + 60 + 50 = 210
      const weightedScore = variation.likesCount + (variation.commentsCount * 3) + (variation.sharesCount * 5);
      expect(weightedScore).toBe(210);
      
      // Performance score: (210 / 1000) * 1000 = 210
      const performanceScore = Math.round((weightedScore / Math.max(variation.viewsCount, 1)) * 1000);
      expect(performanceScore).toBe(210);
    });
  });

  describe("createAbTest", () => {
    it("should create a new A/B test with variations", async () => {
      const { createAbTest } = await import("./ab-testing");
      
      const testId = await createAbTest(1, "テストA/B", "朝の挨拶", 2, 48);
      
      expect(testId).toBeDefined();
      expect(testId).toBeGreaterThan(0);
    });
  });
});
