/**
 * Strategy Optimizer Service
 * 
 * エンゲージメント分析結果に基づいて
 * エージェントの戦略を自動最適化するサービス
 */

import { db } from "../db";
import { agents, strategies, aiOptimizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { EngagementInsight } from "./engagement-analyzer";

import { createLogger } from "../utils/logger";

const logger = createLogger("strategy-optimizer");

export interface OptimizationSuggestion {
  type: 'tone_adjustment' | 'style_adjustment' | 'content_strategy' | 'timing_optimization';
  title: string;
  description: string;
  beforeParams: Record<string, any>;
  afterParams: Record<string, any>;
  expectedImprovement: number;
  confidence: number;
}

/**
 * インサイトに基づいて最適化提案を生成
 */
export async function generateOptimizationSuggestions(
  agentId: number,
  insights: EngagementInsight[]
): Promise<OptimizationSuggestion[]> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  const suggestions: OptimizationSuggestion[] = [];

  for (const insight of insights) {
    switch (insight.type) {
      case 'success_pattern':
        // 成功パターンに基づくコンテンツ戦略の最適化
        if (insight.content.includes('ハッシュタグ')) {
          suggestions.push({
            type: 'content_strategy',
            title: 'ハッシュタグ戦略の強化',
            description: '高パフォーマンス投稿ではハッシュタグが効果的に使用されています。今後の投稿でもハッシュタグを積極的に活用することを推奨します。',
            beforeParams: { hashtagUsage: 'minimal' },
            afterParams: { hashtagUsage: 'moderate' },
            expectedImprovement: 15,
            confidence: insight.confidence,
          });
        }

        if (insight.content.includes('質問形式')) {
          suggestions.push({
            type: 'style_adjustment',
            title: '質問形式の投稿スタイル採用',
            description: '質問形式の投稿がエンゲージメントを高めています。フォロワーとの対話を促進するスタイルに調整します。',
            beforeParams: { style: agent.style },
            afterParams: { style: 'tutorial' }, // 質問形式を含むスタイル
            expectedImprovement: 20,
            confidence: insight.confidence,
          });
        }
        break;

      case 'failure_pattern':
        // 失敗パターンに基づくトーン調整
        suggestions.push({
          type: 'tone_adjustment',
          title: 'トーンの見直し',
          description: 'エンゲージメントが低い投稿パターンが検出されました。よりフレンドリーなトーンに調整することを推奨します。',
          beforeParams: { tone: agent.tone },
          afterParams: { tone: 'friendly' },
          expectedImprovement: 10,
          confidence: insight.confidence,
        });
        break;

      case 'timing_insight':
        // 投稿時間帯の最適化
        const timeMatch = insight.content.match(/（(\d+)-(\d+)時）/);
        if (timeMatch) {
          const startHour = parseInt(timeMatch[1]);
          const endHour = parseInt(timeMatch[2]);
          const optimalTime = `${startHour.toString().padStart(2, '0')}:00`;

          suggestions.push({
            type: 'timing_optimization',
            title: '投稿時間帯の最適化',
            description: insight.content,
            beforeParams: { 
              postingTimeSlots: agent.postingTimeSlots ? JSON.parse(agent.postingTimeSlots) : [] 
            },
            afterParams: { 
              postingTimeSlots: [optimalTime] 
            },
            expectedImprovement: 25,
            confidence: insight.confidence,
          });
        }
        break;
    }
  }

  return suggestions;
}

/**
 * 最適化提案を適用
 */
export async function applyOptimization(
  agentId: number,
  suggestion: OptimizationSuggestion
): Promise<void> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  // 最適化履歴を記録
  await db.insert(aiOptimizations).values({
    userId: agent.userId,
    projectId: agent.projectId,
    agentId: agent.id,
    type: suggestion.type,
    beforeParams: JSON.stringify(suggestion.beforeParams),
    afterParams: JSON.stringify(suggestion.afterParams),
    performanceImprovement: suggestion.expectedImprovement,
    insights: suggestion.description,
    status: 'applied',
    appliedAt: new Date().toISOString(),
  });

  // エージェント設定を更新
  const updateData: any = {};

  switch (suggestion.type) {
    case 'tone_adjustment':
      updateData.tone = suggestion.afterParams.tone;
      break;
    case 'style_adjustment':
      updateData.style = suggestion.afterParams.style;
      break;
    case 'timing_optimization':
      updateData.postingTimeSlots = JSON.stringify(suggestion.afterParams.postingTimeSlots);
      break;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(agents)
      .set({
        ...updateData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, agentId));
  }

  logger.info(`[StrategyOptimizer] Applied optimization "${suggestion.title}" to agent ${agentId}`);
}

/**
 * 複数の最適化提案を一括適用
 */
export async function applyMultipleOptimizations(
  agentId: number,
  suggestions: OptimizationSuggestion[]
): Promise<{
  applied: number;
  failed: number;
  errors: string[];
}> {
  let applied = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const suggestion of suggestions) {
    try {
      await applyOptimization(agentId, suggestion);
      applied++;
    } catch (error) {
      failed++;
      errors.push(`${suggestion.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { applied, failed, errors };
}

/**
 * 最適化の効果を評価
 */
export async function evaluateOptimizationImpact(
  agentId: number,
  optimizationId: number,
  actualImprovement: number
): Promise<void> {
  await db.update(aiOptimizations)
    .set({
      performanceImprovement: actualImprovement,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(aiOptimizations.id, optimizationId));

  logger.info(`[StrategyOptimizer] Updated optimization ${optimizationId} with actual improvement: ${actualImprovement}%`);
}

/**
 * エージェントの最適化履歴を取得
 */
export async function getOptimizationHistory(
  agentId: number,
  limit: number = 10
): Promise<any[]> {
  const history = await db.query.aiOptimizations.findMany({
    where: eq(aiOptimizations.agentId, agentId),
    orderBy: (aiOptimizations, { desc }) => [desc(aiOptimizations.createdAt)],
    limit,
  });

  return history;
}
