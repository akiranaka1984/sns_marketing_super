import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateContent } from "./agent-engine";

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          content: "これはテスト投稿です。全角文字が含まれています。",
          hashtags: ["テスト", "投稿"],
          confidence: 80,
          reasoning: "テスト用の投稿です"
        })
      }
    }]
  }))
}));

describe("Character Limit Tests", () => {
  const mockContext = {
    agent: {
      id: 1,
      userId: 1,
      name: "テストエージェント",
      theme: "テストテーマ",
      tone: "casual" as const,
      style: "story" as const,
      targetAudience: "一般",
      contentFormat: null,
      isActive: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postingFrequency: "daily" as const,
      postingTimeSlots: null,
      skipReview: 0,
      projectId: null,
      description: null
    },
    knowledge: [],
    rules: [],
    recentPosts: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateContent with character limits", () => {
    it("デフォルトで280文字制限が適用される", async () => {
      const result = await generateContent(mockContext);
      
      // 文字数計算関数（全角文字は2文字としてカウント）
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      const charCount = calculateCharCount(result.content);
      expect(charCount).toBeLessThanOrEqual(280);
    });

    it("カスタム文字数制限が適用される", async () => {
      const customLimit = 100;
      const result = await generateContent(mockContext, customLimit);
      
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      const charCount = calculateCharCount(result.content);
      expect(charCount).toBeLessThanOrEqual(customLimit);
    });

    it("全角文字が正しく2文字としてカウントされる", () => {
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      // 全角文字のみ
      expect(calculateCharCount("あいうえお")).toBe(10); // 5文字 × 2 = 10
      
      // 半角文字のみ
      expect(calculateCharCount("hello")).toBe(5); // 5文字 × 1 = 5
      
      // 混在
      expect(calculateCharCount("こんにちは world")).toBe(16); // (5 × 2) + 1 + (5 × 1) = 16
    });

    it("長いコンテンツが制限内に切り詰められる", async () => {
      // 長いコンテンツを返すようにモック
      const { invokeLLM } = await import("./_core/llm");
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              content: "あ".repeat(200), // 全角文字200文字 = 400カウント（280制限を超える）
              hashtags: ["テスト"],
              confidence: 80,
              reasoning: "長いコンテンツのテスト"
            })
          }
        }]
      });

      const result = await generateContent(mockContext);
      
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      const charCount = calculateCharCount(result.content);
      expect(charCount).toBeLessThanOrEqual(280);
      expect(result.content).toContain("..."); // 切り詰められた証拠
    });
  });

  describe("Character counting accuracy", () => {
    it("日本語文字が正しくカウントされる", () => {
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      expect(calculateCharCount("ひらがな")).toBe(8); // 4文字 × 2
      expect(calculateCharCount("カタカナ")).toBe(8); // 4文字 × 2
      expect(calculateCharCount("漢字")).toBe(4); // 2文字 × 2
    });

    it("記号と数字が正しくカウントされる", () => {
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      expect(calculateCharCount("123")).toBe(3); // 半角数字
      expect(calculateCharCount("!@#")).toBe(3); // 半角記号
      expect(calculateCharCount("。、")).toBe(4); // 全角句読点 × 2
    });

    it("空文字列が0としてカウントされる", () => {
      const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
          count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        }
        return count;
      };

      expect(calculateCharCount("")).toBe(0);
    });
  });
});
