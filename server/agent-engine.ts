/**
 * SNS Agent Engine
 * 
 * エージェントが自律的にコンテンツを生成・投稿し、
 * ノウハウを蓄積しながら成長していく仕組み
 */

import { db } from "./db";
import { 
  agents, 
  agentKnowledge, 
  agentRules, 
  agentAccounts,
  agentExecutionLogs,
  agentSchedules,
  postPerformanceFeedback,
  posts,
  accounts,
  postAnalytics
} from "../drizzle/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { postToSNS } from "./sns-posting";

// ============================================
// Types
// ============================================

interface AgentContext {
  agent: typeof agents.$inferSelect;
  accounts: (typeof accounts.$inferSelect)[];
  knowledge: (typeof agentKnowledge.$inferSelect)[];
  rules: (typeof agentRules.$inferSelect)[];
  recentPosts: (typeof posts.$inferSelect)[];
}

interface GeneratedContent {
  content: string;
  hashtags: string[];
  mediaPrompt?: string;
  confidence: number;
  reasoning: string;
}

interface PostResult {
  success: boolean;
  postId?: number;
  error?: string;
}

// ============================================
// Agent Context Builder
// ============================================

/**
 * エージェントの実行に必要なコンテキストを構築
 */
export async function buildAgentContext(agentId: number): Promise<AgentContext | null> {
  // エージェント情報を取得
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    return null;
  }

  // 紐づくアカウントを取得
  const agentAccountLinks = await db.query.agentAccounts.findMany({
    where: and(
      eq(agentAccounts.agentId, agentId),
      eq(agentAccounts.isActive, true)
    ),
  });

  const accountIds = agentAccountLinks.map(link => link.accountId);
  const linkedAccounts = accountIds.length > 0
    ? await db.query.accounts.findMany({
        where: sql`${accounts.id} IN (${accountIds.join(',')})`,
      })
    : [];

  // 知見を取得（信頼度順）
  const knowledge = await db.query.agentKnowledge.findMany({
    where: and(
      eq(agentKnowledge.agentId, agentId),
      eq(agentKnowledge.isActive, true)
    ),
    orderBy: [desc(agentKnowledge.confidence), desc(agentKnowledge.successRate)],
    limit: 50,
  });

  // ルールを取得（優先度順）
  const rules = await db.query.agentRules.findMany({
    where: and(
      eq(agentRules.agentId, agentId),
      eq(agentRules.isActive, true)
    ),
    orderBy: desc(agentRules.priority),
  });

  // 最近の投稿を取得（重複防止用）
  const recentPosts = await db.query.posts.findMany({
    where: eq(posts.agentId, agentId),
    orderBy: desc(posts.createdAt),
    limit: 20,
  });

  return {
    agent,
    accounts: linkedAccounts,
    knowledge,
    rules,
    recentPosts,
  };
}

// ============================================
// Content Generation
// ============================================

/**
 * エージェントのコンテキストに基づいてコンテンツを生成
 */
export async function generateContent(context: AgentContext, maxLength?: number): Promise<GeneratedContent> {
  const { agent, knowledge, rules, recentPosts } = context;

  // 成功パターンを抽出
  const successPatterns = knowledge
    .filter(k => k.knowledgeType === 'success_pattern')
    .slice(0, 5)
    .map(k => k.content);

  // コンテンツテンプレートを抽出
  const templates = knowledge
    .filter(k => k.knowledgeType === 'content_template')
    .slice(0, 3)
    .map(k => k.content);

  // ハッシュタグ戦略を抽出
  const hashtagStrategies = knowledge
    .filter(k => k.knowledgeType === 'hashtag_strategy')
    .slice(0, 3)
    .map(k => k.content);

  // 禁止ワードを抽出
  const forbiddenWords = rules
    .filter(r => r.ruleType === 'forbidden_word')
    .map(r => r.ruleValue);

  // トーンガイドラインを抽出
  const toneGuidelines = rules
    .filter(r => r.ruleType === 'tone_guideline')
    .map(r => r.ruleValue);

  // 最近の投稿内容（重複防止用）
  const recentContents = recentPosts
    .slice(0, 10)
    .map(p => p.content.substring(0, 100));

  // プロンプトを構築
  const systemPrompt = `あなたは「${agent.name}」というSNSエージェントです。
テーマ: ${agent.theme}
トーン: ${agent.tone}
スタイル: ${agent.style}
ターゲットオーディエンス: ${agent.targetAudience || '一般'}

あなたの役割は、テーマに沿った魅力的なSNS投稿を作成することです。
以下の制約とガイドラインに従ってください。

## 禁止事項
${forbiddenWords.length > 0 ? forbiddenWords.map(w => `- ${w}`).join('\n') : '- 特になし'}

## トーンガイドライン
${toneGuidelines.length > 0 ? toneGuidelines.map(g => `- ${g}`).join('\n') : '- 自然で親しみやすいトーンを維持'}

## 過去の成功パターン（参考）
${successPatterns.length > 0 ? successPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n') : '- まだ蓄積されていません'}

## コンテンツテンプレート（参考）
${templates.length > 0 ? templates.map((t, i) => `${i + 1}. ${t}`).join('\n') : '- まだ蓄積されていません'}

## ハッシュタグ戦略（参考）
${hashtagStrategies.length > 0 ? hashtagStrategies.map((h, i) => `${i + 1}. ${h}`).join('\n') : '- まだ蓄積されていません'}

## 最近の投稿（重複を避けてください）
${recentContents.length > 0 ? recentContents.map((c, i) => `${i + 1}. ${c}...`).join('\n') : '- まだ投稿がありません'}

重要: 
- 過去の投稿と似た内容は避けてください
- 新鮮で興味を引く内容を心がけてください
- ハッシュタグは関連性の高いものを3-5個選んでください`;

  // 文字数制限の計算（全角文字は2文字としてカウント）
  const calculateCharCount = (text: string): number => {
    let count = 0;
    for (const char of text) {
      // 全角文字（日本語、中国語、韓国語など）は2文字としてカウント
      count += char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
    }
    return count;
  };

  // デフォルトで280文字制限（無料ユーザー向け）
  const effectiveMaxLength = maxLength || 280;
  const lengthConstraint = `

重要: 投稿本文は${effectiveMaxLength}文字以内に収めてください（全角文字は2文字としてカウント）。`;

  const userPrompt = `テーマ「${agent.theme}」に関する新しいSNS投稿を1つ作成してください。${lengthConstraint}

以下のJSON形式で回答してください:
{
  "content": "投稿本文（ハッシュタグは含めない）",
  "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"],
  "mediaPrompt": "この投稿に合う画像の説明（オプション）",
  "confidence": 0-100の数値（この投稿の成功予測度）,
  "reasoning": "この投稿を選んだ理由"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string", description: "投稿本文" },
              hashtags: { 
                type: "array", 
                items: { type: "string" },
                description: "ハッシュタグリスト" 
              },
              mediaPrompt: { type: "string", description: "画像生成用プロンプト" },
              confidence: { type: "integer", description: "成功予測度 0-100" },
              reasoning: { type: "string", description: "この投稿を選んだ理由" },
            },
            required: ["content", "hashtags", "confidence", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(typeof messageContent === 'string' ? messageContent : '{}');
    
    // 文字数制限を超えている場合は切り詰める
    let content = result.content || '';
    const charCount = calculateCharCount(content);
    if (charCount > effectiveMaxLength) {
      console.warn(`[AgentEngine] Content exceeds ${effectiveMaxLength} chars (${charCount}), truncating...`);
      // 全角文字を考慮して切り詰める
      let truncated = '';
      let count = 0;
      for (const char of content) {
        const charWeight = char.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) ? 2 : 1;
        if (count + charWeight > effectiveMaxLength - 3) break;
        truncated += char;
        count += charWeight;
      }
      content = truncated + '...';
    }
    
    return {
      content,
      hashtags: result.hashtags || [],
      mediaPrompt: result.mediaPrompt,
      confidence: result.confidence || 50,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    console.error('[AgentEngine] Content generation failed:', error);
    throw error;
  }
}

// ============================================
// Post Execution
// ============================================

/**
 * 生成したコンテンツを投稿
 */
export async function executePost(
  context: AgentContext,
  content: GeneratedContent,
  accountId: number
): Promise<PostResult> {
  const { agent } = context;

  // アカウント情報を取得
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
  });

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  if (!account.deviceId) {
    return { success: false, error: 'No device assigned to account' };
  }

  // 投稿レコードを作成
  const [post] = await db.insert(posts).values({
    accountId,
    agentId: agent.id,
    projectId: agent.projectId,
    platform: account.platform,
    content: content.content,
    hashtags: JSON.stringify(content.hashtags),
    status: agent.skipReview ? 'scheduled' : 'pending_review',
  });

  const postId = post.insertId;

  // レビュースキップの場合は即座に投稿
  if (agent.skipReview) {
    try {
      // ハッシュタグを含めた投稿内容を構築
      const fullContent = content.content + '\n\n' + content.hashtags.map(h => `#${h}`).join(' ');
      
      const result = await postToSNS(
        account.platform,
        account.deviceId,
        fullContent
      );

      if (result.success) {
        await db.update(posts)
          .set({ 
            status: 'published',
            publishedAt: new Date(),
          })
          .where(eq(posts.id, postId));

        // パフォーマンスフィードバック用のレコードを作成
        await db.insert(postPerformanceFeedback).values({
          postId,
          agentId: agent.id,
          accountId,
        });

        return { success: true, postId };
      } else {
        await db.update(posts)
          .set({ status: 'failed' })
          .where(eq(posts.id, postId));

        return { success: false, postId, error: result.error };
      }
    } catch (error) {
      await db.update(posts)
        .set({ status: 'failed' })
        .where(eq(posts.id, postId));

      return { 
        success: false, 
        postId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // レビュー待ちの場合
  return { success: true, postId };
}

// ============================================
// Agent Execution
// ============================================

/**
 * エージェントの実行（コンテンツ生成→投稿）
 */
export async function runAgent(agentId: number, accountId?: number): Promise<{
  success: boolean;
  postId?: number;
  content?: GeneratedContent;
  error?: string;
}> {
  const startTime = Date.now();

  // 実行ログを開始
  const [logEntry] = await db.insert(agentExecutionLogs).values({
    agentId,
    accountId,
    executionType: 'content_generation',
    status: 'started',
  });
  const logId = logEntry.insertId;

  try {
    // コンテキストを構築
    const context = await buildAgentContext(agentId);
    if (!context) {
      await db.update(agentExecutionLogs)
        .set({ 
          status: 'failed',
          errorMessage: 'Agent not found',
          executionTimeMs: Date.now() - startTime,
        })
        .where(eq(agentExecutionLogs.id, logId));
      return { success: false, error: 'Agent not found' };
    }

    // 投稿先アカウントを決定
    let targetAccountId = accountId;
    if (!targetAccountId && context.accounts.length > 0) {
      // ランダムに選択（将来的には最適なアカウントを選択）
      targetAccountId = context.accounts[Math.floor(Math.random() * context.accounts.length)].id;
    }

    if (!targetAccountId) {
      await db.update(agentExecutionLogs)
        .set({ 
          status: 'failed',
          errorMessage: 'No account available',
          executionTimeMs: Date.now() - startTime,
        })
        .where(eq(agentExecutionLogs.id, logId));
      return { success: false, error: 'No account available' };
    }

    // コンテンツを生成
    const content = await generateContent(context);

    // 投稿を実行
    const result = await executePost(context, content, targetAccountId);

    // ログを更新
    await db.update(agentExecutionLogs)
      .set({ 
        status: result.success ? 'success' : 'failed',
        accountId: targetAccountId,
        postId: result.postId,
        outputData: JSON.stringify(content),
        errorMessage: result.error,
        executionTimeMs: Date.now() - startTime,
      })
      .where(eq(agentExecutionLogs.id, logId));

    return {
      success: result.success,
      postId: result.postId,
      content,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await db.update(agentExecutionLogs)
      .set({ 
        status: 'failed',
        errorMessage,
        executionTimeMs: Date.now() - startTime,
      })
      .where(eq(agentExecutionLogs.id, logId));

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Learning & Knowledge Extraction
// ============================================

/**
 * 投稿パフォーマンスを分析して知見を抽出
 */
export async function analyzePostPerformance(postId: number): Promise<void> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post || !post.agentId) {
    return;
  }

  // パフォーマンスデータを取得
  const analytics = await db.query.postAnalytics.findFirst({
    where: eq(postAnalytics.postId, postId),
    orderBy: desc(postAnalytics.recordedAt),
  });

  if (!analytics) {
    return;
  }

  // パフォーマンススコアを計算
  const engagementScore = Math.min(100, 
    (analytics.likesCount * 2 + analytics.commentsCount * 5 + analytics.sharesCount * 10) / 10
  );

  // フィードバックを更新
  await db.update(postPerformanceFeedback)
    .set({
      performanceScore: engagementScore,
      engagementScore: analytics.engagementRate,
      isProcessed: true,
      processedAt: new Date(),
    })
    .where(eq(postPerformanceFeedback.postId, postId));

  // 高パフォーマンスの場合、成功パターンとして保存
  if (engagementScore >= 70) {
    await db.insert(agentKnowledge).values({
      agentId: post.agentId,
      knowledgeType: 'success_pattern',
      title: `高エンゲージメント投稿パターン`,
      content: JSON.stringify({
        content: post.content,
        hashtags: post.hashtags,
        engagementScore,
        metrics: {
          likes: analytics.likesCount,
          comments: analytics.commentsCount,
          shares: analytics.sharesCount,
        },
      }),
      sourcePostId: postId,
      confidence: Math.min(100, engagementScore + 10),
      successRate: 100,
    });
  }

  // 低パフォーマンスの場合、失敗パターンとして保存
  if (engagementScore < 30) {
    await db.insert(agentKnowledge).values({
      agentId: post.agentId,
      knowledgeType: 'failure_pattern',
      title: `低エンゲージメント投稿パターン`,
      content: JSON.stringify({
        content: post.content,
        hashtags: post.hashtags,
        engagementScore,
        metrics: {
          likes: analytics.likesCount,
          comments: analytics.commentsCount,
          shares: analytics.sharesCount,
        },
      }),
      sourcePostId: postId,
      confidence: 70,
      successRate: 0,
    });
  }
}

/**
 * エージェントの知見を要約・統合
 */
export async function consolidateKnowledge(agentId: number): Promise<void> {
  // 成功パターンを取得
  const successPatterns = await db.query.agentKnowledge.findMany({
    where: and(
      eq(agentKnowledge.agentId, agentId),
      eq(agentKnowledge.knowledgeType, 'success_pattern'),
      eq(agentKnowledge.isActive, true)
    ),
    orderBy: desc(agentKnowledge.confidence),
    limit: 20,
  });

  if (successPatterns.length < 5) {
    return; // 十分なデータがない
  }

  // AIで共通パターンを抽出
  const patternsData = successPatterns.map(p => {
    try {
      return JSON.parse(p.content);
    } catch {
      return { content: p.content };
    }
  });

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "あなたはSNSマーケティングの専門家です。成功した投稿パターンを分析し、共通する成功要因を抽出してください。"
        },
        {
          role: "user",
          content: `以下の成功した投稿パターンを分析し、共通する成功要因を3つ抽出してください。

${JSON.stringify(patternsData, null, 2)}

以下のJSON形式で回答してください:
{
  "factors": [
    {"title": "成功要因1", "description": "詳細説明", "confidence": 0-100},
    {"title": "成功要因2", "description": "詳細説明", "confidence": 0-100},
    {"title": "成功要因3", "description": "詳細説明", "confidence": 0-100}
  ]
}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "success_factors",
          strict: true,
          schema: {
            type: "object",
            properties: {
              factors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    confidence: { type: "integer" },
                  },
                  required: ["title", "description", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["factors"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(typeof messageContent === 'string' ? messageContent : '{}');

    // 抽出した知見を保存
    for (const factor of result.factors || []) {
      await db.insert(agentKnowledge).values({
        agentId,
        knowledgeType: 'general',
        title: factor.title,
        content: factor.description,
        confidence: factor.confidence,
        successRate: 80,
      });
    }
  } catch (error) {
    console.error('[AgentEngine] Knowledge consolidation failed:', error);
  }
}

// ============================================
// Exports
// ============================================

export {
  AgentContext,
  GeneratedContent,
  PostResult,
};
