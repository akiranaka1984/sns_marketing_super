/**
 * Growth Loop Orchestrator Service
 *
 * プロジェクト単位で自律的な成長サイクルを実行する中央制御エンジン。
 * 各インターバルで KPI チェック、パフォーマンス学習、戦略評価、
 * 戦略再生成、フルレビューを実行し、executionMode に基づいて
 * 自動適用 / 承認待ち / ログのみを切り替える。
 */

import { db } from "../db";
import {
  projects,
  agents,
  strategies,
  posts,
  postAnalytics,
  accounts,
  growthLoopState,
  growthLoopActions,
  projectKpiTracking,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { runAgent } from "../agent-engine";
import { analyzeAgentPerformance } from "./engagement-analyzer";
import {
  generateOptimizationSuggestions,
  applyOptimization,
} from "./strategy-optimizer";
import { invokeLLM } from "../_core/llm";

// ============================================
// Types
// ============================================

type ExecutionMode = "fullAuto" | "confirm" | "manual";

interface ProjectLoopTimers {
  kpiCheck: NodeJS.Timeout;
  performanceUpdate: NodeJS.Timeout;
  strategyEvaluation: NodeJS.Timeout;
  strategyRegeneration: NodeJS.Timeout;
  fullReview: NodeJS.Timeout;
}

// ============================================
// Constants
// ============================================

const INTERVALS = {
  KPI_CHECK_MS: 10 * 60 * 1000,            // 10 minutes
  PERFORMANCE_UPDATE_MS: 30 * 60 * 1000,    // 30 minutes
  STRATEGY_EVALUATION_MS: 60 * 60 * 1000,   // 1 hour
  STRATEGY_REGENERATION_MS: 6 * 60 * 60 * 1000, // 6 hours
  FULL_REVIEW_MS: 24 * 60 * 60 * 1000,      // 24 hours
} as const;

const POOR_STRATEGY_THRESHOLD = 40; // Score below this triggers regeneration
const DECLINING_THRESHOLD = 3;      // Consecutive declines before escalation

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// ============================================
// Scheduler State
// ============================================

let schedulerInterval: NodeJS.Timeout | null = null;
const projectTimers = new Map<number, ProjectLoopTimers>();

// ============================================
// Public API
// ============================================

/**
 * Start the growth loop orchestrator.
 * Discovers active projects and sets up per-project interval timers.
 */
export function startGrowthLoopOrchestrator() {
  if (schedulerInterval) {
    console.log("[GrowthLoop] Orchestrator already running");
    return;
  }

  console.log("[GrowthLoop] Starting orchestrator...");

  // Initial setup for all active projects
  initializeAllProjects().catch((err) =>
    console.error("[GrowthLoop] Error during initial project setup:", err)
  );

  // Periodically discover new/changed projects (every 5 minutes)
  schedulerInterval = setInterval(() => {
    syncActiveProjects().catch((err) =>
      console.error("[GrowthLoop] Error syncing active projects:", err)
    );
  }, 5 * 60 * 1000);

  console.log("[GrowthLoop] Orchestrator started");
}

/**
 * Stop the growth loop orchestrator and clear all project timers.
 */
export function stopGrowthLoopOrchestrator() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  // Clear all project-level timers
  for (const [projectId, timers] of projectTimers.entries()) {
    clearProjectTimers(timers);
    console.log(`[GrowthLoop] Stopped timers for project ${projectId}`);
  }
  projectTimers.clear();

  console.log("[GrowthLoop] Orchestrator stopped");
}

// ============================================
// Project Lifecycle
// ============================================

async function initializeAllProjects(): Promise<void> {
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.status, "active"),
  });

  console.log(
    `[GrowthLoop] Found ${activeProjects.length} active project(s)`
  );

  for (const project of activeProjects) {
    try {
      await ensureLoopState(project.id);
      setupProjectTimers(project.id, project.executionMode as ExecutionMode);
    } catch (err) {
      console.error(
        `[GrowthLoop] Failed to initialize project ${project.id}:`,
        err
      );
    }
  }
}

async function syncActiveProjects(): Promise<void> {
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.status, "active"),
  });

  const activeIds = new Set(activeProjects.map((p) => p.id));

  // Stop timers for projects that are no longer active
  for (const [projectId, timers] of projectTimers.entries()) {
    if (!activeIds.has(projectId)) {
      clearProjectTimers(timers);
      projectTimers.delete(projectId);
      console.log(
        `[GrowthLoop] Removed timers for inactive project ${projectId}`
      );
    }
  }

  // Start timers for new active projects
  for (const project of activeProjects) {
    if (!projectTimers.has(project.id)) {
      try {
        await ensureLoopState(project.id);
        setupProjectTimers(
          project.id,
          project.executionMode as ExecutionMode
        );
        console.log(
          `[GrowthLoop] Started timers for new project ${project.id}`
        );
      } catch (err) {
        console.error(
          `[GrowthLoop] Failed to start timers for project ${project.id}:`,
          err
        );
      }
    }
  }
}

function setupProjectTimers(
  projectId: number,
  executionMode: ExecutionMode
): void {
  // Avoid duplicate timers
  if (projectTimers.has(projectId)) {
    return;
  }

  const timers: ProjectLoopTimers = {
    kpiCheck: setInterval(() => {
      runKpiCheck(projectId, executionMode).catch((err) =>
        console.error(
          `[GrowthLoop] KPI check error (project ${projectId}):`,
          err
        )
      );
    }, INTERVALS.KPI_CHECK_MS),

    performanceUpdate: setInterval(() => {
      runPerformanceUpdate(projectId, executionMode).catch((err) =>
        console.error(
          `[GrowthLoop] Performance update error (project ${projectId}):`,
          err
        )
      );
    }, INTERVALS.PERFORMANCE_UPDATE_MS),

    strategyEvaluation: setInterval(() => {
      runStrategyEvaluation(projectId, executionMode).catch((err) =>
        console.error(
          `[GrowthLoop] Strategy evaluation error (project ${projectId}):`,
          err
        )
      );
    }, INTERVALS.STRATEGY_EVALUATION_MS),

    strategyRegeneration: setInterval(() => {
      runStrategyRegeneration(projectId, executionMode).catch((err) =>
        console.error(
          `[GrowthLoop] Strategy regeneration error (project ${projectId}):`,
          err
        )
      );
    }, INTERVALS.STRATEGY_REGENERATION_MS),

    fullReview: setInterval(() => {
      runFullReview(projectId, executionMode).catch((err) =>
        console.error(
          `[GrowthLoop] Full review error (project ${projectId}):`,
          err
        )
      );
    }, INTERVALS.FULL_REVIEW_MS),
  };

  projectTimers.set(projectId, timers);

  console.log(
    `[GrowthLoop] Timers set up for project ${projectId} (mode: ${executionMode})`
  );
}

function clearProjectTimers(timers: ProjectLoopTimers): void {
  clearInterval(timers.kpiCheck);
  clearInterval(timers.performanceUpdate);
  clearInterval(timers.strategyEvaluation);
  clearInterval(timers.strategyRegeneration);
  clearInterval(timers.fullReview);
}

// ============================================
// Loop State Management
// ============================================

async function ensureLoopState(projectId: number): Promise<void> {
  const existing = await db.query.growthLoopState.findFirst({
    where: eq(growthLoopState.projectId, projectId),
  });

  if (!existing) {
    await db.insert(growthLoopState).values({
      projectId,
      isRunning: 1,
      currentStrategyScore: 50,
      consecutiveDeclines: 0,
      escalationNeeded: 0,
    });
    console.log(`[GrowthLoop] Created loop state for project ${projectId}`);
  } else if (!existing.isRunning) {
    await db
      .update(growthLoopState)
      .set({ isRunning: 1, updatedAt: toMySQLTimestamp(new Date()) })
      .where(eq(growthLoopState.id, existing.id));
  }
}

async function getLoopState(projectId: number) {
  return db.query.growthLoopState.findFirst({
    where: eq(growthLoopState.projectId, projectId),
  });
}

// ============================================
// Action Logging
// ============================================

async function logAction(params: {
  projectId: number;
  actionType:
    | "kpi_check"
    | "performance_update"
    | "strategy_evaluation"
    | "strategy_regeneration"
    | "timing_optimization"
    | "content_diversity_adjustment"
    | "frequency_adjustment"
    | "escalation"
    | "full_review";
  description: string;
  actionData?: Record<string, unknown>;
  triggerReason?: string;
  executionMode: ExecutionMode;
  status?: "pending" | "approved" | "executed" | "rejected" | "failed";
  resultData?: Record<string, unknown>;
  resultSuccess?: boolean;
  errorMessage?: string;
}): Promise<number> {
  const [result] = await db.insert(growthLoopActions).values({
    projectId: params.projectId,
    actionType: params.actionType,
    description: params.description,
    actionData: params.actionData
      ? JSON.stringify(params.actionData)
      : null,
    triggerReason: params.triggerReason || null,
    executionMode: params.executionMode,
    status: params.status || "executed",
    executedAt:
      params.status === "pending" ? null : toMySQLTimestamp(new Date()),
    resultData: params.resultData
      ? JSON.stringify(params.resultData)
      : null,
    resultSuccess: params.resultSuccess !== undefined
      ? (params.resultSuccess ? 1 : 0)
      : null,
    errorMessage: params.errorMessage || null,
  });

  return result.insertId;
}

// ============================================
// Decision Engine
// ============================================

/**
 * Determines whether to execute, pend for approval, or only log.
 * Returns true if the action should actually be executed.
 */
function shouldExecute(executionMode: ExecutionMode): boolean {
  return executionMode === "fullAuto";
}

function shouldCreatePending(executionMode: ExecutionMode): boolean {
  return executionMode === "confirm";
}

// ============================================
// 10-Minute Cycle: KPI Progress Check
// ============================================

async function runKpiCheck(
  projectId: number,
  executionMode: ExecutionMode
): Promise<void> {
  console.log(`[GrowthLoop] Running KPI check for project ${projectId}`);

  try {
    // Fetch current KPI tracking records
    const kpis = await db.query.projectKpiTracking.findMany({
      where: eq(projectKpiTracking.projectId, projectId),
    });

    if (kpis.length === 0) {
      console.log(
        `[GrowthLoop] No KPI records found for project ${projectId}, skipping`
      );
      return;
    }

    // Build KPI summary
    const kpiSummary: Record<string, unknown> = {};
    let hasDecline = false;

    for (const kpi of kpis) {
      const current = Number(kpi.currentValue) || 0;
      const target = Number(kpi.targetValue) || 0;
      const progress = Number(kpi.progressPercentage) || 0;
      const onTrack = kpi.onTrack;

      kpiSummary[kpi.metricType] = {
        current,
        target,
        progress,
        onTrack: !!onTrack,
      };

      if (!onTrack) {
        hasDecline = true;
      }
    }

    // Update loop state with latest KPI snapshot
    const loopState = await getLoopState(projectId);
    if (loopState) {
      const newConsecutiveDeclines = hasDecline
        ? (loopState.consecutiveDeclines || 0) + 1
        : 0;

      const needsEscalation =
        newConsecutiveDeclines >= DECLINING_THRESHOLD;

      await db
        .update(growthLoopState)
        .set({
          lastKpiCheckAt: toMySQLTimestamp(new Date()),
          currentKpiSummary: JSON.stringify(kpiSummary),
          consecutiveDeclines: newConsecutiveDeclines,
          escalationNeeded: needsEscalation ? 1 : 0,
          escalationReason: needsEscalation
            ? `KPI declining for ${newConsecutiveDeclines} consecutive checks`
            : null,
          updatedAt: toMySQLTimestamp(new Date()),
        })
        .where(eq(growthLoopState.id, loopState.id));

      // If escalation is needed, log it
      if (needsEscalation && !loopState.escalationNeeded) {
        await logAction({
          projectId,
          actionType: "escalation",
          description: `KPI metrics declining for ${newConsecutiveDeclines} consecutive checks. Escalation triggered.`,
          actionData: { kpiSummary, consecutiveDeclines: newConsecutiveDeclines },
          triggerReason: "Consecutive KPI declines exceeded threshold",
          executionMode,
          status: "executed",
          resultSuccess: true,
        });
        console.log(
          `[GrowthLoop] Escalation triggered for project ${projectId}`
        );
      }
    }

    // Log the KPI check action
    await logAction({
      projectId,
      actionType: "kpi_check",
      description: `KPI progress check completed. ${kpis.length} metric(s) evaluated.`,
      actionData: { kpiSummary },
      executionMode,
      status: "executed",
      resultData: { hasDecline, metricsCount: kpis.length },
      resultSuccess: true,
    });

    console.log(
      `[GrowthLoop] KPI check completed for project ${projectId} (decline: ${hasDecline})`
    );
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[GrowthLoop] KPI check failed for project ${projectId}:`,
      error
    );
    await logAction({
      projectId,
      actionType: "kpi_check",
      description: "KPI check failed",
      executionMode,
      status: "failed",
      errorMessage: errorMsg,
    });
  }
}

// ============================================
// 30-Minute Cycle: Performance Data -> Learning Update
// ============================================

async function runPerformanceUpdate(
  projectId: number,
  executionMode: ExecutionMode
): Promise<void> {
  console.log(
    `[GrowthLoop] Running performance update for project ${projectId}`
  );

  try {
    // Get agents linked to this project
    const projectAgents = await db.query.agents.findMany({
      where: and(
        eq(agents.projectId, projectId),
        eq(agents.isActive, true)
      ),
    });

    if (projectAgents.length === 0) {
      console.log(
        `[GrowthLoop] No active agents for project ${projectId}, skipping performance update`
      );
      return;
    }

    const analysisResults: Record<string, unknown>[] = [];

    for (const agent of projectAgents) {
      try {
        const performance = await analyzeAgentPerformance(agent.id, 7);
        analysisResults.push({
          agentId: agent.id,
          agentName: agent.name,
          totalPosts: performance.totalPosts,
          avgEngagementRate: performance.avgEngagementRate,
          insightsCount: performance.insights.length,
        });

        console.log(
          `[GrowthLoop] Agent ${agent.id} (${agent.name}): ${performance.totalPosts} posts, ${performance.avgEngagementRate.toFixed(2)}% avg engagement`
        );
      } catch (err) {
        console.error(
          `[GrowthLoop] Failed to analyze agent ${agent.id}:`,
          err
        );
      }
    }

    // Update loop state timestamp
    const loopState = await getLoopState(projectId);
    if (loopState) {
      await db
        .update(growthLoopState)
        .set({
          lastPerformanceUpdateAt: toMySQLTimestamp(new Date()),
          updatedAt: toMySQLTimestamp(new Date()),
        })
        .where(eq(growthLoopState.id, loopState.id));
    }

    await logAction({
      projectId,
      actionType: "performance_update",
      description: `Performance data collected for ${projectAgents.length} agent(s). Learning update completed.`,
      actionData: { analysisResults },
      executionMode,
      status: "executed",
      resultData: { agentCount: projectAgents.length, analysisResults },
      resultSuccess: true,
    });

    console.log(
      `[GrowthLoop] Performance update completed for project ${projectId}`
    );
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[GrowthLoop] Performance update failed for project ${projectId}:`,
      error
    );
    await logAction({
      projectId,
      actionType: "performance_update",
      description: "Performance update failed",
      executionMode,
      status: "failed",
      errorMessage: errorMsg,
    });
  }
}

// ============================================
// 1-Hour Cycle: Strategy Effectiveness Evaluation
// ============================================

async function runStrategyEvaluation(
  projectId: number,
  executionMode: ExecutionMode
): Promise<void> {
  console.log(
    `[GrowthLoop] Running strategy evaluation for project ${projectId}`
  );

  try {
    // Get the active strategy for this project
    const activeStrategy = await db.query.strategies.findFirst({
      where: and(
        eq(strategies.projectId, projectId),
        eq(strategies.isActive, 1)
      ),
      orderBy: [desc(strategies.createdAt)],
    });

    if (!activeStrategy) {
      console.log(
        `[GrowthLoop] No active strategy for project ${projectId}, skipping`
      );
      return;
    }

    // Get recent posts generated with this strategy
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPosts = await db.query.posts.findMany({
      where: and(
        eq(posts.projectId, projectId),
        eq(posts.status, "published"),
        gte(posts.publishedAt, toMySQLTimestamp(sevenDaysAgo))
      ),
      orderBy: [desc(posts.publishedAt)],
    });

    if (recentPosts.length === 0) {
      console.log(
        `[GrowthLoop] No recent posts for project ${projectId}, skipping strategy evaluation`
      );
      return;
    }

    // Calculate average engagement for recent posts
    let totalEngagement = 0;
    let postsWithData = 0;

    for (const post of recentPosts) {
      const analytics = await db.query.postAnalytics.findFirst({
        where: eq(postAnalytics.postId, post.id),
        orderBy: [desc(postAnalytics.recordedAt)],
      });

      if (analytics) {
        totalEngagement += analytics.engagementRate || 0;
        postsWithData++;
      }
    }

    const avgEngagement =
      postsWithData > 0 ? totalEngagement / postsWithData : 0;

    // Calculate strategy effectiveness score (0-100)
    // Factor in engagement rate, post count, and trend
    const postsGenerated = activeStrategy.postsGenerated || 0;
    const volumeScore = Math.min(100, postsGenerated * 5);
    const engagementScore = Math.min(100, avgEngagement * 10);
    const effectivenessScore = Math.round(
      volumeScore * 0.3 + engagementScore * 0.7
    );

    // Update strategy effectiveness
    await db
      .update(strategies)
      .set({
        effectivenessScore,
        avgPostPerformance: Math.round(avgEngagement),
        updatedAt: toMySQLTimestamp(new Date()),
      })
      .where(eq(strategies.id, activeStrategy.id));

    // Update loop state
    const loopState = await getLoopState(projectId);
    if (loopState) {
      await db
        .update(growthLoopState)
        .set({
          lastStrategyEvaluationAt: toMySQLTimestamp(new Date()),
          currentStrategyScore: effectivenessScore,
          updatedAt: toMySQLTimestamp(new Date()),
        })
        .where(eq(growthLoopState.id, loopState.id));
    }

    // If strategy is performing poorly, generate optimization suggestions
    if (effectivenessScore < POOR_STRATEGY_THRESHOLD) {
      console.log(
        `[GrowthLoop] Strategy score ${effectivenessScore} below threshold ${POOR_STRATEGY_THRESHOLD} for project ${projectId}`
      );

      // Get agents for this project to generate suggestions
      const projectAgents = await db.query.agents.findMany({
        where: and(
          eq(agents.projectId, projectId),
          eq(agents.isActive, true)
        ),
      });

      for (const agent of projectAgents) {
        try {
          const performance = await analyzeAgentPerformance(agent.id, 7);
          if (performance.insights.length > 0) {
            const suggestions = await generateOptimizationSuggestions(
              agent.id,
              performance.insights
            );

            if (suggestions.length > 0) {
              const bestSuggestion = suggestions.sort(
                (a, b) =>
                  b.confidence * b.expectedImprovement -
                  a.confidence * a.expectedImprovement
              )[0];

              if (shouldExecute(executionMode)) {
                await applyOptimization(agent.id, bestSuggestion);
                await logAction({
                  projectId,
                  actionType: "strategy_evaluation",
                  description: `Applied optimization "${bestSuggestion.title}" to agent ${agent.name}.`,
                  actionData: { suggestion: bestSuggestion, agentId: agent.id },
                  triggerReason: `Strategy effectiveness score (${effectivenessScore}) below threshold (${POOR_STRATEGY_THRESHOLD})`,
                  executionMode,
                  status: "executed",
                  resultSuccess: true,
                });
              } else if (shouldCreatePending(executionMode)) {
                await logAction({
                  projectId,
                  actionType: "strategy_evaluation",
                  description: `Optimization suggested: "${bestSuggestion.title}" for agent ${agent.name}. Awaiting approval.`,
                  actionData: { suggestion: bestSuggestion, agentId: agent.id },
                  triggerReason: `Strategy effectiveness score (${effectivenessScore}) below threshold (${POOR_STRATEGY_THRESHOLD})`,
                  executionMode,
                  status: "pending",
                  resultData: { effectivenessScore },
                });
              } else {
                // manual mode: log only
                await logAction({
                  projectId,
                  actionType: "strategy_evaluation",
                  description: `Optimization opportunity detected: "${bestSuggestion.title}" for agent ${agent.name}. Manual mode - no action taken.`,
                  actionData: { suggestion: bestSuggestion, agentId: agent.id },
                  triggerReason: `Strategy effectiveness score (${effectivenessScore}) below threshold (${POOR_STRATEGY_THRESHOLD})`,
                  executionMode,
                  status: "executed",
                  resultData: { effectivenessScore, actionTaken: false },
                  resultSuccess: true,
                });
              }
            }
          }
        } catch (err) {
          console.error(
            `[GrowthLoop] Strategy evaluation error for agent ${agent.id}:`,
            err
          );
        }
      }
    } else {
      await logAction({
        projectId,
        actionType: "strategy_evaluation",
        description: `Strategy evaluation completed. Score: ${effectivenessScore}/100. Performance is acceptable.`,
        actionData: {
          effectivenessScore,
          avgEngagement,
          postsWithData,
          strategyId: activeStrategy.id,
        },
        executionMode,
        status: "executed",
        resultData: { effectivenessScore },
        resultSuccess: true,
      });
    }

    console.log(
      `[GrowthLoop] Strategy evaluation completed for project ${projectId} (score: ${effectivenessScore})`
    );
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[GrowthLoop] Strategy evaluation failed for project ${projectId}:`,
      error
    );
    await logAction({
      projectId,
      actionType: "strategy_evaluation",
      description: "Strategy evaluation failed",
      executionMode,
      status: "failed",
      errorMessage: errorMsg,
    });
  }
}

// ============================================
// 6-Hour Cycle: Auto-Regenerate Strategy
// ============================================

async function runStrategyRegeneration(
  projectId: number,
  executionMode: ExecutionMode
): Promise<void> {
  console.log(
    `[GrowthLoop] Running strategy regeneration check for project ${projectId}`
  );

  try {
    const loopState = await getLoopState(projectId);
    if (!loopState) {
      return;
    }

    const currentScore = loopState.currentStrategyScore || 0;

    // Only regenerate if the strategy is performing poorly
    if (currentScore >= POOR_STRATEGY_THRESHOLD) {
      console.log(
        `[GrowthLoop] Strategy score ${currentScore} is acceptable for project ${projectId}, no regeneration needed`
      );
      return;
    }

    console.log(
      `[GrowthLoop] Strategy score ${currentScore} is poor for project ${projectId}, attempting regeneration`
    );

    // Fetch the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return;
    }

    // Gather context for LLM-based strategy regeneration
    const activeStrategy = await db.query.strategies.findFirst({
      where: and(
        eq(strategies.projectId, projectId),
        eq(strategies.isActive, 1)
      ),
      orderBy: [desc(strategies.createdAt)],
    });

    // Get recent performance data
    const projectAgents = await db.query.agents.findMany({
      where: and(
        eq(agents.projectId, projectId),
        eq(agents.isActive, true)
      ),
    });

    const performanceSummaries: string[] = [];
    for (const agent of projectAgents) {
      try {
        const performance = await analyzeAgentPerformance(agent.id, 14);
        performanceSummaries.push(
          `Agent "${agent.name}": ${performance.totalPosts} posts, avg engagement ${performance.avgEngagementRate.toFixed(2)}%, insights: ${performance.insights.map((i) => i.title).join(", ")}`
        );
      } catch {
        // Skip agents that fail analysis
      }
    }

    // Use LLM to generate new strategy guidelines
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "あなたはSNSマーケティング戦略の専門家です。プロジェクトのパフォーマンスデータに基づいて、改善された戦略ガイドラインを生成してください。",
        },
        {
          role: "user",
          content: `以下のプロジェクトの戦略を改善してください。

プロジェクト: ${project.name}
目的: ${project.objective}
現在の戦略スコア: ${currentScore}/100

現在の戦略: ${activeStrategy?.description || "未設定"}

パフォーマンスデータ:
${performanceSummaries.length > 0 ? performanceSummaries.join("\n") : "データなし"}

JSON形式で回答してください:
{
  "strategyName": "新しい戦略名",
  "description": "戦略の概要説明",
  "contentGuidelines": {"format": "推奨フォーマット", "tone": "推奨トーン", "keyElements": ["要素1", "要素2"], "avoidElements": ["避ける要素1"]},
  "hashtagGuidelines": {"primary": ["メインタグ1"], "secondary": ["サブタグ1"], "avoid": ["避けるタグ1"]},
  "timingGuidelines": {"bestHours": ["09", "19"], "frequency": "1日2回"},
  "toneGuidelines": {"primary": "推奨トーン", "examples": ["例文1"], "avoid": ["避けるトーン1"]},
  "reasoning": "この戦略を推奨する理由"
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "strategy_regeneration",
          strict: true,
          schema: {
            type: "object",
            properties: {
              strategyName: { type: "string" },
              description: { type: "string" },
              contentGuidelines: {
                type: "object",
                properties: {
                  format: { type: "string" },
                  tone: { type: "string" },
                  keyElements: {
                    type: "array",
                    items: { type: "string" },
                  },
                  avoidElements: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: [
                  "format",
                  "tone",
                  "keyElements",
                  "avoidElements",
                ],
                additionalProperties: false,
              },
              hashtagGuidelines: {
                type: "object",
                properties: {
                  primary: {
                    type: "array",
                    items: { type: "string" },
                  },
                  secondary: {
                    type: "array",
                    items: { type: "string" },
                  },
                  avoid: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["primary", "secondary", "avoid"],
                additionalProperties: false,
              },
              timingGuidelines: {
                type: "object",
                properties: {
                  bestHours: {
                    type: "array",
                    items: { type: "string" },
                  },
                  frequency: { type: "string" },
                },
                required: ["bestHours", "frequency"],
                additionalProperties: false,
              },
              toneGuidelines: {
                type: "object",
                properties: {
                  primary: { type: "string" },
                  examples: {
                    type: "array",
                    items: { type: "string" },
                  },
                  avoid: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["primary", "examples", "avoid"],
                additionalProperties: false,
              },
              reasoning: { type: "string" },
            },
            required: [
              "strategyName",
              "description",
              "contentGuidelines",
              "hashtagGuidelines",
              "timingGuidelines",
              "toneGuidelines",
              "reasoning",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = llmResponse.choices[0].message.content;
    const newStrategy = JSON.parse(
      typeof messageContent === "string" ? messageContent : "{}"
    );

    if (shouldExecute(executionMode)) {
      // Deactivate old strategy
      if (activeStrategy) {
        await db
          .update(strategies)
          .set({ isActive: 0, updatedAt: toMySQLTimestamp(new Date()) })
          .where(eq(strategies.id, activeStrategy.id));
      }

      // Create new strategy
      await db.insert(strategies).values({
        userId: project.userId,
        projectId,
        name: newStrategy.strategyName,
        description: newStrategy.description,
        objective: project.objective,
        contentGuidelines: JSON.stringify(newStrategy.contentGuidelines),
        hashtagGuidelines: JSON.stringify(newStrategy.hashtagGuidelines),
        timingGuidelines: JSON.stringify(newStrategy.timingGuidelines),
        toneGuidelines: JSON.stringify(newStrategy.toneGuidelines),
        isActive: 1,
        effectivenessScore: 50, // Start fresh
      });

      // Update loop state
      await db
        .update(growthLoopState)
        .set({
          lastStrategyRegenerationAt: toMySQLTimestamp(new Date()),
          currentStrategyScore: 50,
          consecutiveDeclines: 0,
          escalationNeeded: 0,
          escalationReason: null,
          updatedAt: toMySQLTimestamp(new Date()),
        })
        .where(eq(growthLoopState.id, loopState.id));

      await logAction({
        projectId,
        actionType: "strategy_regeneration",
        description: `Strategy regenerated: "${newStrategy.strategyName}". Previous score: ${currentScore}/100.`,
        actionData: { newStrategy, previousScore: currentScore },
        triggerReason: `Strategy score (${currentScore}) below threshold (${POOR_STRATEGY_THRESHOLD})`,
        executionMode,
        status: "executed",
        resultSuccess: true,
      });

      console.log(
        `[GrowthLoop] Strategy regenerated for project ${projectId}: "${newStrategy.strategyName}"`
      );
    } else if (shouldCreatePending(executionMode)) {
      await logAction({
        projectId,
        actionType: "strategy_regeneration",
        description: `Strategy regeneration proposed: "${newStrategy.strategyName}". Awaiting approval.`,
        actionData: {
          newStrategy,
          previousScore: currentScore,
          previousStrategyId: activeStrategy?.id,
        },
        triggerReason: `Strategy score (${currentScore}) below threshold (${POOR_STRATEGY_THRESHOLD})`,
        executionMode,
        status: "pending",
      });

      console.log(
        `[GrowthLoop] Strategy regeneration pending approval for project ${projectId}`
      );
    } else {
      // manual mode
      await logAction({
        projectId,
        actionType: "strategy_regeneration",
        description: `Strategy regeneration analyzed. Proposed: "${newStrategy.strategyName}". Manual mode - no action taken.`,
        actionData: { newStrategy, previousScore: currentScore },
        triggerReason: `Strategy score (${currentScore}) below threshold (${POOR_STRATEGY_THRESHOLD})`,
        executionMode,
        status: "executed",
        resultData: { actionTaken: false },
        resultSuccess: true,
      });

      console.log(
        `[GrowthLoop] Strategy regeneration logged (manual mode) for project ${projectId}`
      );
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[GrowthLoop] Strategy regeneration failed for project ${projectId}:`,
      error
    );
    await logAction({
      projectId,
      actionType: "strategy_regeneration",
      description: "Strategy regeneration failed",
      executionMode,
      status: "failed",
      errorMessage: errorMsg,
    });
  }
}

// ============================================
// 24-Hour Cycle: Full Review
// ============================================

async function runFullReview(
  projectId: number,
  executionMode: ExecutionMode
): Promise<void> {
  console.log(
    `[GrowthLoop] Running full review for project ${projectId}`
  );

  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return;
    }

    // 1. Gather comprehensive performance data
    const projectAgents = await db.query.agents.findMany({
      where: and(
        eq(agents.projectId, projectId),
        eq(agents.isActive, true)
      ),
    });

    const agentPerformances: Record<string, unknown>[] = [];

    for (const agent of projectAgents) {
      try {
        const performance = await analyzeAgentPerformance(agent.id, 7);
        agentPerformances.push({
          agentId: agent.id,
          agentName: agent.name,
          totalPosts: performance.totalPosts,
          avgEngagementRate: performance.avgEngagementRate,
          topPostCount: performance.topPosts.length,
          bottomPostCount: performance.bottomPosts.length,
          insightsCount: performance.insights.length,
          insights: performance.insights.map((i) => ({
            type: i.type,
            title: i.title,
          })),
        });
      } catch {
        // Skip agents that fail
      }
    }

    // 2. KPI summary
    const kpis = await db.query.projectKpiTracking.findMany({
      where: eq(projectKpiTracking.projectId, projectId),
    });

    const kpiSummary = kpis.map((kpi) => ({
      metric: kpi.metricType,
      current: Number(kpi.currentValue) || 0,
      target: Number(kpi.targetValue) || 0,
      progress: Number(kpi.progressPercentage) || 0,
      onTrack: !!kpi.onTrack,
    }));

    // 3. Strategy status
    const activeStrategy = await db.query.strategies.findFirst({
      where: and(
        eq(strategies.projectId, projectId),
        eq(strategies.isActive, 1)
      ),
      orderBy: [desc(strategies.createdAt)],
    });

    // 4. Recent growth loop actions (last 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentActions = await db.query.growthLoopActions.findMany({
      where: and(
        eq(growthLoopActions.projectId, projectId),
        gte(growthLoopActions.createdAt, toMySQLTimestamp(oneDayAgo))
      ),
      orderBy: [desc(growthLoopActions.createdAt)],
    });

    const reviewData = {
      project: {
        id: project.id,
        name: project.name,
        objective: project.objective,
        executionMode: project.executionMode,
      },
      agentPerformances,
      kpiSummary,
      activeStrategy: activeStrategy
        ? {
            id: activeStrategy.id,
            name: activeStrategy.name,
            effectivenessScore: activeStrategy.effectivenessScore,
          }
        : null,
      recentActionsCount: recentActions.length,
      recentActionsSummary: recentActions.slice(0, 10).map((a) => ({
        type: a.actionType,
        status: a.status,
        description: a.description,
      })),
    };

    // 5. Use LLM for comprehensive review
    const reviewResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "あなたはSNSマーケティングの専門コンサルタントです。プロジェクトの日次レビューを行い、改善提案を作成してください。",
        },
        {
          role: "user",
          content: `以下のプロジェクトデータに基づいて、24時間レビューレポートを作成してください。

${JSON.stringify(reviewData, null, 2)}

JSON形式で回答:
{
  "overallScore": 0-100,
  "summary": "全体評価の要約",
  "strengths": ["強み1", "強み2"],
  "weaknesses": ["弱み1", "弱み2"],
  "recommendations": ["推奨アクション1", "推奨アクション2"],
  "priorityAction": "最も重要な次のアクション"
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "full_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallScore: { type: "integer" },
              summary: { type: "string" },
              strengths: {
                type: "array",
                items: { type: "string" },
              },
              weaknesses: {
                type: "array",
                items: { type: "string" },
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              priorityAction: { type: "string" },
            },
            required: [
              "overallScore",
              "summary",
              "strengths",
              "weaknesses",
              "recommendations",
              "priorityAction",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const reviewContent = reviewResponse.choices[0].message.content;
    const review = JSON.parse(
      typeof reviewContent === "string" ? reviewContent : "{}"
    );

    // Update loop state
    const loopState = await getLoopState(projectId);
    if (loopState) {
      await db
        .update(growthLoopState)
        .set({
          lastFullReviewAt: toMySQLTimestamp(new Date()),
          updatedAt: toMySQLTimestamp(new Date()),
        })
        .where(eq(growthLoopState.id, loopState.id));
    }

    await logAction({
      projectId,
      actionType: "full_review",
      description: `24-hour full review completed. Overall score: ${review.overallScore}/100. ${review.summary}`,
      actionData: {
        reviewData,
        review,
      },
      executionMode,
      status: "executed",
      resultData: review,
      resultSuccess: true,
    });

    console.log(
      `[GrowthLoop] Full review completed for project ${projectId} (score: ${review.overallScore}/100)`
    );
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[GrowthLoop] Full review failed for project ${projectId}:`,
      error
    );
    await logAction({
      projectId,
      actionType: "full_review",
      description: "Full review failed",
      executionMode,
      status: "failed",
      errorMessage: errorMsg,
    });
  }
}
