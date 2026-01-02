/**
 * X Web版投稿の座標自動調整機能
 * ステップテストの結果に基づいて最適な座標を学習・調整
 */

import { db } from './db';
import { coordinateLearningData } from '../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { testPostStep } from './x-web-diagnosis';

export interface CoordinateTuningResult {
  success: boolean;
  resolution: string;
  adjustedCoordinates: {
    composeButton?: { x: number; y: number; confidence: number };
    textArea?: { x: number; y: number; confidence: number };
    postButton?: { x: number; y: number; confidence: number };
  };
  learningData: {
    totalTests: number;
    successfulTests: number;
    successRate: number;
  };
  recommendations: string[];
}

/**
 * ステップテストを実行して座標を自動調整
 */
export async function autoTuneCoordinates(
  deviceId: string,
  resolution: string,
  testContent: string = 'テスト投稿 for coordinate tuning'
): Promise<CoordinateTuningResult> {
  const result: CoordinateTuningResult = {
    success: false,
    resolution,
    adjustedCoordinates: {},
    learningData: {
      totalTests: 0,
      successfulTests: 0,
      successRate: 0
    },
    recommendations: []
  };

  try {
    console.log('[CoordinateTuner] Starting coordinate tuning...');
    console.log(`[CoordinateTuner] Device: ${deviceId}, Resolution: ${resolution}`);

    // ステップテストを実行
    const steps = await testPostStep(deviceId, testContent);

    // 各ステップの成功/失敗を分析
    const composeButtonStep = steps.find(s => s.step === 'step_4_click_compose');
    const textAreaStep = steps.find(s => s.step === 'step_5_input_text');
    const postButtonStep = steps.find(s => s.step === 'step_6_click_post');

    // 学習データを記録
    if (composeButtonStep) {
      await recordLearningData(
        deviceId,
        resolution,
        'composeButton',
        composeButtonStep.success,
        composeButtonStep.screenshotUrl || undefined
      );
    }

    if (textAreaStep) {
      await recordLearningData(
        deviceId,
        resolution,
        'textArea',
        textAreaStep.success,
        textAreaStep.screenshotUrl || undefined
      );
    }

    if (postButtonStep) {
      await recordLearningData(
        deviceId,
        resolution,
        'postButton',
        postButtonStep.success,
        postButtonStep.screenshotUrl || undefined
      );
    }

    // 学習データから最適な座標を計算
    const adjustedCoords = await calculateOptimalCoordinates(resolution);
    result.adjustedCoordinates = adjustedCoords;

    // 学習データの統計を取得
    const stats = await getLearningStats(resolution);
    result.learningData = stats;

    // 推奨事項を生成
    result.recommendations = generateRecommendations(steps, adjustedCoords);

    // 全てのステップが成功した場合のみsuccess = true
    result.success = steps.every(s => s.success);

    console.log('[CoordinateTuner] Tuning completed');
    console.log(`[CoordinateTuner] Success rate: ${stats.successRate}%`);

  } catch (error: any) {
    console.error('[CoordinateTuner] Error:', error);
    result.recommendations.push(`Auto-tuning failed: ${error.message}`);
  }

  return result;
}

/**
 * 学習データを記録
 */
async function recordLearningData(
  deviceId: string,
  resolution: string,
  element: string,
  success: boolean,
  screenshotUrl?: string | undefined
): Promise<void> {
  try {
    await db.insert(coordinateLearningData).values({
      deviceId,
      resolution,
      element,
      success: success ? 1 : 0,
      screenshotUrl: screenshotUrl || null,
      createdAt: new Date()
    });

    console.log(`[CoordinateTuner] Recorded learning data: ${element} = ${success ? 'SUCCESS' : 'FAIL'}`);
  } catch (error: any) {
    console.error('[CoordinateTuner] Failed to record learning data:', error);
  }
}

/**
 * 学習データから最適な座標を計算
 */
async function calculateOptimalCoordinates(resolution: string): Promise<{
  composeButton?: { x: number; y: number; confidence: number };
  textArea?: { x: number; y: number; confidence: number };
  postButton?: { x: number; y: number; confidence: number };
}> {
  const result: any = {};

  const elements = ['composeButton', 'textArea', 'postButton'];

  for (const element of elements) {
    // 最近の学習データを取得（最大100件）
    const learningData = await db
      .select()
      .from(coordinateLearningData)
      .where(
        and(
          eq(coordinateLearningData.resolution, resolution),
          eq(coordinateLearningData.element, element)
        )
      )
      .orderBy(desc(coordinateLearningData.createdAt))
      .limit(100);

    if (learningData.length === 0) {
      continue;
    }

    // 成功率を計算
    const successCount = learningData.filter(d => d.success === 1).length;
    const totalCount = learningData.length;
    const successRate = (successCount / totalCount) * 100;

    // 現在の座標を取得（デフォルト値）
    const currentCoords = getDefaultCoordinates(resolution, element);

    // 成功率が80%以上なら現在の座標を維持
    if (successRate >= 80) {
      result[element] = {
        ...currentCoords,
        confidence: successRate
      };
    } else {
      // 成功率が低い場合は調整を推奨
      const adjustedCoords = suggestCoordinateAdjustment(resolution, element, successRate);
      result[element] = {
        ...adjustedCoords,
        confidence: successRate
      };
    }
  }

  return result;
}

/**
 * デフォルト座標を取得
 */
function getDefaultCoordinates(
  resolution: string,
  element: string
): { x: number; y: number } {
  const coords: Record<string, Record<string, { x: number; y: number }>> = {
    '1080x2400': {
      composeButton: { x: 960, y: 2200 },
      textArea: { x: 540, y: 800 },
      postButton: { x: 960, y: 140 },
    },
    '1080x1920': {
      composeButton: { x: 960, y: 1700 },
      textArea: { x: 540, y: 600 },
      postButton: { x: 960, y: 120 },
    },
    '1080x2340': {
      composeButton: { x: 960, y: 2150 },
      textArea: { x: 540, y: 780 },
      postButton: { x: 960, y: 135 },
    },
  };

  return coords[resolution]?.[element] || coords['1080x2400'][element] || { x: 0, y: 0 };
}

/**
 * 座標調整を提案
 */
function suggestCoordinateAdjustment(
  resolution: string,
  element: string,
  currentSuccessRate: number
): { x: number; y: number } {
  const currentCoords = getDefaultCoordinates(resolution, element);
  const [width, height] = resolution.split('x').map(Number);

  // 成功率に基づいて調整量を決定
  const adjustmentFactor = Math.max(0.95, 1 - (100 - currentSuccessRate) / 100);

  switch (element) {
    case 'composeButton':
      // 右下のボタン: 少し左上に移動
      return {
        x: Math.round(currentCoords.x * adjustmentFactor),
        y: Math.round(currentCoords.y * adjustmentFactor)
      };

    case 'textArea':
      // 中央のテキストエリア: 位置を維持
      return currentCoords;

    case 'postButton':
      // 右上のボタン: 少し左に移動
      return {
        x: Math.round(currentCoords.x * adjustmentFactor),
        y: currentCoords.y
      };

    default:
      return currentCoords;
  }
}

/**
 * 学習データの統計を取得
 */
async function getLearningStats(resolution: string): Promise<{
  totalTests: number;
  successfulTests: number;
  successRate: number;
}> {
  const learningData = await db
    .select()
    .from(coordinateLearningData)
    .where(eq(coordinateLearningData.resolution, resolution))
    .orderBy(desc(coordinateLearningData.createdAt))
    .limit(100);

  const totalTests = learningData.length;
  const successfulTests = learningData.filter(d => d.success === 1).length;
  const successRate = totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0;

  return {
    totalTests,
    successfulTests,
    successRate
  };
}

/**
 * 推奨事項を生成
 */
function generateRecommendations(
  steps: any[],
  adjustedCoords: any
): string[] {
  const recommendations: string[] = [];

  // 失敗したステップを特定
  const failedSteps = steps.filter(s => !s.success);

  if (failedSteps.length === 0) {
    recommendations.push('All steps succeeded! Current coordinates are optimal.');
    return recommendations;
  }

  failedSteps.forEach(step => {
    switch (step.step) {
      case 'step_4_click_compose':
        if (adjustedCoords.composeButton) {
          recommendations.push(
            `Compose button tap failed. Suggested coordinates: (${adjustedCoords.composeButton.x}, ${adjustedCoords.composeButton.y}). ` +
            `Confidence: ${adjustedCoords.composeButton.confidence.toFixed(1)}%`
          );
        } else {
          recommendations.push(
            'Compose button tap failed. Please check screenshot and manually adjust coordinates in getCoordinates function.'
          );
        }
        break;

      case 'step_5_input_text':
        if (adjustedCoords.textArea) {
          recommendations.push(
            `Text input failed. Suggested coordinates: (${adjustedCoords.textArea.x}, ${adjustedCoords.textArea.y}). ` +
            `Confidence: ${adjustedCoords.textArea.confidence.toFixed(1)}%`
          );
        } else {
          recommendations.push(
            'Text input failed. Please check screenshot and manually adjust coordinates in getCoordinates function.'
          );
        }
        break;

      case 'step_6_click_post':
        if (adjustedCoords.postButton) {
          recommendations.push(
            `Post button tap failed. Suggested coordinates: (${adjustedCoords.postButton.x}, ${adjustedCoords.postButton.y}). ` +
            `Confidence: ${adjustedCoords.postButton.confidence.toFixed(1)}%`
          );
        } else {
          recommendations.push(
            'Post button tap failed. Please check screenshot and manually adjust coordinates in getCoordinates function.'
          );
        }
        break;
    }
  });

  return recommendations;
}

/**
 * 座標設定ファイルを自動更新
 */
export async function applyCoordinateAdjustments(
  resolution: string,
  adjustedCoordinates: {
    composeButton?: { x: number; y: number };
    textArea?: { x: number; y: number };
    postButton?: { x: number; y: number };
  }
): Promise<{ success: boolean; message: string }> {
  try {
    // 座標設定をJSONファイルに保存
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'server', 'x-web-coordinates.json');
    
    // 既存の設定を読み込み
    let config: Record<string, any> = {};
    try {
      const existingConfig = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(existingConfig);
    } catch (error) {
      // ファイルが存在しない場合は新規作成
      config = {};
    }

    // 新しい座標を追加
    if (!config[resolution]) {
      config[resolution] = {};
    }

    if (adjustedCoordinates.composeButton) {
      config[resolution].composeButton = adjustedCoordinates.composeButton;
    }

    if (adjustedCoordinates.textArea) {
      config[resolution].textArea = adjustedCoordinates.textArea;
    }

    if (adjustedCoordinates.postButton) {
      config[resolution].postButton = adjustedCoordinates.postButton;
    }

    // ファイルに書き込み
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('[CoordinateTuner] Coordinate configuration updated:', configPath);

    return {
      success: true,
      message: `Coordinates updated for resolution ${resolution}. Please restart the server to apply changes.`
    };

  } catch (error: any) {
    console.error('[CoordinateTuner] Failed to apply coordinate adjustments:', error);
    return {
      success: false,
      message: `Failed to update coordinates: ${error.message}`
    };
  }
}
