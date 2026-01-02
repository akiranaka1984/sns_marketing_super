/**
 * Engagement Collector
 * 
 * 投稿後のエンゲージメント（いいね数・コメント数など）を
 * 自動取得し、知見の精度を向上させる
 */

import { db } from "./db";
import { 
  posts, 
  postAnalytics, 
  agentKnowledge,
  agents,
  postPerformanceFeedback
} from "../drizzle/schema";
import { eq, and, desc, gte, lte, sql, isNull, or } from "drizzle-orm";
import { screenshot as getDeviceScreenshot } from "./duoplus";
import { invokeLLM } from "./_core/llm";

// ============================================
// Types
// ============================================

interface EngagementData {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  savesCount: number;
  reachCount: number;
  impressionsCount: number;
  engagementRate: number;
}

interface CollectionResult {
  success: boolean;
  postId: number;
  platform: string;
  data?: EngagementData;
  error?: string;
}

// ============================================
// Platform-specific Engagement Collectors
// ============================================

/**
 * Twitter/Xのエンゲージメントを取得
 */
async function collectTwitterEngagement(
  deviceId: string,
  postUrl?: string
): Promise<EngagementData | null> {
  try {
    // スクリーンショットを取得
    const screenshotData = await getDeviceScreenshot(deviceId);
    if (!screenshotData) {
      console.log("[EngagementCollector] Failed to get screenshot for Twitter");
      return null;
    }

    // AIでスクリーンショットからエンゲージメントを解析
    const analysis = await analyzeEngagementFromScreenshot(screenshotData, "twitter");
    return analysis;
  } catch (error) {
    console.error("[EngagementCollector] Twitter collection error:", error);
    return null;
  }
}

/**
 * Instagramのエンゲージメントを取得
 */
async function collectInstagramEngagement(
  deviceId: string,
  postUrl?: string
): Promise<EngagementData | null> {
  try {
    const screenshotData = await getDeviceScreenshot(deviceId);
    if (!screenshotData) {
      console.log("[EngagementCollector] Failed to get screenshot for Instagram");
      return null;
    }

    const analysis = await analyzeEngagementFromScreenshot(screenshotData, "instagram");
    return analysis;
  } catch (error) {
    console.error("[EngagementCollector] Instagram collection error:", error);
    return null;
  }
}

/**
 * TikTokのエンゲージメントを取得
 */
async function collectTikTokEngagement(
  deviceId: string,
  postUrl?: string
): Promise<EngagementData | null> {
  try {
    const screenshotData = await getDeviceScreenshot(deviceId);
    if (!screenshotData) {
      console.log("[EngagementCollector] Failed to get screenshot for TikTok");
      return null;
    }

    const analysis = await analyzeEngagementFromScreenshot(screenshotData, "tiktok");
    return analysis;
  } catch (error) {
    console.error("[EngagementCollector] TikTok collection error:", error);
    return null;
  }
}

/**
 * Facebookのエンゲージメントを取得
 */
async function collectFacebookEngagement(
  deviceId: string,
  postUrl?: string
): Promise<EngagementData | null> {
  try {
    const screenshotData = await getDeviceScreenshot(deviceId);
    if (!screenshotData) {
      console.log("[EngagementCollector] Failed to get screenshot for Facebook");
      return null;
    }

    const analysis = await analyzeEngagementFromScreenshot(screenshotData, "facebook");
    return analysis;
  } catch (error) {
    console.error("[EngagementCollector] Facebook collection error:", error);
    return null;
  }
}

/**
 * スクリーンショットからAIでエンゲージメントを解析
 */
async function analyzeEngagementFromScreenshot(
  screenshotBase64: string,
  platform: string
): Promise<EngagementData | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはSNS投稿のエンゲージメント分析の専門家です。
スクリーンショットから投稿のエンゲージメント数値を正確に読み取ってください。

プラットフォーム: ${platform}

以下のJSON形式で回答してください:
{
  "likesCount": 数値（いいね数）,
  "commentsCount": 数値（コメント数）,
  "sharesCount": 数値（シェア/リツイート数）,
  "viewsCount": 数値（視聴数/インプレッション）,
  "savesCount": 数値（保存数、該当なければ0）,
  "reachCount": 数値（リーチ数、該当なければ0）,
  "impressionsCount": 数値（インプレッション数）,
  "confidence": 数値（0-100、読み取り精度）
}

数値が読み取れない場合は0を入力してください。
K（千）やM（百万）の単位は数値に変換してください（例: 1.5K → 1500）。`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "このスクリーンショットから投稿のエンゲージメント数値を読み取ってください。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "engagement_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              likesCount: { type: "integer" },
              commentsCount: { type: "integer" },
              sharesCount: { type: "integer" },
              viewsCount: { type: "integer" },
              savesCount: { type: "integer" },
              reachCount: { type: "integer" },
              impressionsCount: { type: "integer" },
              confidence: { type: "integer" }
            },
            required: ["likesCount", "commentsCount", "sharesCount", "viewsCount", "savesCount", "reachCount", "impressionsCount", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    const data = JSON.parse(content);
    
    // エンゲージメント率を計算
    const totalEngagement = data.likesCount + data.commentsCount + data.sharesCount + data.savesCount;
    const reach = data.reachCount || data.impressionsCount || data.viewsCount || 1;
    const engagementRate = Math.round((totalEngagement / reach) * 10000); // percentage * 100

    return {
      likesCount: data.likesCount,
      commentsCount: data.commentsCount,
      sharesCount: data.sharesCount,
      viewsCount: data.viewsCount,
      savesCount: data.savesCount,
      reachCount: data.reachCount,
      impressionsCount: data.impressionsCount,
      engagementRate
    };
  } catch (error) {
    console.error("[EngagementCollector] AI analysis error:", error);
    return null;
  }
}

// ============================================
// Main Collection Functions
// ============================================

/**
 * 単一投稿のエンゲージメントを収集
 */
export async function collectPostEngagement(postId: number): Promise<CollectionResult> {
  try {
    // 投稿情報を取得
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId)
    });

    if (!post) {
      return { success: false, postId, platform: "unknown", error: "Post not found" };
    }

    // アカウント情報を取得してデバイスIDを確認
    const account = post.accountId ? await db.query.accounts.findFirst({
      where: eq(posts.id, post.accountId)
    }) : null;

    const deviceId = account?.deviceId;
    if (!deviceId) {
      return { 
        success: false, 
        postId, 
        platform: post.platform || "unknown", 
        error: "No device ID associated with account" 
      };
    }

    // プラットフォーム別にエンゲージメントを取得
    let engagementData: EngagementData | null = null;
    const platform = post.platform || "twitter";

    switch (platform) {
      case "twitter":
        engagementData = await collectTwitterEngagement(deviceId);
        break;
      case "instagram":
        engagementData = await collectInstagramEngagement(deviceId);
        break;
      case "tiktok":
        engagementData = await collectTikTokEngagement(deviceId);
        break;
      case "facebook":
        engagementData = await collectFacebookEngagement(deviceId);
        break;
      default:
        return { success: false, postId, platform, error: `Unsupported platform: ${platform}` };
    }

    if (!engagementData) {
      return { success: false, postId, platform, error: "Failed to collect engagement data" };
    }

    // postsテーブルを更新
    await db.update(posts)
      .set({
        likesCount: engagementData.likesCount,
        commentsCount: engagementData.commentsCount,
        sharesCount: engagementData.sharesCount,
        reachCount: engagementData.reachCount,
        engagementRate: engagementData.engagementRate,
        updatedAt: new Date()
      })
      .where(eq(posts.id, postId));

    // postAnalyticsに記録を追加
    await db.insert(postAnalytics).values({
      postId,
      accountId: post.accountId || 0,
      platform: platform as "twitter" | "tiktok" | "instagram" | "facebook",
      viewsCount: engagementData.viewsCount,
      likesCount: engagementData.likesCount,
      commentsCount: engagementData.commentsCount,
      sharesCount: engagementData.sharesCount,
      savesCount: engagementData.savesCount,
      clicksCount: 0,
      engagementRate: engagementData.engagementRate,
      reachCount: engagementData.reachCount,
      impressionsCount: engagementData.impressionsCount,
      recordedAt: new Date()
    });

    console.log(`[EngagementCollector] Collected engagement for post ${postId}: likes=${engagementData.likesCount}, comments=${engagementData.commentsCount}`);

    return { success: true, postId, platform, data: engagementData };
  } catch (error) {
    console.error(`[EngagementCollector] Error collecting engagement for post ${postId}:`, error);
    return { 
      success: false, 
      postId, 
      platform: "unknown", 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * 公開済み投稿のエンゲージメントを一括収集
 */
export async function collectAllPendingEngagements(): Promise<{
  total: number;
  success: number;
  failed: number;
  results: CollectionResult[];
}> {
  // 公開済みで、最後の取得から1時間以上経過した投稿を取得
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const pendingPosts = await db.select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "published"),
        or(
          isNull(posts.updatedAt),
          lte(posts.updatedAt, oneHourAgo)
        )
      )
    )
    .orderBy(desc(posts.publishedAt))
    .limit(50); // 一度に50件まで

  const results: CollectionResult[] = [];
  let success = 0;
  let failed = 0;

  for (const post of pendingPosts) {
    const result = await collectPostEngagement(post.id);
    results.push(result);
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }

    // レート制限対策: 各取得間に2秒待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`[EngagementCollector] Batch collection complete: ${success}/${pendingPosts.length} successful`);

  return {
    total: pendingPosts.length,
    success,
    failed,
    results
  };
}

// ============================================
// Knowledge Generation from Engagement
// ============================================

/**
 * エンゲージメントデータから知見を生成
 */
export async function generateKnowledgeFromEngagement(postId: number): Promise<void> {
  try {
    // 投稿とそのエンゲージメントデータを取得
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, postId)
    });

    if (!post || !post.agentId) {
      console.log(`[EngagementCollector] Post ${postId} has no agent, skipping knowledge generation`);
      return;
    }

    // 同じエージェントの過去の投稿と比較
    const agentPosts = await db.select()
      .from(posts)
      .where(
        and(
          eq(posts.agentId, post.agentId),
          eq(posts.status, "published")
        )
      )
      .orderBy(desc(posts.publishedAt))
      .limit(20);

    if (agentPosts.length < 3) {
      console.log(`[EngagementCollector] Not enough posts for knowledge generation`);
      return;
    }

    // 平均エンゲージメントを計算
    const avgLikes = agentPosts.reduce((sum, p) => sum + (p.likesCount || 0), 0) / agentPosts.length;
    const avgComments = agentPosts.reduce((sum, p) => sum + (p.commentsCount || 0), 0) / agentPosts.length;
    const avgEngagement = agentPosts.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / agentPosts.length;

    // この投稿が平均より良いパフォーマンスかどうか
    const isHighPerformer = 
      (post.likesCount || 0) > avgLikes * 1.5 ||
      (post.commentsCount || 0) > avgComments * 1.5 ||
      (post.engagementRate || 0) > avgEngagement * 1.5;

    const isLowPerformer = 
      (post.likesCount || 0) < avgLikes * 0.5 &&
      (post.commentsCount || 0) < avgComments * 0.5;

    if (!isHighPerformer && !isLowPerformer) {
      console.log(`[EngagementCollector] Post ${postId} has average performance, no knowledge generated`);
      return;
    }

    // AIで知見を生成
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはSNSマーケティングの専門家です。
投稿のパフォーマンスを分析し、再現可能な知見を抽出してください。

以下のJSON形式で回答してください:
{
  "knowledgeType": "success_pattern" | "failure_pattern" | "content_insight" | "timing_insight" | "engagement_tactic",
  "title": "知見のタイトル（30文字以内）",
  "content": "知見の詳細な説明（200文字以内）",
  "confidence": 数値（0-100、この知見の確信度）
}`
        },
        {
          role: "user",
          content: `以下の投稿を分析してください:

投稿内容: ${post.content}
ハッシュタグ: ${post.hashtags || "なし"}
いいね数: ${post.likesCount || 0}（平均: ${Math.round(avgLikes)}）
コメント数: ${post.commentsCount || 0}（平均: ${Math.round(avgComments)}）
エンゲージメント率: ${((post.engagementRate || 0) / 100).toFixed(2)}%（平均: ${(avgEngagement / 100).toFixed(2)}%）

この投稿は${isHighPerformer ? "高パフォーマンス" : "低パフォーマンス"}です。
${isHighPerformer ? "なぜ成功したのか" : "なぜ失敗したのか"}を分析し、知見を抽出してください。`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "knowledge",
          strict: true,
          schema: {
            type: "object",
            properties: {
              knowledgeType: { 
                type: "string",
                enum: ["success_pattern", "failure_pattern", "content_insight", "timing_insight", "engagement_tactic"]
              },
              title: { type: "string" },
              content: { type: "string" },
              confidence: { type: "integer" }
            },
            required: ["knowledgeType", "title", "content", "confidence"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return;

    const knowledge = JSON.parse(content);

    // 知見をデータベースに保存
    await db.insert(agentKnowledge).values({
      agentId: post.agentId,
      knowledgeType: knowledge.knowledgeType,
      title: knowledge.title,
      content: knowledge.content,
      sourcePostId: postId,
      confidence: knowledge.confidence,
      usageCount: 0,
      successRate: isHighPerformer ? 100 : 0,
      isActive: true
    });

    console.log(`[EngagementCollector] Generated knowledge for post ${postId}: ${knowledge.title}`);

    // パフォーマンスフィードバックを記録
    const metrics = {
      expectedLikes: Math.round(avgLikes),
      actualLikes: post.likesCount || 0,
      expectedComments: Math.round(avgComments),
      actualComments: post.commentsCount || 0,
      expectedEngagement: Math.round(avgEngagement),
      actualEngagement: post.engagementRate || 0
    };

    await db.insert(postPerformanceFeedback).values({
      postId,
      agentId: post.agentId,
      accountId: post.accountId || 0,
      metrics24h: JSON.stringify(metrics),
      performanceScore: isHighPerformer ? 80 : 20,
      engagementScore: Math.round(((post.engagementRate || 0) / (avgEngagement || 1)) * 50),
      viralityScore: Math.round((((post.sharesCount || 0) / (avgLikes || 1)) * 100)),
      successFactors: isHighPerformer ? JSON.stringify({ content: post.content?.substring(0, 100), hashtags: post.hashtags }) : null,
      improvementAreas: isLowPerformer ? JSON.stringify({ suggestion: "コンテンツの改善が必要" }) : null,
      isProcessed: true,
      processedAt: new Date()
    });

  } catch (error) {
    console.error(`[EngagementCollector] Error generating knowledge for post ${postId}:`, error);
  }
}

/**
 * 既存の知見の信頼度を更新
 */
export async function updateKnowledgeConfidence(agentId: number): Promise<void> {
  try {
    // エージェントの知見を取得
    const knowledgeList = await db.select()
      .from(agentKnowledge)
      .where(
        and(
          eq(agentKnowledge.agentId, agentId),
          eq(agentKnowledge.isActive, true)
        )
      );

    for (const knowledge of knowledgeList) {
      // この知見を使用した投稿のパフォーマンスを取得
      if (!knowledge.sourcePostId) continue;

      const relatedPosts = await db.select()
        .from(posts)
        .where(
          and(
            eq(posts.agentId, agentId),
            eq(posts.status, "published"),
            gte(posts.createdAt, knowledge.createdAt)
          )
        )
        .limit(10);

      if (relatedPosts.length < 3) continue;

      // 成功率を計算
      const avgEngagement = relatedPosts.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / relatedPosts.length;
      const successCount = relatedPosts.filter(p => (p.engagementRate || 0) > avgEngagement).length;
      const newSuccessRate = Math.round((successCount / relatedPosts.length) * 100);

      // 信頼度を更新
      const newConfidence = Math.min(100, Math.max(0, 
        knowledge.confidence + (newSuccessRate > 50 ? 5 : -5)
      ));

      await db.update(agentKnowledge)
        .set({
          confidence: newConfidence,
          successRate: newSuccessRate,
          usageCount: knowledge.usageCount + 1,
          updatedAt: new Date()
        })
        .where(eq(agentKnowledge.id, knowledge.id));
    }

    console.log(`[EngagementCollector] Updated knowledge confidence for agent ${agentId}`);
  } catch (error) {
    console.error(`[EngagementCollector] Error updating knowledge confidence:`, error);
  }
}

// ============================================
// Scheduled Collection
// ============================================

/**
 * スケジュールされたエンゲージメント収集を実行
 * 投稿後1時間、6時間、24時間、48時間で収集
 */
export async function runScheduledCollection(): Promise<void> {
  console.log("[EngagementCollector] Starting scheduled collection...");

  const now = Date.now();
  const intervals = [
    { hours: 1, label: "1hour" },
    { hours: 6, label: "6hours" },
    { hours: 24, label: "24hours" },
    { hours: 48, label: "48hours" }
  ];

  for (const interval of intervals) {
    const targetTime = new Date(now - interval.hours * 60 * 60 * 1000);
    const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30分前
    const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000); // 30分後

    // この時間帯に公開された投稿を取得
    const postsToCollect = await db.select()
      .from(posts)
      .where(
        and(
          eq(posts.status, "published"),
          gte(posts.publishedAt, windowStart),
          lte(posts.publishedAt, windowEnd)
        )
      );

    console.log(`[EngagementCollector] Found ${postsToCollect.length} posts for ${interval.label} collection`);

    for (const post of postsToCollect) {
      const result = await collectPostEngagement(post.id);
      
      if (result.success) {
        // 24時間後と48時間後の収集では知見生成も実行
        if (interval.hours >= 24) {
          await generateKnowledgeFromEngagement(post.id);
        }
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("[EngagementCollector] Scheduled collection complete");
}

// エクスポート
export {
  collectTwitterEngagement,
  collectInstagramEngagement,
  collectTikTokEngagement,
  collectFacebookEngagement,
  analyzeEngagementFromScreenshot
};
