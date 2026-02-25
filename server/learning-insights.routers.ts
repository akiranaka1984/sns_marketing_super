import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  accountLearnings,
  buzzLearnings,
  agentKnowledge,
  learningSyncLog,
  accounts,
} from "../drizzle/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte } from "drizzle-orm";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export const learningInsightsRouter = router({
  /**
   * Get unified view of the 3-layer learning system
   */
  getUnifiedView: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        projectId: z.number().optional(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      // Layer 1: Account Learnings
      const accountLearningsConditions = input.accountId
        ? eq(accountLearnings.accountId, input.accountId)
        : undefined;

      const accountLearningsResult = await db
        .select()
        .from(accountLearnings)
        .where(accountLearningsConditions)
        .orderBy(desc(accountLearnings.confidence))
        .limit(input.limit);

      // Layer 2: Buzz Learnings
      const buzzLearningsConditions = input.projectId
        ? eq(buzzLearnings.projectId, input.projectId)
        : undefined;

      const buzzLearningsResult = await db
        .select()
        .from(buzzLearnings)
        .where(buzzLearningsConditions)
        .orderBy(desc(buzzLearnings.confidence))
        .limit(input.limit);

      // Layer 3: Agent Knowledge
      const agentKnowledgeResult = await db
        .select()
        .from(agentKnowledge)
        .orderBy(desc(agentKnowledge.confidence))
        .limit(input.limit);

      // Calculate stats
      const allConfidences = [
        ...accountLearningsResult.map((l) => l.confidence),
        ...buzzLearningsResult.map((l) => l.confidence),
        ...agentKnowledgeResult.map((l) => l.confidence),
      ];

      const total =
        accountLearningsResult.length +
        buzzLearningsResult.length +
        agentKnowledgeResult.length;

      const avgConfidence =
        allConfidences.length > 0
          ? Math.round(
              allConfidences.reduce((sum, c) => sum + c, 0) /
                allConfidences.length
            )
          : 0;

      const activeCount =
        accountLearningsResult.filter((l) => l.isActive === 1).length +
        buzzLearningsResult.filter((l) => l.isActive === 1).length +
        agentKnowledgeResult.filter((l) => l.isActive === 1).length;

      return {
        accountLearnings: accountLearningsResult,
        buzzLearnings: buzzLearningsResult,
        agentKnowledge: agentKnowledgeResult,
        stats: {
          total,
          avgConfidence,
          activeCount,
        },
      };
    }),

  /**
   * Get confidence history over time for an account
   */
  getConfidenceHistory: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        days: z.number().optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const results = await db
        .select({
          date: sql<string>`DATE(${learningSyncLog.syncedAt})`,
          avgConfidence: sql<number>`AVG(${accountLearnings.confidence})`,
          learningCount: sql<number>`COUNT(*)`,
        })
        .from(learningSyncLog)
        .leftJoin(
          accountLearnings,
          eq(learningSyncLog.accountLearningId, accountLearnings.id)
        )
        .where(
          and(
            eq(learningSyncLog.targetAccountId, input.accountId),
            gte(learningSyncLog.syncedAt, toMySQLTimestamp(startDate))
          )
        )
        .groupBy(sql`DATE(${learningSyncLog.syncedAt})`)
        .orderBy(sql`DATE(${learningSyncLog.syncedAt})`);

      return results.map((row) => ({
        date: String(row.date),
        avgConfidence: Math.round(Number(row.avgConfidence || 0)),
        learningCount: Number(row.learningCount),
      }));
    }),

  /**
   * Get account health scores based on learning data
   */
  getAccountHealth: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
      })
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      // Get accounts for this user
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      if (userAccounts.length === 0) {
        return [];
      }

      const healthResults = await Promise.all(
        userAccounts.map(async (account) => {
          // Get active learnings for this account
          const activeLearnings = await db
            .select({
              confidence: accountLearnings.confidence,
              successRate: accountLearnings.successRate,
            })
            .from(accountLearnings)
            .where(
              and(
                eq(accountLearnings.accountId, account.id),
                eq(accountLearnings.isActive, 1)
              )
            );

          const activeLearningCount = activeLearnings.length;

          const avgConfidence =
            activeLearningCount > 0
              ? activeLearnings.reduce((sum, l) => sum + l.confidence, 0) /
                activeLearningCount
              : 0;

          const avgSuccessRate =
            activeLearningCount > 0
              ? activeLearnings.reduce((sum, l) => sum + l.successRate, 0) /
                activeLearningCount
              : 0;

          // healthScore = avgConfidence * 0.4 + avgSuccessRate * 0.3 + min(activeLearningCount/10, 1) * 30
          const healthScore =
            avgConfidence * 0.4 +
            avgSuccessRate * 0.3 +
            Math.min(activeLearningCount / 10, 1) * 30;

          return {
            accountId: account.id,
            username: account.username,
            activeLearningCount,
            avgConfidence: Math.round(avgConfidence),
            avgSuccessRate: Math.round(avgSuccessRate),
            healthScore: Math.round(healthScore),
          };
        })
      );

      return healthResults;
    }),
});
