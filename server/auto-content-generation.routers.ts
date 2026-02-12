import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { agents, posts, accounts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Auto Content Generation Router
 * Generates post content based on agent settings
 */
export const autoContentGenerationRouter = router({
  /**
   * Generate content for a specific agent
   */
  generateForAgent: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      count: z.number().min(1).max(10).default(1), // Number of posts to generate
    }))
    .mutation(async ({ input }) => {
      const { agentId, count } = input;

      // Get agent details
      const agent = await db.query.agents.findFirst({
        where: eq(agents.id, agentId),
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Build prompt based on agent settings
      const prompt = buildPromptFromAgent(agent);

      // Generate content using AI
      const generatedPosts = [];
      for (let i = 0; i < count; i++) {
        try {
          const content = await generateContent(prompt, agent);
          
          // Save to posts table
          await db.insert(posts).values({
            content,
            platform: "twitter", // Default platform, can be customized
            status: agent.skipReview ? "approved" : "pending_review",
            agentId,
            createdAt: toMySQLTimestamp(new Date()),
            updatedAt: toMySQLTimestamp(new Date()),
          });
          const newPost = { content, platform: "twitter", status: agent.skipReview ? "approved" : "pending_review", agentId };

          generatedPosts.push(newPost);
        } catch (error: any) {
          console.error(`[AutoContentGeneration] Failed to generate post ${i + 1}:`, error.message);
        }
      }

      return {
        success: true,
        generated: generatedPosts.length,
        posts: generatedPosts,
      };
    }),

  /**
   * Generate content for all active agents
   */
  generateForAllAgents: protectedProcedure
    .mutation(async () => {
      // Get all active agents
      const activeAgents = await db.query.agents.findMany({
        where: eq(agents.isActive, 1),
      });

      const results = [];
      for (const agent of activeAgents) {
        try {
          // Generate 1 post per agent
          const prompt = buildPromptFromAgent(agent);
          const content = await generateContent(prompt, agent);

          // Save to posts table
          await db.insert(posts).values({
            content,
            platform: "twitter",
            status: agent.skipReview ? "approved" : "pending_review",
            agentId: agent.id,
            createdAt: toMySQLTimestamp(new Date()),
            updatedAt: toMySQLTimestamp(new Date()),
          });
          const newPost = { content, platform: "twitter", status: agent.skipReview ? "approved" : "pending_review", agentId: agent.id };

          results.push({
            agentId: agent.id,
            agentName: agent.name,
            success: true,
            content: newPost.content,
          });
        } catch (error: any) {
          console.error(`[AutoContentGeneration] Failed to generate for agent ${agent.id}:`, error.message);
          results.push({
            agentId: agent.id,
            agentName: agent.name,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        results,
      };
    }),

  /**
   * Get generation history for an agent
   */
  getHistory: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const { agentId, limit } = input;

      const history = await db.query.posts.findMany({
        where: eq(posts.agentId, agentId),
        orderBy: [desc(posts.createdAt)],
        limit,
      });

      return history;
    }),
});

/**
 * Build prompt from agent settings
 */
function buildPromptFromAgent(agent: any): string {
  const toneDescriptions: Record<string, string> = {
    formal: "フォーマルで礼儀正しい",
    casual: "カジュアルで親しみやすい",
    friendly: "フレンドリーで温かい",
    professional: "プロフェッショナルで信頼できる",
    humorous: "ユーモラスで面白い",
  };

  const styleDescriptions: Record<string, string> = {
    ranking: "ランキング形式で",
    trivia: "トリビア・豆知識形式で",
    story: "ストーリー形式で",
    tutorial: "チュートリアル形式で",
    news: "ニュース形式で",
    review: "レビュー形式で",
  };

  const tone = toneDescriptions[agent.tone] || agent.tone;
  const style = styleDescriptions[agent.style] || agent.style;

  return `あなたは「${agent.name}」というSNSアカウントのコンテンツクリエイターです。

**テーマ**: ${agent.theme}
**トーン**: ${tone}
**スタイル**: ${style}
**ターゲットオーディエンス**: ${agent.targetAudience}
**説明**: ${agent.description || "なし"}

上記の設定に基づいて、ターゲットオーディエンスに響く魅力的な投稿内容を1つ生成してください。

**要件**:
- 280文字以内（Twitter用）
- ハッシュタグを1-3個含める
- エンゲージメントを促す要素を含める（質問、CTA、感情的な訴求など）
- テーマとトーンに一貫性を持たせる

投稿内容のみを出力してください（説明や前置きは不要）。`;
}

/**
 * Generate content using AI
 */
async function generateContent(prompt: string, agent: any): Promise<string> {
  try {
    // Get current date for context
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentDateStr = `${currentYear}年${currentMonth}月${currentDay}日`;

    // Use OpenAI API if configured, otherwise use Manus Forge API
    const apiKey = process.env.OPENAI_API_KEY;
      const response = await invokeLLM({
      messages: [
        { role: "system", content: `あなたは優秀なSNSコンテンツクリエイターです。

【重要】現在の日付: ${currentDateStr}（${currentYear}年です）
投稿内容は必ず現在の日付を基準に作成してください。過去の年（2024年など）について言及しないでください。` },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content generated from AI");
    }

    return typeof content === 'string' ? content.trim() : JSON.stringify(content);
  } catch (error: any) {
    console.error("[AutoContentGeneration] AI generation error:", error.message);
    throw new Error(`Failed to generate content: ${error.message}`);
  }
}
