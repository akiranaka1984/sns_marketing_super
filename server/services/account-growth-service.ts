import { db } from "../db";
import { accounts, accountLearnings } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Experience points rewards for various actions
 */
export const XP_REWARDS = {
  // Learning rewards
  LEARNING_SUCCESS_PATTERN: 50,
  LEARNING_POSTING_STYLE: 30,
  LEARNING_COMMENT_STYLE: 30,
  LEARNING_HASHTAG_STRATEGY: 25,
  LEARNING_TIMING_PATTERN: 25,
  LEARNING_FAILURE_PATTERN: 20,
  LEARNING_BUZZ_ANALYSIS: 40,
  LEARNING_ENGAGEMENT_PATTERN: 35,
  // Post rewards
  POST_SUCCESS: 10,
  POST_HIGH_ENGAGEMENT: 30,
  LEARNING_USAGE_SUCCESS: 5,
} as const;

/**
 * Map learning type to XP reward
 */
export function getXPForLearningType(learningType: string): number {
  const mapping: Record<string, number> = {
    success_pattern: XP_REWARDS.LEARNING_SUCCESS_PATTERN,
    posting_style: XP_REWARDS.LEARNING_POSTING_STYLE,
    comment_style: XP_REWARDS.LEARNING_COMMENT_STYLE,
    hashtag_strategy: XP_REWARDS.LEARNING_HASHTAG_STRATEGY,
    timing_pattern: XP_REWARDS.LEARNING_TIMING_PATTERN,
    failure_pattern: XP_REWARDS.LEARNING_FAILURE_PATTERN,
    engagement_pattern: XP_REWARDS.LEARNING_ENGAGEMENT_PATTERN,
  };
  return mapping[learningType] || 20;
}

/**
 * Calculate required XP for a given level
 * Level N requires N * 100 XP to complete
 */
export function getRequiredXPForLevel(level: number): number {
  return level * 100;
}

/**
 * Calculate total XP needed to reach a level from level 1
 */
export function getTotalXPForLevel(level: number): number {
  // Sum of 100 + 200 + 300 + ... + (level-1)*100
  // = 100 * (1 + 2 + ... + (level-1))
  // = 100 * ((level-1) * level / 2)
  return 100 * ((level - 1) * level) / 2;
}

/**
 * Calculate level and progress from total XP
 */
export function calculateLevelProgress(totalXP: number): {
  level: number;
  currentLevelXP: number;
  requiredXP: number;
  progressPercent: number;
} {
  let level = 1;
  let accumulatedXP = 0;

  // Find current level
  while (accumulatedXP + getRequiredXPForLevel(level) <= totalXP) {
    accumulatedXP += getRequiredXPForLevel(level);
    level++;
  }

  const currentLevelXP = totalXP - accumulatedXP;
  const requiredXP = getRequiredXPForLevel(level);
  const progressPercent = Math.floor((currentLevelXP / requiredXP) * 100);

  return { level, currentLevelXP, requiredXP, progressPercent };
}

/**
 * Award XP to an account and update level if needed
 */
export async function awardXP(
  accountId: number,
  amount: number,
  reason: string
): Promise<{
  newXP: number;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
}> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const oldLevel = account.level;
  const newXP = account.experiencePoints + amount;
  const { level: newLevel } = calculateLevelProgress(newXP);
  const levelUp = newLevel > oldLevel;

  await db
    .update(accounts)
    .set({
      experiencePoints: newXP,
      level: newLevel,
    })
    .where(eq(accounts.id, accountId));

  console.log(
    `[AccountGrowth] Account ${accountId} awarded ${amount} XP for "${reason}". ` +
      `Total: ${newXP} XP, Level: ${newLevel}${levelUp ? " (LEVEL UP!)" : ""}`
  );

  return { newXP, levelUp, oldLevel, newLevel };
}

/**
 * Get growth statistics for an account
 * Auto-syncs if learning count doesn't match DB
 */
export async function getAccountGrowthStats(accountId: number): Promise<{
  experiencePoints: number;
  level: number;
  currentLevelXP: number;
  requiredXP: number;
  progressPercent: number;
  totalLearningsCount: number;
  learningsByType: Record<string, number>;
}> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  // Get learning counts by type
  const learnings = await db
    .select()
    .from(accountLearnings)
    .where(eq(accountLearnings.accountId, accountId));

  const learningsByType: Record<string, number> = {};
  let expectedXP = 0;
  for (const learning of learnings) {
    learningsByType[learning.learningType] =
      (learningsByType[learning.learningType] || 0) + 1;
    expectedXP += getXPForLearningType(learning.learningType);
  }

  // Auto-sync if learning count or XP doesn't match
  let experiencePoints = account.experiencePoints;
  let level = account.level;

  if (learnings.length !== account.totalLearningsCount || experiencePoints !== expectedXP) {
    console.log(
      `[AccountGrowth] Auto-syncing account ${accountId}: ` +
      `DB has ${account.totalLearningsCount} learnings/${account.experiencePoints} XP, ` +
      `actual is ${learnings.length} learnings/${expectedXP} XP`
    );

    const { level: newLevel } = calculateLevelProgress(expectedXP);

    await db
      .update(accounts)
      .set({
        experiencePoints: expectedXP,
        level: newLevel,
        totalLearningsCount: learnings.length,
      })
      .where(eq(accounts.id, accountId));

    experiencePoints = expectedXP;
    level = newLevel;
  }

  // Calculate level progress
  const { currentLevelXP, requiredXP, progressPercent } = calculateLevelProgress(
    experiencePoints
  );

  return {
    experiencePoints,
    level,
    currentLevelXP,
    requiredXP,
    progressPercent,
    totalLearningsCount: learnings.length,
    learningsByType,
  };
}

/**
 * Sync learning count and recalculate XP from existing learnings
 * Used for initial migration or fixing inconsistencies
 */
export async function syncAccountGrowthFromLearnings(
  accountId: number
): Promise<{
  totalXP: number;
  level: number;
  learningsCount: number;
}> {
  const learnings = await db
    .select()
    .from(accountLearnings)
    .where(eq(accountLearnings.accountId, accountId));

  let totalXP = 0;
  for (const learning of learnings) {
    totalXP += getXPForLearningType(learning.learningType);
  }

  const { level } = calculateLevelProgress(totalXP);

  await db
    .update(accounts)
    .set({
      experiencePoints: totalXP,
      level,
      totalLearningsCount: learnings.length,
    })
    .where(eq(accounts.id, accountId));

  console.log(
    `[AccountGrowth] Synced account ${accountId}: ${learnings.length} learnings, ${totalXP} XP, Level ${level}`
  );

  return { totalXP, level, learningsCount: learnings.length };
}

/**
 * Increment learning count and award XP when a new learning is added
 */
export async function onLearningAdded(
  accountId: number,
  learningType: string
): Promise<void> {
  const xp = getXPForLearningType(learningType);

  // Update learning count
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (account) {
    await db
      .update(accounts)
      .set({
        totalLearningsCount: account.totalLearningsCount + 1,
      })
      .where(eq(accounts.id, accountId));
  }

  // Award XP
  await awardXP(accountId, xp, `New learning: ${learningType}`);
}

/**
 * Get account learnings with details for display
 */
export async function getAccountLearningsWithDetails(
  accountId: number,
  options?: {
    type?: string;
    limit?: number;
    minConfidence?: number;
  }
): Promise<
  Array<{
    id: number;
    learningType: string;
    content: any;
    confidence: number;
    xpValue: number;
    createdAt: string;
    source: string | null;
  }>
> {
  let query = db
    .select()
    .from(accountLearnings)
    .where(eq(accountLearnings.accountId, accountId))
    .orderBy(desc(accountLearnings.createdAt));

  const learnings = await query;

  return learnings
    .filter((l) => {
      if (options?.type && l.learningType !== options.type) return false;
      if (options?.minConfidence && l.confidence < options.minConfidence)
        return false;
      return true;
    })
    .slice(0, options?.limit || 100)
    .map((l) => ({
      id: l.id,
      learningType: l.learningType,
      content: typeof l.content === "string" ? JSON.parse(l.content) : l.content,
      confidence: l.confidence,
      xpValue: getXPForLearningType(l.learningType),
      createdAt: l.createdAt,
      source: l.sourceType,
    }));
}
