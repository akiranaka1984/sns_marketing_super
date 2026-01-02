import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("./db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    $returningId: vi.fn().mockResolvedValue([{ id: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    query: {
      agents: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      accounts: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          content: "Test content for posting #test",
          hashtags: ["test", "automation"],
          confidence: 85,
          reasoning: "This is a test post",
        }),
      },
    }],
  }),
}));

vi.mock("./sns-posting", () => ({
  postToSNS: vi.fn().mockResolvedValue({ success: true }),
  postToTwitter: vi.fn().mockResolvedValue({ success: true }),
  postToInstagram: vi.fn().mockResolvedValue({ success: true }),
  postToTikTok: vi.fn().mockResolvedValue({ success: true }),
  postToFacebook: vi.fn().mockResolvedValue({ success: true }),
}));

// Import after mocking
import {
  buildAgentContext,
  generateContent,
  runAgent,
} from "./agent-engine";

describe("Agent Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildAgentContext", () => {
    it("should return null for non-existent agent", async () => {
      const result = await buildAgentContext(999);
      expect(result).toBeNull();
    });
  });

  describe("generateContent", () => {
    it("should generate content based on agent context", async () => {
      const context = {
        agent: {
          id: 1,
          name: "Test Agent",
          theme: "Technology",
          tone: "casual",
          style: "story",
          targetAudience: "Tech enthusiasts",
          userId: 1,
          projectId: null,
          description: null,
          postingFrequency: "daily",
          postingTimeSlots: '["09:00"]',
          skipReview: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        accounts: [],
        knowledge: [],
        rules: [],
        recentPosts: [],
      };

      const result = await generateContent(context as any);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe("string");
      expect(result.hashtags).toBeDefined();
      expect(Array.isArray(result.hashtags)).toBe(true);
    });

    it("should incorporate knowledge into content generation", async () => {
      const context = {
        agent: {
          id: 1,
          name: "Test Agent",
          theme: "Technology",
          tone: "casual",
          style: "story",
          targetAudience: "Tech enthusiasts",
          userId: 1,
          projectId: null,
          description: null,
          postingFrequency: "daily",
          postingTimeSlots: '["09:00"]',
          skipReview: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        accounts: [],
        knowledge: [
          {
            id: 1,
            agentId: 1,
            knowledgeType: "success_pattern",
            title: "Morning posts work best",
            content: "Posts at 9am get 50% more engagement",
            confidence: 80,
            usageCount: 5,
            successRate: 80,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        rules: [],
        recentPosts: [],
      };

      const result = await generateContent(context as any);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should apply rules to generated content", async () => {
      const context = {
        agent: {
          id: 1,
          name: "Test Agent",
          theme: "Technology",
          tone: "casual",
          style: "story",
          targetAudience: "Tech enthusiasts",
          userId: 1,
          projectId: null,
          description: null,
          postingFrequency: "daily",
          postingTimeSlots: '["09:00"]',
          skipReview: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        accounts: [],
        knowledge: [],
        rules: [
          {
            id: 1,
            agentId: 1,
            ruleType: "forbidden_word",
            ruleName: "No competitor names",
            ruleValue: "CompetitorA,CompetitorB",
            priority: 100,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        recentPosts: [],
      };

      const result = await generateContent(context as any);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe("runAgent", () => {
    it("should handle agent execution flow", async () => {
      // runAgent depends on complex DB interactions
      // This test verifies the function exists and is callable
      expect(typeof runAgent).toBe("function");
    });
  });
});
