/**
 * Auto-Optimization Scheduler Service
 *
 * パフォーマンスに応じてAIが戦略を自動調整するスケジューラー
 * 定期的にエージェントのパフォーマンスを分析し、
 * 閾値を下回った場合に自動的に最適化を実行
 */

import { db } from "../db";
import { agents, aiOptimizations } from "../../drizzle/schema";
import { eq, and, gte, desc, lt, isNotNull } from "drizzle-orm";
import { analyzeAgentPerformance, saveInsightsToKnowledge } from "./engagement-analyzer";
import { generateOptimizationSuggestions, applyOptimization, OptimizationSuggestion } from "./strategy-optimizer";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Auto-optimization settings per agent (stored in JSON in agents table)
export interface AutoOptimizationSettings {
  enabled: boolean;
  minEngagementRateThreshold: number;  // Minimum engagement rate (%) to trigger optimization
  checkIntervalHours: number;          // How often to check (in hours)
  maxAutoOptimizationsPerWeek: number; // Limit auto-optimizations
  requireConfirmation: boolean;        // If true, create pending instead of auto-apply
  optimizationTypes: ('tone_adjustment' | 'style_adjustment' | 'content_strategy' | 'timing_optimization')[];
}

export const DEFAULT_AUTO_OPTIMIZATION_SETTINGS: AutoOptimizationSettings = {
  enabled: false,
  minEngagementRateThreshold: 3.0,
  checkIntervalHours: 24,
  maxAutoOptimizationsPerWeek: 3,
  requireConfirmation: true,
  optimizationTypes: ['tone_adjustment', 'style_adjustment', 'content_strategy', 'timing_optimization'],
};

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour for agents needing optimization

/**
 * Start the auto-optimization scheduler
 */
export function startAutoOptimizationScheduler() {
  if (schedulerInterval) {
    console.log('[AutoOptimization] Scheduler already running');
    return;
  }

  console.log('[AutoOptimization] Starting scheduler...');

  // Run immediately on start
  runOptimizationCheck().catch(console.error);

  // Then run periodically
  schedulerInterval = setInterval(() => {
    runOptimizationCheck().catch(console.error);
  }, CHECK_INTERVAL_MS);

  console.log('[AutoOptimization] Scheduler started (checking every hour)');
}

/**
 * Stop the auto-optimization scheduler
 */
export function stopAutoOptimizationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[AutoOptimization] Scheduler stopped');
  }
}

/**
 * Main optimization check function
 */
async function runOptimizationCheck(): Promise<void> {
  console.log('[AutoOptimization] Running optimization check...');

  try {
    // Get all active agents with auto-optimization enabled
    const activeAgents = await db.query.agents.findMany({
      where: eq(agents.isActive, 1),
    });

    for (const agent of activeAgents) {
      try {
        await checkAndOptimizeAgent(agent);
      } catch (error) {
        console.error(`[AutoOptimization] Error processing agent ${agent.id}:`, error);
      }
    }

    console.log(`[AutoOptimization] Check completed for ${activeAgents.length} agents`);
  } catch (error) {
    console.error('[AutoOptimization] Error in optimization check:', error);
  }
}

/**
 * Parse auto-optimization settings from agent
 */
function getAutoOptimizationSettings(agent: any): AutoOptimizationSettings {
  try {
    if (agent.autoOptimizationSettings) {
      const parsed = typeof agent.autoOptimizationSettings === 'string'
        ? JSON.parse(agent.autoOptimizationSettings)
        : agent.autoOptimizationSettings;
      return { ...DEFAULT_AUTO_OPTIMIZATION_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn(`[AutoOptimization] Failed to parse settings for agent ${agent.id}`);
  }
  return DEFAULT_AUTO_OPTIMIZATION_SETTINGS;
}

/**
 * Check if agent needs optimization and apply if necessary
 */
async function checkAndOptimizeAgent(agent: any): Promise<void> {
  const settings = getAutoOptimizationSettings(agent);

  // Skip if auto-optimization is disabled
  if (!settings.enabled) {
    return;
  }

  // Check if enough time has passed since last check
  const lastOptimization = await db.query.aiOptimizations.findFirst({
    where: eq(aiOptimizations.agentId, agent.id),
    orderBy: [desc(aiOptimizations.createdAt)],
  });

  if (lastOptimization) {
    const lastCheckTime = new Date(lastOptimization.createdAt);
    const hoursSinceLastCheck = (Date.now() - lastCheckTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastCheck < settings.checkIntervalHours) {
      return; // Not enough time has passed
    }
  }

  // Check weekly optimization limit
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const recentOptimizations = await db.query.aiOptimizations.findMany({
    where: and(
      eq(aiOptimizations.agentId, agent.id),
      gte(aiOptimizations.createdAt, toMySQLTimestamp(weekAgo))
    ),
  });

  if (recentOptimizations.length >= settings.maxAutoOptimizationsPerWeek) {
    console.log(`[AutoOptimization] Agent ${agent.id} reached weekly limit (${recentOptimizations.length}/${settings.maxAutoOptimizationsPerWeek})`);
    return;
  }

  // Analyze agent performance
  console.log(`[AutoOptimization] Analyzing performance for agent ${agent.id}...`);
  const performance = await analyzeAgentPerformance(agent.id, 7);

  // Check if optimization is needed
  if (performance.totalPosts < 3) {
    console.log(`[AutoOptimization] Agent ${agent.id} has insufficient posts (${performance.totalPosts}) for analysis`);
    return;
  }

  if (performance.avgEngagementRate >= settings.minEngagementRateThreshold) {
    console.log(`[AutoOptimization] Agent ${agent.id} engagement (${performance.avgEngagementRate.toFixed(2)}%) is above threshold (${settings.minEngagementRateThreshold}%)`);
    return;
  }

  console.log(`[AutoOptimization] Agent ${agent.id} engagement (${performance.avgEngagementRate.toFixed(2)}%) is below threshold (${settings.minEngagementRateThreshold}%). Generating suggestions...`);

  // Save insights to knowledge base
  await saveInsightsToKnowledge(agent.id, performance.insights);

  // Generate optimization suggestions
  const suggestions = await generateOptimizationSuggestions(agent.id, performance.insights);

  // Filter by allowed optimization types
  const filteredSuggestions = suggestions.filter(s =>
    settings.optimizationTypes.includes(s.type)
  );

  if (filteredSuggestions.length === 0) {
    console.log(`[AutoOptimization] No applicable suggestions for agent ${agent.id}`);
    return;
  }

  // Sort by confidence and expected improvement
  const sortedSuggestions = filteredSuggestions.sort((a, b) =>
    (b.confidence * b.expectedImprovement) - (a.confidence * a.expectedImprovement)
  );

  // Take the best suggestion
  const bestSuggestion = sortedSuggestions[0];

  if (settings.requireConfirmation) {
    // Create pending optimization for user review
    await createPendingOptimization(agent, bestSuggestion, performance.avgEngagementRate);
    console.log(`[AutoOptimization] Created pending optimization for agent ${agent.id}: "${bestSuggestion.title}"`);
  } else {
    // Apply automatically
    await applyOptimization(agent.id, bestSuggestion);
    console.log(`[AutoOptimization] Applied optimization for agent ${agent.id}: "${bestSuggestion.title}"`);
  }
}

/**
 * Create a pending optimization record for user confirmation
 */
async function createPendingOptimization(
  agent: any,
  suggestion: OptimizationSuggestion,
  currentEngagement: number
): Promise<void> {
  await db.insert(aiOptimizations).values({
    userId: agent.userId,
    projectId: agent.projectId,
    agentId: agent.id,
    type: suggestion.type,
    beforeParams: JSON.stringify({
      ...suggestion.beforeParams,
      currentEngagementRate: currentEngagement,
    }),
    afterParams: JSON.stringify(suggestion.afterParams),
    performanceImprovement: suggestion.expectedImprovement,
    insights: suggestion.description,
    status: 'pending',
  });
}

/**
 * Get pending optimizations for an agent
 */
export async function getPendingOptimizations(agentId: number): Promise<any[]> {
  return db.query.aiOptimizations.findMany({
    where: and(
      eq(aiOptimizations.agentId, agentId),
      eq(aiOptimizations.status, 'pending')
    ),
    orderBy: [desc(aiOptimizations.createdAt)],
  });
}

/**
 * Approve and apply a pending optimization
 */
export async function approveOptimization(optimizationId: number): Promise<void> {
  const optimization = await db.query.aiOptimizations.findFirst({
    where: eq(aiOptimizations.id, optimizationId),
  });

  if (!optimization) {
    throw new Error('Optimization not found');
  }

  if (optimization.status !== 'pending') {
    throw new Error('Optimization is not pending');
  }

  // Parse the suggestion from stored data
  const afterParams = JSON.parse(optimization.afterParams || '{}');
  const beforeParams = JSON.parse(optimization.beforeParams || '{}');

  const suggestion: OptimizationSuggestion = {
    type: optimization.type as any,
    title: '',
    description: optimization.insights || '',
    beforeParams,
    afterParams,
    expectedImprovement: optimization.performanceImprovement || 0,
    confidence: 70,
  };

  // Apply the optimization
  await applyOptimization(optimization.agentId!, suggestion);

  // Update status
  await db.update(aiOptimizations)
    .set({
      status: 'applied',
      appliedAt: toMySQLTimestamp(new Date()),
      updatedAt: toMySQLTimestamp(new Date()),
    })
    .where(eq(aiOptimizations.id, optimizationId));
}

/**
 * Reject a pending optimization
 */
export async function rejectOptimization(optimizationId: number): Promise<void> {
  await db.update(aiOptimizations)
    .set({
      status: 'reverted', // Using 'reverted' status to indicate rejection
      updatedAt: toMySQLTimestamp(new Date()),
    })
    .where(eq(aiOptimizations.id, optimizationId));
}

/**
 * Manual trigger for optimization check on specific agent
 */
export async function triggerOptimizationCheck(agentId: number): Promise<{
  needsOptimization: boolean;
  currentEngagement: number;
  threshold: number;
  suggestions: OptimizationSuggestion[];
}> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  const settings = getAutoOptimizationSettings(agent);
  const performance = await analyzeAgentPerformance(agentId, 7);

  const needsOptimization = performance.avgEngagementRate < settings.minEngagementRateThreshold;

  let suggestions: OptimizationSuggestion[] = [];
  if (needsOptimization && performance.insights.length > 0) {
    suggestions = await generateOptimizationSuggestions(agentId, performance.insights);
  }

  return {
    needsOptimization,
    currentEngagement: performance.avgEngagementRate,
    threshold: settings.minEngagementRateThreshold,
    suggestions,
  };
}
