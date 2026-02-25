/**
 * Account Learning Service
 * Manages account-specific learnings for consistent persona across posts and comments
 */

import { db } from "../db";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

import { createLogger } from "../utils/logger";

const logger = createLogger("account-learning-service");

export type LearningType =
  | 'posting_style'
  | 'comment_style'
  | 'success_pattern'
  | 'failure_pattern'
  | 'hashtag_strategy'
  | 'timing_pattern'
  | 'topic_preference'
  | 'audience_insight';

export type SourceType = 'post_performance' | 'buzz_analysis' | 'manual' | 'ai_suggestion';

export interface AccountLearningInput {
  accountId: number;
  projectId?: number;
  learningType: LearningType;
  title: string;
  content: Record<string, any>;
  sourceType: SourceType;
  sourcePostId?: number;
  sourceLearningId?: number;
  confidence?: number;
}

export interface AccountLearning {
  id: number;
  accountId: number;
  projectId: number | null;
  learningType: string;
  title: string;
  content: string;
  sourceType: string;
  sourcePostId: number | null;
  sourceLearningId: number | null;
  confidence: number;
  usageCount: number;
  successRate: number;
  isActive: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetLearningsOptions {
  projectId?: number;
  learningTypes?: LearningType[];
  minConfidence?: number;
  limit?: number;
  activeOnly?: boolean;
}

/**
 * Get learnings for an account
 */
export async function getAccountLearnings(
  accountId: number,
  options: GetLearningsOptions = {}
): Promise<AccountLearning[]> {
  const {
    projectId,
    learningTypes,
    minConfidence = 0,
    limit = 50,
    activeOnly = true,
  } = options;

  let query = db
    .select()
    .from(schema.accountLearnings)
    .where(
      and(
        eq(schema.accountLearnings.accountId, accountId),
        activeOnly ? eq(schema.accountLearnings.isActive, 1) : undefined,
        minConfidence > 0 ? gte(schema.accountLearnings.confidence, minConfidence) : undefined
      )
    )
    .orderBy(desc(schema.accountLearnings.confidence))
    .limit(limit);

  const results = await query;

  // Filter by project (include both project-specific and global learnings)
  let filtered = results;
  if (projectId !== undefined) {
    filtered = results.filter(
      (l) => l.projectId === null || l.projectId === projectId
    );
  }

  // Filter by learning types
  if (learningTypes && learningTypes.length > 0) {
    filtered = filtered.filter((l) =>
      learningTypes.includes(l.learningType as LearningType)
    );
  }

  return filtered;
}

/**
 * Add a new learning for an account
 */
export async function addAccountLearning(
  input: AccountLearningInput
): Promise<number> {
  const contentJson = JSON.stringify(input.content);

  const [result] = await db.insert(schema.accountLearnings).values({
    accountId: input.accountId,
    projectId: input.projectId || null,
    learningType: input.learningType,
    title: input.title,
    content: contentJson,
    sourceType: input.sourceType,
    sourcePostId: input.sourcePostId || null,
    sourceLearningId: input.sourceLearningId || null,
    confidence: input.confidence || 50,
    usageCount: 0,
    successRate: 0,
    isActive: 1,
  });

  return result.insertId;
}

/**
 * Update learning usage and success rate
 */
export async function updateLearningUsage(
  learningId: number,
  wasSuccessful: boolean
): Promise<void> {
  const [learning] = await db
    .select()
    .from(schema.accountLearnings)
    .where(eq(schema.accountLearnings.id, learningId));

  if (!learning) return;

  const newUsageCount = learning.usageCount + 1;
  const currentSuccessful = Math.round(
    (learning.successRate / 100) * learning.usageCount
  );
  const newSuccessful = currentSuccessful + (wasSuccessful ? 1 : 0);
  const newSuccessRate = Math.round((newSuccessful / newUsageCount) * 100);

  await db
    .update(schema.accountLearnings)
    .set({
      usageCount: newUsageCount,
      successRate: newSuccessRate,
    })
    .where(eq(schema.accountLearnings.id, learningId));
}

/**
 * Deactivate a learning
 */
export async function deactivateLearning(learningId: number): Promise<void> {
  await db
    .update(schema.accountLearnings)
    .set({ isActive: 0 })
    .where(eq(schema.accountLearnings.id, learningId));
}

/**
 * Apply buzz learning to an account
 */
export async function applyBuzzLearningToAccount(
  buzzLearningId: number,
  accountId: number,
  projectId?: number
): Promise<number> {
  // Get the buzz learning
  const [buzzLearning] = await db
    .select()
    .from(schema.buzzLearnings)
    .where(eq(schema.buzzLearnings.id, buzzLearningId));

  if (!buzzLearning) {
    throw new Error(`Buzz learning ${buzzLearningId} not found`);
  }

  // Map buzz learning type to account learning type
  const typeMapping: Record<string, LearningType> = {
    hook_pattern: 'success_pattern',
    structure_pattern: 'posting_style',
    hashtag_strategy: 'hashtag_strategy',
    timing_pattern: 'timing_pattern',
    cta_pattern: 'success_pattern',
    media_usage: 'posting_style',
    tone_pattern: 'posting_style',
  };

  const learningType = typeMapping[buzzLearning.learningType] || 'success_pattern';

  // Parse pattern data
  let patternData: Record<string, any> = {};
  try {
    patternData = JSON.parse(buzzLearning.patternData || '{}');
  } catch (e) {
    patternData = { raw: buzzLearning.patternData };
  }

  // Create account learning
  return await addAccountLearning({
    accountId,
    projectId,
    learningType,
    title: `[バズ分析] ${buzzLearning.title}`,
    content: {
      originalLearningType: buzzLearning.learningType,
      description: buzzLearning.description,
      patternData,
      examplePostIds: buzzLearning.examplePostIds,
      sampleSize: buzzLearning.sampleSize,
    },
    sourceType: 'buzz_analysis',
    sourceLearningId: buzzLearningId,
    confidence: buzzLearning.confidence,
  });
}

/**
 * Learn from post performance
 */
export async function learnFromPostPerformance(
  postId: number,
  accountId: number,
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  },
  threshold: { successLikes?: number; failureLikes?: number } = {}
): Promise<number | null> {
  const { successLikes = 50, failureLikes = 5 } = threshold;

  // Get the post
  const [post] = await db
    .select()
    .from(schema.scheduledPosts)
    .where(eq(schema.scheduledPosts.id, postId));

  if (!post) return null;

  const isSuccess = metrics.likes >= successLikes;
  const isFailure = metrics.likes < failureLikes;

  if (!isSuccess && !isFailure) return null; // Middle range, not significant

  const learningType: LearningType = isSuccess ? 'success_pattern' : 'failure_pattern';
  const title = isSuccess
    ? `高エンゲージメント投稿パターン`
    : `低エンゲージメント投稿パターン`;

  // Extract patterns from content
  const content = post.content;
  const hasEmoji = /[\u{1F600}-\u{1F64F}]/u.test(content);
  const hasQuestion = content.includes('?') || content.includes('？');
  const hasHashtag = content.includes('#');
  const contentLength = content.length;
  const hasLineBreaks = content.includes('\n');

  return await addAccountLearning({
    accountId,
    learningType,
    title,
    content: {
      pattern: {
        hasEmoji,
        hasQuestion,
        hasHashtag,
        contentLength,
        hasLineBreaks,
        excerpt: content.substring(0, 100),
      },
      metrics,
      insight: isSuccess
        ? 'この投稿パターンは高いエンゲージメントを獲得しました'
        : 'この投稿パターンは低いエンゲージメントでした',
    },
    sourceType: 'post_performance',
    sourcePostId: postId,
    confidence: isSuccess ? 70 : 60,
  });
}

/**
 * Get learning summary for prompt generation
 */
export async function getLearningsForPrompt(
  accountId: number,
  options: {
    projectId?: number;
    forPostGeneration?: boolean;
    forCommentGeneration?: boolean;
  } = {}
): Promise<string> {
  const { projectId, forPostGeneration = true, forCommentGeneration = false } = options;

  const learningTypes: LearningType[] = [];
  if (forPostGeneration) {
    learningTypes.push('posting_style', 'success_pattern', 'hashtag_strategy', 'timing_pattern', 'topic_preference');
  }
  if (forCommentGeneration) {
    learningTypes.push('comment_style', 'audience_insight');
  }

  const learnings = await getAccountLearnings(accountId, {
    projectId,
    learningTypes,
    minConfidence: 30,
    limit: 10,
  });

  if (learnings.length === 0) {
    return '';
  }

  const sections: string[] = [];

  // Success patterns
  const successPatterns = learnings.filter(l => l.learningType === 'success_pattern');
  if (successPatterns.length > 0) {
    sections.push('## このアカウントの成功パターン');
    successPatterns.forEach(p => {
      try {
        const content = JSON.parse(p.content);
        sections.push(`- ${p.title}: ${content.insight || content.description || ''}`);
      } catch {
        sections.push(`- ${p.title}`);
      }
    });
  }

  // Posting style
  const postingStyles = learnings.filter(l => l.learningType === 'posting_style');
  if (postingStyles.length > 0) {
    sections.push('## このアカウントの投稿スタイル');
    postingStyles.forEach(p => {
      try {
        const content = JSON.parse(p.content);
        sections.push(`- ${p.title}: ${content.description || JSON.stringify(content.patternData) || ''}`);
      } catch {
        sections.push(`- ${p.title}`);
      }
    });
  }

  // Comment style (for comments)
  const commentStyles = learnings.filter(l => l.learningType === 'comment_style');
  if (commentStyles.length > 0) {
    sections.push('## このアカウントのコメントスタイル');
    commentStyles.forEach(p => {
      try {
        const content = JSON.parse(p.content);
        sections.push(`- ${content.description || p.title}`);
      } catch {
        sections.push(`- ${p.title}`);
      }
    });
  }

  // Hashtag strategy
  const hashtagStrategies = learnings.filter(l => l.learningType === 'hashtag_strategy');
  if (hashtagStrategies.length > 0) {
    sections.push('## ハッシュタグ戦略');
    hashtagStrategies.forEach(p => {
      try {
        const content = JSON.parse(p.content);
        sections.push(`- ${content.description || p.title}`);
      } catch {
        sections.push(`- ${p.title}`);
      }
    });
  }

  return sections.join('\n');
}

/**
 * Consolidate similar learnings (cleanup)
 */
export async function consolidateAccountLearnings(accountId: number): Promise<void> {
  // Get all active learnings
  const learnings = await getAccountLearnings(accountId, { activeOnly: true });

  // Group by learning type
  const grouped = learnings.reduce((acc, l) => {
    if (!acc[l.learningType]) acc[l.learningType] = [];
    acc[l.learningType].push(l);
    return acc;
  }, {} as Record<string, AccountLearning[]>);

  // Keep top 5 per type by confidence, deactivate others
  for (const [type, items] of Object.entries(grouped)) {
    if (items.length <= 5) continue;

    const sorted = items.sort((a, b) => b.confidence - a.confidence);
    const toDeactivate = sorted.slice(5);

    for (const learning of toDeactivate) {
      await deactivateLearning(learning.id);
    }
  }
}

/**
 * Buzz learning patterns for prompt inclusion
 */
export interface BuzzPatternsForPrompt {
  hooks: string;
  structures: string;
  ctas: string;
  avoidPatterns: string;
  hasData: boolean;
}

/**
 * Get buzz learnings formatted for inclusion in content generation prompts
 * Retrieves hook patterns, structure patterns, CTA patterns, and failure patterns
 */
export async function getBuzzLearningsForPrompt(
  userId: number,
  options?: { industryCategory?: string; limit?: number }
): Promise<BuzzPatternsForPrompt> {
  const limit = options?.limit || 5;

  // Default empty response
  const emptyResponse: BuzzPatternsForPrompt = {
    hooks: '- まだ蓄積されていません',
    structures: '- まだ蓄積されていません',
    ctas: '- まだ蓄積されていません',
    avoidPatterns: '- まだ蓄積されていません',
    hasData: false,
  };

  try {
    // Build conditions for query
    let conditions = [
      eq(schema.buzzLearnings.userId, userId),
      eq(schema.buzzLearnings.isActive, 1),
    ];

    // Get all active buzz learnings for the user
    const learnings = await db
      .select()
      .from(schema.buzzLearnings)
      .where(and(...conditions))
      .orderBy(desc(schema.buzzLearnings.confidence))
      .limit(limit * 4); // Get more to filter by type

    if (learnings.length === 0) {
      return emptyResponse;
    }

    // Separate by learning type
    const hookPatterns = learnings.filter(l => l.learningType === 'hook_pattern');
    const structurePatterns = learnings.filter(l => l.learningType === 'structure_pattern');
    const ctaPatterns = learnings.filter(l => l.learningType === 'cta_pattern');
    const tonePatterns = learnings.filter(l => l.learningType === 'tone_pattern');

    // Format hook patterns
    let hooks = '- まだ蓄積されていません';
    if (hookPatterns.length > 0) {
      hooks = hookPatterns.slice(0, limit).map((p, i) => {
        let detail = '';
        try {
          const data = JSON.parse(p.patternData || '{}');
          if (data.topHooks && Array.isArray(data.topHooks)) {
            detail = `例: ${data.topHooks.slice(0, 2).join(', ')}`;
          }
        } catch {}
        return `${i + 1}. ${p.title}${p.description ? ` - ${p.description}` : ''}${detail ? ` (${detail})` : ''}`;
      }).join('\n');
    }

    // Format structure patterns
    let structures = '- まだ蓄積されていません';
    if (structurePatterns.length > 0) {
      structures = structurePatterns.slice(0, limit).map((p, i) => {
        let detail = '';
        try {
          const data = JSON.parse(p.patternData || '{}');
          if (data.mostEffectiveFormat) {
            const formatMap: Record<string, string> = {
              'problem_solution': '問題→解決',
              'list': 'リスト形式',
              'story': 'ストーリー形式',
              'question_answer': '質問→回答',
              'before_after': 'ビフォー→アフター',
              'single_point': '単一ポイント',
            };
            detail = formatMap[data.mostEffectiveFormat] || data.mostEffectiveFormat;
          }
        } catch {}
        return `${i + 1}. ${p.title}${detail ? ` (推奨形式: ${detail})` : ''}`;
      }).join('\n');
    }

    // Format CTA patterns
    let ctas = '- まだ蓄積されていません';
    if (ctaPatterns.length > 0) {
      ctas = ctaPatterns.slice(0, limit).map((p, i) => {
        let detail = '';
        try {
          const data = JSON.parse(p.patternData || '{}');
          if (data.explicitCTAs && Array.isArray(data.explicitCTAs)) {
            detail = `例: ${data.explicitCTAs.slice(0, 2).join(', ')}`;
          }
        } catch {}
        return `${i + 1}. ${p.title}${p.description ? ` - ${p.description}` : ''}${detail ? ` (${detail})` : ''}`;
      }).join('\n');
    }

    // Format avoid patterns (from tone patterns with low confidence or failure patterns)
    // Also check accountLearnings for failure_pattern
    let avoidPatterns = '- 特にありません';
    const lowConfidencePatterns = learnings.filter(l => (l.confidence || 0) < 40);
    if (lowConfidencePatterns.length > 0) {
      avoidPatterns = lowConfidencePatterns.slice(0, 3).map((p, i) => {
        return `${i + 1}. ${p.title}（効果が低い）`;
      }).join('\n');
    }

    return {
      hooks,
      structures,
      ctas,
      avoidPatterns,
      hasData: hookPatterns.length > 0 || structurePatterns.length > 0 || ctaPatterns.length > 0,
    };
  } catch (error) {
    logger.error({ err: error }, '[AccountLearningService] Error getting buzz learnings for prompt');
    return emptyResponse;
  }
}

/**
 * Get failure patterns for prompt (what to avoid)
 */
export async function getFailurePatternsForPrompt(
  accountId: number,
  options?: { limit?: number }
): Promise<string> {
  const limit = options?.limit || 3;

  try {
    const learnings = await getAccountLearnings(accountId, {
      learningTypes: ['failure_pattern'],
      minConfidence: 0,
      limit,
      activeOnly: true,
    });

    if (learnings.length === 0) {
      return '- 特にありません';
    }

    return learnings.map((p, i) => {
      let insight = '';
      try {
        const content = JSON.parse(p.content);
        insight = content.insight || content.description || '';
      } catch {}
      return `${i + 1}. ${p.title}${insight ? `: ${insight}` : ''}`;
    }).join('\n');
  } catch (error) {
    logger.error({ err: error }, '[AccountLearningService] Error getting failure patterns');
    return '- 特にありません';
  }
}

// ============================================
// Time-Decay Weighted Learning System
// ============================================

// Half-life for time decay (in days)
const TIME_DECAY_HALF_LIFE_DAYS = 14;

// Weight calculation options
export interface WeightOptions {
  halfLifeDays?: number;
  confidenceWeight?: number; // 0-1, how much confidence affects weight
  successRateWeight?: number; // 0-1, how much success rate affects weight
}

// Learning with calculated weight
export interface WeightedLearning extends AccountLearning {
  weight: number;
  decayFactor: number;
  ageInDays: number;
}

/**
 * Calculate time-decay based weight for a learning
 * Uses exponential decay with configurable half-life
 *
 * Weight formula: base_weight * decay_factor * confidence_factor * success_factor
 * where decay_factor = 2^(-days_since_creation / half_life)
 */
export function calculateLearningWeight(
  learning: AccountLearning,
  options: WeightOptions = {}
): { weight: number; decayFactor: number; ageInDays: number } {
  const {
    halfLifeDays = TIME_DECAY_HALF_LIFE_DAYS,
    confidenceWeight = 0.3,
    successRateWeight = 0.2,
  } = options;

  // Calculate age in days
  const createdAt = new Date(learning.createdAt);
  const now = new Date();
  const ageInMs = now.getTime() - createdAt.getTime();
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

  // Calculate exponential decay factor (1.0 at creation, 0.5 at half-life, etc.)
  const decayFactor = Math.pow(2, -ageInDays / halfLifeDays);

  // Normalize confidence and success rate to 0-1 range
  const confidenceFactor = learning.confidence / 100;
  const successRateFactor = learning.successRate / 100;

  // Calculate base weight (1.0)
  // Decay reduces weight over time
  // Confidence and success rate boost weight (weighted contribution)
  const weight =
    decayFactor *
    (1 - confidenceWeight - successRateWeight +
      confidenceWeight * confidenceFactor +
      successRateWeight * successRateFactor);

  return {
    weight: Math.max(0, Math.min(1, weight)), // Clamp to 0-1
    decayFactor,
    ageInDays,
  };
}

/**
 * Get weighted learnings for prompt generation
 * Returns learnings sorted by weight (most important first)
 */
export async function getWeightedLearningsForPrompt(
  accountId: number,
  options: {
    projectId?: number;
    learningTypes?: LearningType[];
    minWeight?: number;
    limit?: number;
    weightOptions?: WeightOptions;
  } = {}
): Promise<WeightedLearning[]> {
  const {
    projectId,
    learningTypes,
    minWeight = 0.1,
    limit = 10,
    weightOptions = {},
  } = options;

  // Get all active learnings
  const learnings = await getAccountLearnings(accountId, {
    projectId,
    learningTypes,
    minConfidence: 0, // We'll filter by weight instead
    limit: 100, // Get more initially, we'll filter and limit later
    activeOnly: true,
  });

  if (learnings.length === 0) {
    return [];
  }

  // Calculate weights for all learnings
  const weightedLearnings: WeightedLearning[] = learnings.map((learning) => {
    const { weight, decayFactor, ageInDays } = calculateLearningWeight(
      learning,
      weightOptions
    );
    return {
      ...learning,
      weight,
      decayFactor,
      ageInDays,
    };
  });

  // Filter by minimum weight and sort by weight descending
  return weightedLearnings
    .filter((l) => l.weight >= minWeight)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

/**
 * Format weighted learnings for prompt inclusion
 * Prioritizes recent, high-confidence, high-success learnings
 */
export async function formatWeightedLearningsForPrompt(
  accountId: number,
  options: {
    projectId?: number;
    forPostGeneration?: boolean;
    forCommentGeneration?: boolean;
    limit?: number;
  } = {}
): Promise<string> {
  const {
    projectId,
    forPostGeneration = true,
    forCommentGeneration = false,
    limit = 8,
  } = options;

  const learningTypes: LearningType[] = [];
  if (forPostGeneration) {
    learningTypes.push(
      'posting_style',
      'success_pattern',
      'hashtag_strategy',
      'timing_pattern',
      'topic_preference'
    );
  }
  if (forCommentGeneration) {
    learningTypes.push('comment_style', 'audience_insight');
  }

  // Get weighted learnings
  const weightedLearnings = await getWeightedLearningsForPrompt(accountId, {
    projectId,
    learningTypes,
    minWeight: 0.15,
    limit,
  });

  if (weightedLearnings.length === 0) {
    return '';
  }

  const sections: string[] = [];
  sections.push('## 📊 最近の学習（重要度順）');
  sections.push('以下の学習を特に重視してコンテンツを生成してください：\n');

  // Group by type for better organization
  const successPatterns = weightedLearnings.filter(
    (l) => l.learningType === 'success_pattern'
  );
  const failurePatterns = weightedLearnings.filter(
    (l) => l.learningType === 'failure_pattern'
  );
  const postingStyles = weightedLearnings.filter(
    (l) => l.learningType === 'posting_style'
  );
  const hashtagStrategies = weightedLearnings.filter(
    (l) => l.learningType === 'hashtag_strategy'
  );

  // Success patterns (do this)
  if (successPatterns.length > 0) {
    sections.push('### ✅ 効果的なパターン（真似する）');
    successPatterns.slice(0, 3).forEach((p, i) => {
      const priority = p.weight >= 0.7 ? '⭐ ' : '';
      const recency =
        p.ageInDays < 3 ? '(最新)' : p.ageInDays < 7 ? '(今週)' : '';
      try {
        const content = JSON.parse(p.content);
        sections.push(
          `${priority}${i + 1}. ${p.title} ${recency}\n   - ${content.insight || content.description || ''}`
        );
      } catch {
        sections.push(`${priority}${i + 1}. ${p.title} ${recency}`);
      }
    });
  }

  // Failure patterns (avoid this)
  if (failurePatterns.length > 0) {
    sections.push('\n### ❌ 避けるべきパターン');
    failurePatterns.slice(0, 2).forEach((p, i) => {
      try {
        const content = JSON.parse(p.content);
        sections.push(
          `${i + 1}. ${p.title}\n   - ${content.insight || content.description || ''}`
        );
      } catch {
        sections.push(`${i + 1}. ${p.title}`);
      }
    });
  }

  // Posting style
  if (postingStyles.length > 0) {
    sections.push('\n### 🎨 投稿スタイル');
    postingStyles.slice(0, 2).forEach((p) => {
      try {
        const content = JSON.parse(p.content);
        sections.push(`- ${content.description || p.title}`);
      } catch {
        sections.push(`- ${p.title}`);
      }
    });
  }

  // Hashtag strategy
  if (hashtagStrategies.length > 0) {
    sections.push('\n### #️⃣ ハッシュタグ傾向');
    hashtagStrategies.slice(0, 2).forEach((p) => {
      try {
        const content = JSON.parse(p.content);
        sections.push(`- ${content.description || p.title}`);
      } catch {
        sections.push(`- ${p.title}`);
      }
    });
  }

  return sections.join('\n');
}
