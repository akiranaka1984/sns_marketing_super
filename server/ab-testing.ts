/**
 * A/B Testing Engine
 * 
 * 同じテーマで複数の投稿バリエーションを生成し、
 * 最も効果的なスタイルを見つけ出す
 */

import { db } from "./db";
import {
  abTests,
  abTestVariations,
  abTestLearnings,
  agentKnowledge,
  agents,
  posts
} from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import {
  performStatisticalAnalysis,
  cohensD,
  interpretEffectSize,
  requiredSampleSize,
  type StatisticalAnalysis
} from "./utils/statistics";

// ============================================
// Types
// ============================================

interface VariationConfig {
  tone: "casual" | "formal" | "humorous" | "inspirational" | "educational";
  contentLength: "short" | "medium" | "long";
  emojiUsage: "none" | "minimal" | "moderate" | "heavy";
  hashtagCount: number;
  hasMedia: boolean;
}

interface GeneratedVariation {
  variationName: string;
  content: string;
  hashtags: string[];
  config: VariationConfig;
}

// ============================================
// Variation Generation
// ============================================

/**
 * 異なるスタイルのバリエーション設定を生成
 */
function generateVariationConfigs(count: number): VariationConfig[] {
  const tones: VariationConfig["tone"][] = ["casual", "formal", "humorous", "inspirational", "educational"];
  const lengths: VariationConfig["contentLength"][] = ["short", "medium", "long"];
  const emojiUsages: VariationConfig["emojiUsage"][] = ["none", "minimal", "moderate", "heavy"];
  
  const configs: VariationConfig[] = [];
  const variationNames = ["A", "B", "C", "D", "E", "F", "G", "H"];
  
  // 多様なバリエーションを生成
  for (let i = 0; i < count && i < variationNames.length; i++) {
    configs.push({
      tone: tones[i % tones.length],
      contentLength: lengths[i % lengths.length],
      emojiUsage: emojiUsages[i % emojiUsages.length],
      hashtagCount: (i % 4) + 1, // 1-4個
      hasMedia: i % 2 === 0 // 偶数番目はメディアあり
    });
  }
  
  return configs;
}

/**
 * テーマに基づいて複数のコンテンツバリエーションを生成
 */
export async function generateContentVariations(
  theme: string,
  count: number = 2,
  platform: string = "twitter"
): Promise<GeneratedVariation[]> {
  const configs = generateVariationConfigs(count);
  const variations: GeneratedVariation[] = [];
  const variationNames = ["A", "B", "C", "D", "E", "F", "G", "H"];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const variation = await generateSingleVariation(theme, config, platform, variationNames[i]);
    variations.push(variation);
  }

  return variations;
}

/**
 * 単一のバリエーションを生成
 */
async function generateSingleVariation(
  theme: string,
  config: VariationConfig,
  platform: string,
  variationName: string
): Promise<GeneratedVariation> {
  const lengthGuide = {
    short: "50文字以内",
    medium: "100-150文字",
    long: "200-280文字"
  };

  const emojiGuide = {
    none: "絵文字を使用しない",
    minimal: "絵文字を1-2個だけ使用",
    moderate: "絵文字を3-5個使用",
    heavy: "絵文字を多用（6個以上）"
  };

  const toneGuide = {
    casual: "カジュアルで親しみやすい口調",
    formal: "丁寧でプロフェッショナルな口調",
    humorous: "ユーモアを交えた楽しい口調",
    inspirational: "励ましや感動を与える口調",
    educational: "教育的で情報提供的な口調"
  };

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSNSコンテンツのスペシャリストです。
指定されたテーマとスタイルに基づいて、${platform}用の投稿を作成してください。

以下のJSON形式で回答してください:
{
  "content": "投稿本文",
  "hashtags": ["ハッシュタグ1", "ハッシュタグ2", ...]
}`
      },
      {
        role: "user",
        content: `テーマ: ${theme}

スタイル指定:
- トーン: ${toneGuide[config.tone]}
- 長さ: ${lengthGuide[config.contentLength]}
- 絵文字: ${emojiGuide[config.emojiUsage]}
- ハッシュタグ数: ${config.hashtagCount}個

このスタイルに合った投稿を作成してください。`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "variation_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            content: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } }
          },
          required: ["content", "hashtags"],
          additionalProperties: false
        }
      }
    }
  });

  const messageContent = response.choices[0]?.message?.content;
  if (!messageContent || typeof messageContent !== 'string') {
    throw new Error("Failed to generate variation content");
  }

  const result = JSON.parse(messageContent);

  return {
    variationName,
    content: result.content,
    hashtags: result.hashtags.slice(0, config.hashtagCount),
    config
  };
}

// ============================================
// A/B Test Management
// ============================================

/**
 * 新しいA/Bテストを作成
 */
export async function createAbTest(
  agentId: number,
  name: string,
  theme: string,
  variationCount: number = 2,
  testDurationHours: number = 48
): Promise<number> {
  const [result] = await db.insert(abTests).values({
    agentId,
    name,
    theme,
    variationCount,
    testDurationHours,
    status: "draft"
  });

  const testId = result.insertId;

  // バリエーションを生成
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId)
  });

  // Get platform from agent's linked accounts or default to twitter
  const platform = "twitter"; // Default platform for A/B testing
  const variations = await generateContentVariations(theme, variationCount, platform);

  // バリエーションをデータベースに保存
  for (const variation of variations) {
    await db.insert(abTestVariations).values({
      testId,
      variationName: variation.variationName,
      content: variation.content,
      hashtags: JSON.stringify(variation.hashtags),
      tone: variation.config.tone,
      contentLength: variation.config.contentLength,
      emojiUsage: variation.config.emojiUsage,
      hashtagCount: variation.config.hashtagCount,
      hasMedia: variation.config.hasMedia
    });
  }

  console.log(`[ABTesting] Created test ${testId} with ${variationCount} variations`);
  return testId;
}

/**
 * A/Bテストを開始
 */
export async function startAbTest(testId: number): Promise<void> {
  await db.update(abTests)
    .set({
      status: "running",
      startedAt: new Date()
    })
    .where(eq(abTests.id, testId));

  console.log(`[ABTesting] Started test ${testId}`);
}

/**
 * バリエーションに投稿を紐付け
 */
export async function linkPostToVariation(
  variationId: number,
  postId: number
): Promise<void> {
  await db.update(abTestVariations)
    .set({ postId })
    .where(eq(abTestVariations.id, variationId));
}

/**
 * バリエーションのエンゲージメントを更新
 */
export async function updateVariationEngagement(
  variationId: number,
  engagement: {
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    viewsCount: number;
  }
): Promise<void> {
  const totalEngagement = engagement.likesCount + engagement.commentsCount + engagement.sharesCount;
  const reach = engagement.viewsCount || 1;
  const engagementRate = Math.round((totalEngagement / reach) * 10000);

  await db.update(abTestVariations)
    .set({
      likesCount: engagement.likesCount,
      commentsCount: engagement.commentsCount,
      sharesCount: engagement.sharesCount,
      viewsCount: engagement.viewsCount,
      engagementRate
    })
    .where(eq(abTestVariations.id, variationId));
}

// ============================================
// Result Analysis
// ============================================

/**
 * Extended analysis result with statistical information
 */
export interface AnalysisResult {
  winnerId: number | null;
  confidence: number;
  analysis: string;
  statistics: {
    pValue: number | null;
    effectSize: number | null;
    effectSizeInterpretation: string;
    isStatisticallySignificant: boolean;
    confidenceInterval: {
      lower: number;
      upper: number;
    } | null;
    sampleSizeAdequate: boolean;
    requiredSampleSize: number;
    currentSampleSize: number;
    warnings: string[];
  } | null;
}

/**
 * A/Bテストの結果を分析し、勝者を決定
 * 統計的有意差検定を含む詳細な分析を実行
 */
export async function analyzeTestResults(testId: number): Promise<AnalysisResult> {
  const test = await db.query.abTests.findFirst({
    where: eq(abTests.id, testId)
  });

  if (!test) {
    throw new Error("Test not found");
  }

  const variations = await db.select()
    .from(abTestVariations)
    .where(eq(abTestVariations.testId, testId));

  if (variations.length < 2) {
    return {
      winnerId: null,
      confidence: 0,
      analysis: "Not enough variations",
      statistics: null
    };
  }

  // パフォーマンススコアを計算
  const scoredVariations = variations.map(v => {
    // 重み付けスコア: いいね(1) + コメント(3) + シェア(5)
    const weightedScore = v.likesCount + (v.commentsCount * 3) + (v.sharesCount * 5);
    return {
      ...v,
      weightedScore,
      performanceScore: Math.round((weightedScore / Math.max(v.viewsCount, 1)) * 1000)
    };
  });

  // スコアでソート
  scoredVariations.sort((a, b) => b.performanceScore - a.performanceScore);

  const winner = scoredVariations[0];
  const runnerUp = scoredVariations[1];

  // 統計分析を実行
  // 各バリエーションのエンゲージメント指標を配列に変換
  const winnerEngagement = [
    winner.likesCount,
    winner.commentsCount * 3,
    winner.sharesCount * 5,
    winner.performanceScore
  ];
  const runnerUpEngagement = [
    runnerUp.likesCount,
    runnerUp.commentsCount * 3,
    runnerUp.sharesCount * 5,
    runnerUp.performanceScore
  ];

  // より詳細な統計分析のためにすべてのバリエーションのスコアを収集
  const winnerScores = [winner.performanceScore];
  const otherScores = scoredVariations.slice(1).map(v => v.performanceScore);

  // 統計分析を実行
  const statAnalysis = performStatisticalAnalysis(
    winnerScores.length > 1 ? winnerScores : [winner.performanceScore, winner.performanceScore * 0.9],
    otherScores.length > 0 ? otherScores : [runnerUp.performanceScore]
  );

  // 効果量の計算
  const effectSizeValue = cohensD(
    [winner.performanceScore],
    otherScores
  );
  const effectSizeInterpretation = interpretEffectSize(effectSizeValue);

  // 統計的有意性に基づく信頼度を計算
  let confidence: number;
  let isStatisticallySignificant = false;

  if (statAnalysis.tTest && statAnalysis.tTest.pValue < 0.05) {
    // 統計的に有意な場合、p値に基づいて信頼度を計算
    confidence = Math.round((1 - statAnalysis.tTest.pValue) * 100);
    isStatisticallySignificant = true;
  } else {
    // 統計的に有意でない場合、従来の簡易計算
    const scoreDiff = winner.performanceScore - runnerUp.performanceScore;
    const avgScore = (winner.performanceScore + runnerUp.performanceScore) / 2;
    confidence = Math.min(100, Math.round((scoreDiff / Math.max(avgScore, 1)) * 100));
  }

  // 勝者を更新
  await db.update(abTestVariations)
    .set({
      isWinner: true,
      performanceScore: winner.performanceScore
    })
    .where(eq(abTestVariations.id, winner.id));

  // 他のバリエーションのスコアも更新
  for (const v of scoredVariations.slice(1)) {
    await db.update(abTestVariations)
      .set({ performanceScore: v.performanceScore })
      .where(eq(abTestVariations.id, v.id));
  }

  // テストを完了
  await db.update(abTests)
    .set({
      status: "completed",
      winnerId: winner.id,
      winnerDeterminedAt: new Date(),
      confidenceLevel: confidence,
      completedAt: new Date()
    })
    .where(eq(abTests.id, testId));

  // 分析結果を生成
  const significanceText = isStatisticallySignificant
    ? "統計的に有意な差があります"
    : "統計的に有意な差は確認できませんでした";

  const analysis = `バリエーション${winner.variationName}が勝者です。
トーン: ${winner.tone}
長さ: ${winner.contentLength}
絵文字使用: ${winner.emojiUsage}
パフォーマンススコア: ${winner.performanceScore}
信頼度: ${confidence}%

【統計分析】
${significanceText}
p値: ${statAnalysis.tTest?.pValue?.toFixed(4) ?? "N/A"}
効果量: ${effectSizeValue?.toFixed(2) ?? "N/A"} (${effectSizeInterpretation})
${statAnalysis.warnings.length > 0 ? "\n⚠️ 警告:\n" + statAnalysis.warnings.join("\n") : ""}`;

  console.log(`[ABTesting] Test ${testId} completed. Winner: Variation ${winner.variationName}`);

  return {
    winnerId: winner.id,
    confidence,
    analysis,
    statistics: {
      pValue: statAnalysis.tTest?.pValue ?? null,
      effectSize: effectSizeValue,
      effectSizeInterpretation,
      isStatisticallySignificant,
      confidenceInterval: statAnalysis.confidenceInterval
        ? {
            lower: statAnalysis.confidenceInterval.lower,
            upper: statAnalysis.confidenceInterval.upper
          }
        : null,
      sampleSizeAdequate: statAnalysis.sampleSizeAdequate,
      requiredSampleSize: statAnalysis.requiredSampleSize,
      currentSampleSize: statAnalysis.currentSampleSize,
      warnings: statAnalysis.warnings
    }
  };
}

// ============================================
// Learning Extraction
// ============================================

/**
 * テスト結果から学習を抽出してエージェントに適用
 */
export async function extractLearnings(testId: number): Promise<void> {
  const test = await db.query.abTests.findFirst({
    where: eq(abTests.id, testId)
  });

  if (!test || test.status !== "completed" || !test.winnerId) {
    console.log(`[ABTesting] Test ${testId} is not ready for learning extraction`);
    return;
  }

  const variations = await db.select()
    .from(abTestVariations)
    .where(eq(abTestVariations.testId, testId))
    .orderBy(desc(abTestVariations.performanceScore));

  if (variations.length < 2) return;

  const winner = variations[0];
  const loser = variations[variations.length - 1];

  // トーンの学習
  if (winner.tone !== loser.tone) {
    await db.insert(abTestLearnings).values({
      testId,
      agentId: test.agentId,
      learningType: "tone_preference",
      title: `${winner.tone}トーンが効果的`,
      insight: `A/Bテストの結果、${winner.tone}トーンが${loser.tone}トーンより${Math.round(((winner.performanceScore - loser.performanceScore) / Math.max(loser.performanceScore, 1)) * 100)}%高いパフォーマンスを示しました。`,
      winningValue: winner.tone || undefined,
      losingValue: loser.tone || undefined,
      performanceDiff: winner.performanceScore - loser.performanceScore,
      confidence: test.confidenceLevel || 50
    });

    // エージェントの知見にも追加
    await db.insert(agentKnowledge).values({
      agentId: test.agentId,
      knowledgeType: "success_pattern",
      title: `${winner.tone}トーンが効果的`,
      content: `A/Bテストの結果、${winner.tone}トーンが最も効果的でした。今後のコンテンツ生成に活用してください。`,
      confidence: test.confidenceLevel || 50,
      usageCount: 0,
      successRate: 100,
      isActive: true
    });
  }

  // 長さの学習
  if (winner.contentLength !== loser.contentLength) {
    await db.insert(abTestLearnings).values({
      testId,
      agentId: test.agentId,
      learningType: "length_preference",
      title: `${winner.contentLength}の長さが効果的`,
      insight: `A/Bテストの結果、${winner.contentLength}の長さのコンテンツが最も効果的でした。`,
      winningValue: winner.contentLength,
      losingValue: loser.contentLength,
      performanceDiff: winner.performanceScore - loser.performanceScore,
      confidence: test.confidenceLevel || 50
    });
  }

  // 絵文字使用の学習
  if (winner.emojiUsage !== loser.emojiUsage) {
    await db.insert(abTestLearnings).values({
      testId,
      agentId: test.agentId,
      learningType: "emoji_preference",
      title: `絵文字使用: ${winner.emojiUsage}が効果的`,
      insight: `A/Bテストの結果、絵文字を${winner.emojiUsage}で使用するのが最も効果的でした。`,
      winningValue: winner.emojiUsage,
      losingValue: loser.emojiUsage,
      performanceDiff: winner.performanceScore - loser.performanceScore,
      confidence: test.confidenceLevel || 50
    });
  }

  // ハッシュタグ数の学習
  if (winner.hashtagCount !== loser.hashtagCount) {
    await db.insert(abTestLearnings).values({
      testId,
      agentId: test.agentId,
      learningType: "hashtag_preference",
      title: `ハッシュタグ${winner.hashtagCount}個が効果的`,
      insight: `A/Bテストの結果、ハッシュタグを${winner.hashtagCount}個使用するのが最も効果的でした。`,
      winningValue: winner.hashtagCount.toString(),
      losingValue: loser.hashtagCount.toString(),
      performanceDiff: winner.performanceScore - loser.performanceScore,
      confidence: test.confidenceLevel || 50
    });
  }

  console.log(`[ABTesting] Extracted learnings from test ${testId}`);
}

/**
 * A/Bテストの詳細を取得
 */
export async function getTestDetails(testId: number) {
  const test = await db.query.abTests.findFirst({
    where: eq(abTests.id, testId)
  });

  if (!test) return null;

  const variations = await db.select()
    .from(abTestVariations)
    .where(eq(abTestVariations.testId, testId))
    .orderBy(desc(abTestVariations.performanceScore));

  const learnings = await db.select()
    .from(abTestLearnings)
    .where(eq(abTestLearnings.testId, testId));

  return {
    test,
    variations,
    learnings
  };
}

/**
 * エージェントのA/Bテスト一覧を取得
 */
export async function getAgentTests(agentId: number) {
  return await db.select()
    .from(abTests)
    .where(eq(abTests.agentId, agentId))
    .orderBy(desc(abTests.createdAt));
}

// エクスポート
export {
  generateVariationConfigs,
  generateSingleVariation
};
