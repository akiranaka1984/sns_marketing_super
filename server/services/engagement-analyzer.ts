/**
 * Engagement Analyzer Service
 * 
 * 投稿のエンゲージメントデータを分析し、
 * 成功パターンと改善点を抽出するサービス
 */

import { db } from "../db";
import { 
  scheduledPosts, 
  postAnalytics, 
  agents,
  agentKnowledge 
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export interface EngagementMetrics {
  postId: number;
  content: string;
  scheduledTime: Date;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  engagementRate: number;
  performanceScore: number;
}

export interface EngagementInsight {
  type: 'success_pattern' | 'failure_pattern' | 'timing_insight' | 'content_template' | 'hashtag_strategy';
  title: string;
  content: string;
  confidence: number;
  affectedPosts: number[];
  metrics: {
    avgEngagementRate: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
  };
}

/**
 * エージェントの投稿パフォーマンスを分析
 */
export async function analyzeAgentPerformance(
  agentId: number,
  daysBack: number = 7
): Promise<{
  totalPosts: number;
  avgEngagementRate: number;
  topPosts: EngagementMetrics[];
  bottomPosts: EngagementMetrics[];
  insights: EngagementInsight[];
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // エージェントの投稿を取得
  const posts = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.agentId, agentId),
      eq(scheduledPosts.status, 'posted'),
      gte(scheduledPosts.postedAt, toMySQLTimestamp(cutoffDate))
    ),
    orderBy: [desc(scheduledPosts.postedAt)],
  });

  if (posts.length === 0) {
    return {
      totalPosts: 0,
      avgEngagementRate: 0,
      topPosts: [],
      bottomPosts: [],
      insights: [],
    };
  }

  // 各投稿のアナリティクスデータを取得
  const postsWithAnalytics = await Promise.all(
    posts.map(async (post) => {
      const analytics = await db.query.postAnalytics.findFirst({
        where: eq(postAnalytics.postId, post.id),
        orderBy: [desc(postAnalytics.recordedAt)],
      });

      return {
        postId: post.id,
        content: post.content,
        scheduledTime: new Date(post.scheduledTime),
        likesCount: analytics?.likesCount || 0,
        commentsCount: analytics?.commentsCount || 0,
        sharesCount: analytics?.sharesCount || 0,
        viewsCount: analytics?.viewsCount || 0,
        engagementRate: analytics?.engagementRate || 0,
        performanceScore: calculatePerformanceScore(analytics),
      };
    })
  );

  // パフォーマンススコアでソート
  const sortedPosts = [...postsWithAnalytics].sort(
    (a, b) => b.performanceScore - a.performanceScore
  );

  // トップ3とボトム3を抽出
  const topPosts = sortedPosts.slice(0, Math.min(3, sortedPosts.length));
  const bottomPosts = sortedPosts.slice(-Math.min(3, sortedPosts.length)).reverse();

  // 平均エンゲージメント率を計算
  const avgEngagementRate =
    postsWithAnalytics.reduce((sum, p) => sum + p.engagementRate, 0) /
    postsWithAnalytics.length;

  // インサイトを生成
  const insights = await generateInsights(agentId, postsWithAnalytics, topPosts, bottomPosts);

  return {
    totalPosts: posts.length,
    avgEngagementRate,
    topPosts,
    bottomPosts,
    insights,
  };
}

/**
 * パフォーマンススコアを計算
 */
function calculatePerformanceScore(analytics: any): number {
  if (!analytics) return 0;

  const likes = analytics.likesCount || 0;
  const comments = analytics.commentsCount || 0;
  const shares = analytics.sharesCount || 0;
  const views = analytics.viewsCount || 0;

  // 重み付けスコア計算
  // コメントとシェアを高く評価
  const score = likes * 1 + comments * 3 + shares * 5;
  
  // ビュー数で正規化
  return views > 0 ? (score / views) * 1000 : score;
}

/**
 * インサイトを生成
 */
async function generateInsights(
  agentId: number,
  allPosts: EngagementMetrics[],
  topPosts: EngagementMetrics[],
  bottomPosts: EngagementMetrics[]
): Promise<EngagementInsight[]> {
  const insights: EngagementInsight[] = [];

  // 成功パターンを分析
  if (topPosts.length > 0) {
    const topMetrics = calculateAverageMetrics(topPosts);
    
    // コンテンツの共通点を抽出
    const commonPatterns = extractCommonPatterns(topPosts.map(p => p.content));
    
    if (commonPatterns.length > 0) {
      insights.push({
        type: 'success_pattern',
        title: '高パフォーマンス投稿の特徴',
        content: `以下の要素が含まれる投稿は高いエンゲージメントを獲得しています: ${commonPatterns.join(', ')}`,
        confidence: 75,
        affectedPosts: topPosts.map(p => p.postId),
        metrics: topMetrics,
      });
    }
  }

  // 失敗パターンを分析
  if (bottomPosts.length > 0) {
    const bottomMetrics = calculateAverageMetrics(bottomPosts);
    
    insights.push({
      type: 'failure_pattern',
      title: '改善が必要な投稿パターン',
      content: 'エンゲージメントが低い投稿では、コンテンツの長さや投稿時間帯の見直しが推奨されます。',
        confidence: 65,
        affectedPosts: bottomPosts.map(p => p.postId),
        metrics: bottomMetrics,
      });
  }

  // 投稿時間帯の分析
  const timingInsight = analyzePostingTimes(allPosts);
  if (timingInsight) {
    insights.push(timingInsight);
  }

  return insights;
}

/**
 * 平均メトリクスを計算
 */
function calculateAverageMetrics(posts: EngagementMetrics[]) {
  const count = posts.length;
  return {
    avgEngagementRate: posts.reduce((sum, p) => sum + p.engagementRate, 0) / count,
    avgLikes: posts.reduce((sum, p) => sum + p.likesCount, 0) / count,
    avgComments: posts.reduce((sum, p) => sum + p.commentsCount, 0) / count,
    avgShares: posts.reduce((sum, p) => sum + p.sharesCount, 0) / count,
  };
}

/**
 * コンテンツから共通パターンを抽出
 */
function extractCommonPatterns(contents: string[]): string[] {
  const patterns: string[] = [];

  // ハッシュタグの使用
  const hasHashtags = contents.filter(c => c.includes('#')).length;
  if (hasHashtags > contents.length * 0.6) {
    patterns.push('ハッシュタグの活用');
  }

  // 絵文字の使用
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const hasEmojis = contents.filter(c => emojiRegex.test(c)).length;
  if (hasEmojis > contents.length * 0.6) {
    patterns.push('絵文字の使用');
  }

  // 質問形式
  const hasQuestions = contents.filter(c => c.includes('?') || c.includes('？')).length;
  if (hasQuestions > contents.length * 0.5) {
    patterns.push('質問形式の投稿');
  }

  return patterns;
}

/**
 * 投稿時間帯を分析
 */
function analyzePostingTimes(posts: EngagementMetrics[]): EngagementInsight | null {
  if (posts.length < 5) return null;

  // 時間帯ごとにグループ化
  const timeSlots = {
    morning: posts.filter(p => {
      const hour = p.scheduledTime.getHours();
      return hour >= 6 && hour < 12;
    }),
    afternoon: posts.filter(p => {
      const hour = p.scheduledTime.getHours();
      return hour >= 12 && hour < 18;
    }),
    evening: posts.filter(p => {
      const hour = p.scheduledTime.getHours();
      return hour >= 18 && hour < 24;
    }),
    night: posts.filter(p => {
      const hour = p.scheduledTime.getHours();
      return hour >= 0 && hour < 6;
    }),
  };

  // 各時間帯の平均エンゲージメント率を計算
  const slotPerformance = Object.entries(timeSlots).map(([slot, slotPosts]) => ({
    slot,
    avgEngagement: slotPosts.length > 0
      ? slotPosts.reduce((sum, p) => sum + p.engagementRate, 0) / slotPosts.length
      : 0,
    count: slotPosts.length,
  }));

  // 最もパフォーマンスが高い時間帯を特定
  const bestSlot = slotPerformance.reduce((best, current) =>
    current.avgEngagement > best.avgEngagement ? current : best
  );

  if (bestSlot.count === 0) return null;

  const slotNames = {
    morning: '朝（6-12時）',
    afternoon: '午後（12-18時）',
    evening: '夕方（18-24時）',
    night: '深夜（0-6時）',
  };

  return {
    type: 'timing_insight',
    title: '最適な投稿時間帯',
    content: `${slotNames[bestSlot.slot as keyof typeof slotNames]}の投稿が最も高いエンゲージメントを獲得しています（平均${bestSlot.avgEngagement.toFixed(2)}%）`,
    confidence: 70,
    affectedPosts: timeSlots[bestSlot.slot as keyof typeof timeSlots].map(p => p.postId),
    metrics: calculateAverageMetrics(timeSlots[bestSlot.slot as keyof typeof timeSlots]),
  };
}

/**
 * インサイトをエージェントの知識ベースに保存
 */
export async function saveInsightsToKnowledge(
  agentId: number,
  insights: EngagementInsight[]
): Promise<void> {
  for (const insight of insights) {
    // 既存の類似知識をチェック
    const existing = await db.query.agentKnowledge.findFirst({
      where: and(
        eq(agentKnowledge.agentId, agentId),
        eq(agentKnowledge.title, insight.title)
      ),
    });

    if (existing) {
      // 既存の知識を更新
      await db.update(agentKnowledge)
        .set({
          content: insight.content,
          confidence: insight.confidence,
          updatedAt: toMySQLTimestamp(new Date()),
        })
        .where(eq(agentKnowledge.id, existing.id));
    } else {
      // 新しい知識として追加
      await db.insert(agentKnowledge).values({
        agentId,
        knowledgeType: insight.type === 'success_pattern' ? 'success_pattern' :
                      insight.type === 'failure_pattern' ? 'failure_pattern' :
                      insight.type === 'timing_insight' ? 'timing_insight' :
                      insight.type === 'hashtag_strategy' ? 'hashtag_strategy' :
                      'content_template',
        title: insight.title,
        content: insight.content,
        confidence: insight.confidence,
        isActive: 1,
      });
    }
  }
}
