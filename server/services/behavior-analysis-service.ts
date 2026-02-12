/**
 * Behavior Analysis Service
 * Analyzes posting patterns from model accounts to learn their behavior
 * - Posting frequency (posts per day/week)
 * - Time-of-day patterns (when they post)
 * - Day-of-week patterns
 * - Engagement patterns
 * - Content patterns (length, emoji usage, hashtags)
 */

import { db } from "../db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Type definitions
export interface PostingHoursDistribution {
  [hour: string]: number; // "00" to "23" -> count
}

export interface PostingDaysDistribution {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface EngagementTrendPoint {
  date: string;
  rate: number;
}

export interface FollowerHistoryPoint {
  date: string;
  count: number;
}

export interface BehaviorPattern {
  modelAccountId: number;
  avgPostsPerDay: number;
  avgPostsPerWeek: number;
  postingFrequencyStdDev: number;
  postingHoursDistribution: PostingHoursDistribution;
  peakPostingHours: string[];
  postingDaysDistribution: PostingDaysDistribution;
  avgEngagementRate: number;
  engagementRateTrend: EngagementTrendPoint[];
  bestEngagementHours: string[];
  followerGrowthRate: number;
  followerHistory: FollowerHistoryPoint[];
  avgContentLength: number;
  emojiUsageRate: number;
  hashtagAvgCount: number;
  mediaUsageRate: number;
  analysisPeriodStart: string;
  analysisPeriodEnd: string;
  sampleSize: number;
}

export interface BehaviorSummary {
  modelAccountId: number;
  username: string;
  avgPostsPerDay: number;
  peakPostingHours: string[];
  avgEngagementRate: number;
  bestEngagementHours: string[];
  contentStyle: {
    avgLength: number;
    emojiUsage: 'none' | 'low' | 'medium' | 'high';
    hashtagCount: number;
    mediaUsage: 'none' | 'low' | 'medium' | 'high';
  };
  lastAnalyzedAt: string | null;
}

export interface AccountComparison {
  own: {
    accountId: number;
    username: string;
    avgPostsPerDay: number;
    avgEngagementRate: number;
    peakHours: string[];
  };
  model: {
    modelAccountId: number;
    username: string;
    avgPostsPerDay: number;
    avgEngagementRate: number;
    peakHours: string[];
  };
  recommendations: string[];
}

/**
 * Analyze posting patterns from buzzPosts for a model account
 */
export async function analyzePostingPatterns(
  modelAccountId: number,
  periodDays: number = 30
): Promise<BehaviorPattern> {
  // Get the model account
  const modelAccount = await db.query.modelAccounts.findFirst({
    where: eq(schema.modelAccounts.id, modelAccountId),
  });

  if (!modelAccount) {
    throw new Error(`Model account not found: ${modelAccountId}`);
  }

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  // Get all posts from this model account within the period
  const posts = await db.query.buzzPosts.findMany({
    where: and(
      eq(schema.buzzPosts.modelAccountId, modelAccountId),
      gte(schema.buzzPosts.postedAt, toMySQLTimestamp(startDate)),
      lte(schema.buzzPosts.postedAt, toMySQLTimestamp(endDate))
    ),
    orderBy: desc(schema.buzzPosts.postedAt),
  });

  if (posts.length === 0) {
    // Return empty pattern if no posts found
    return createEmptyPattern(modelAccountId, startDate, endDate);
  }

  // Analyze posting frequency
  const { avgPostsPerDay, avgPostsPerWeek, stdDev } = analyzeFrequency(posts, periodDays);

  // Analyze time-of-day distribution
  const { hoursDistribution, peakHours } = analyzeTimeOfDay(posts);

  // Analyze day-of-week distribution
  const daysDistribution = analyzeDayOfWeek(posts);

  // Analyze engagement patterns
  const { avgEngagementRate, engagementTrend, bestHours } = analyzeEngagement(posts);

  // Analyze content patterns
  const { avgLength, emojiRate, hashtagCount, mediaRate } = analyzeContent(posts);

  const pattern: BehaviorPattern = {
    modelAccountId,
    avgPostsPerDay,
    avgPostsPerWeek,
    postingFrequencyStdDev: stdDev,
    postingHoursDistribution: hoursDistribution,
    peakPostingHours: peakHours,
    postingDaysDistribution: daysDistribution,
    avgEngagementRate,
    engagementRateTrend: engagementTrend,
    bestEngagementHours: bestHours,
    followerGrowthRate: 0, // Would need historical data
    followerHistory: [], // Would need historical data
    avgContentLength: avgLength,
    emojiUsageRate: emojiRate,
    hashtagAvgCount: hashtagCount,
    mediaUsageRate: mediaRate,
    analysisPeriodStart: toMySQLTimestamp(startDate),
    analysisPeriodEnd: toMySQLTimestamp(endDate),
    sampleSize: posts.length,
  };

  // Save the pattern to database
  await savePatternToDatabase(pattern);

  return pattern;
}

/**
 * Get behavior summary for a model account
 */
export async function getBehaviorSummary(modelAccountId: number): Promise<BehaviorSummary | null> {
  // Get the model account
  const modelAccount = await db.query.modelAccounts.findFirst({
    where: eq(schema.modelAccounts.id, modelAccountId),
  });

  if (!modelAccount) {
    return null;
  }

  // Get saved pattern
  const pattern = await db.query.modelAccountBehaviorPatterns.findFirst({
    where: eq(schema.modelAccountBehaviorPatterns.modelAccountId, modelAccountId),
  });

  if (!pattern) {
    return {
      modelAccountId,
      username: modelAccount.username,
      avgPostsPerDay: 0,
      peakPostingHours: [],
      avgEngagementRate: 0,
      bestEngagementHours: [],
      contentStyle: {
        avgLength: 0,
        emojiUsage: 'none',
        hashtagCount: 0,
        mediaUsage: 'none',
      },
      lastAnalyzedAt: null,
    };
  }

  const emojiUsageRate = Number(pattern.emojiUsageRate) || 0;
  const mediaUsageRate = Number(pattern.mediaUsageRate) || 0;

  return {
    modelAccountId,
    username: modelAccount.username,
    avgPostsPerDay: Number(pattern.avgPostsPerDay) || 0,
    peakPostingHours: pattern.peakPostingHours ? JSON.parse(pattern.peakPostingHours) : [],
    avgEngagementRate: Number(pattern.avgEngagementRate) || 0,
    bestEngagementHours: pattern.bestEngagementHours ? JSON.parse(pattern.bestEngagementHours) : [],
    contentStyle: {
      avgLength: pattern.avgContentLength || 0,
      emojiUsage: emojiUsageRate > 0.5 ? 'high' : emojiUsageRate > 0.2 ? 'medium' : emojiUsageRate > 0 ? 'low' : 'none',
      hashtagCount: Number(pattern.hashtagAvgCount) || 0,
      mediaUsage: mediaUsageRate > 0.7 ? 'high' : mediaUsageRate > 0.3 ? 'medium' : mediaUsageRate > 0 ? 'low' : 'none',
    },
    lastAnalyzedAt: pattern.lastAnalyzedAt || null,
  };
}

/**
 * Compare an account with a model account
 */
export async function compareWithModel(
  accountId: number,
  modelAccountId: number
): Promise<AccountComparison | null> {
  // Get own account
  const account = await db.query.accounts.findFirst({
    where: eq(schema.accounts.id, accountId),
  });

  if (!account) {
    return null;
  }

  // Get model account
  const modelAccount = await db.query.modelAccounts.findFirst({
    where: eq(schema.modelAccounts.id, modelAccountId),
  });

  if (!modelAccount) {
    return null;
  }

  // Get model pattern
  const modelPattern = await db.query.modelAccountBehaviorPatterns.findFirst({
    where: eq(schema.modelAccountBehaviorPatterns.modelAccountId, modelAccountId),
  });

  // Get own account's recent posts for analysis
  const ownPosts = await db.query.posts.findMany({
    where: eq(schema.posts.accountId, accountId),
    orderBy: desc(schema.posts.createdAt),
    limit: 100,
  });

  // Analyze own account's patterns (simplified)
  const ownAvgPostsPerDay = ownPosts.length > 0 ? ownPosts.length / 30 : 0;
  const ownAvgEngagement = ownPosts.length > 0
    ? ownPosts.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / ownPosts.length
    : 0;

  const recommendations: string[] = [];

  if (modelPattern) {
    const modelAvgPosts = Number(modelPattern.avgPostsPerDay) || 0;
    const modelAvgEngagement = Number(modelPattern.avgEngagementRate) || 0;
    const modelPeakHours = modelPattern.peakPostingHours ? JSON.parse(modelPattern.peakPostingHours) : [];

    // Generate recommendations
    if (ownAvgPostsPerDay < modelAvgPosts * 0.5) {
      recommendations.push(`投稿頻度を増やしましょう。モデルアカウントは1日${modelAvgPosts.toFixed(1)}回投稿しています。`);
    }

    if (modelPeakHours.length > 0) {
      recommendations.push(`最適な投稿時間帯: ${modelPeakHours.join(', ')}時`);
    }

    if (ownAvgEngagement < modelAvgEngagement * 0.5) {
      recommendations.push(`エンゲージメント向上のため、モデルアカウントの投稿スタイルを参考にしましょう。`);
    }

    return {
      own: {
        accountId,
        username: account.username,
        avgPostsPerDay: ownAvgPostsPerDay,
        avgEngagementRate: ownAvgEngagement,
        peakHours: [], // Would need analysis
      },
      model: {
        modelAccountId,
        username: modelAccount.username,
        avgPostsPerDay: modelAvgPosts,
        avgEngagementRate: modelAvgEngagement,
        peakHours: modelPeakHours,
      },
      recommendations,
    };
  }

  return {
    own: {
      accountId,
      username: account.username,
      avgPostsPerDay: ownAvgPostsPerDay,
      avgEngagementRate: ownAvgEngagement,
      peakHours: [],
    },
    model: {
      modelAccountId,
      username: modelAccount.username,
      avgPostsPerDay: 0,
      avgEngagementRate: 0,
      peakHours: [],
    },
    recommendations: ['モデルアカウントの分析を先に実行してください。'],
  };
}

/**
 * Get patterns for generating strategy
 */
export async function getPatternsForStrategy(modelAccountIds: number[]): Promise<BehaviorPattern[]> {
  if (modelAccountIds.length === 0) {
    return [];
  }

  const patterns = await db.query.modelAccountBehaviorPatterns.findMany({
    where: sql`${schema.modelAccountBehaviorPatterns.modelAccountId} IN (${modelAccountIds.join(',')})`,
  });

  return patterns.map(p => ({
    modelAccountId: p.modelAccountId,
    avgPostsPerDay: Number(p.avgPostsPerDay) || 0,
    avgPostsPerWeek: Number(p.avgPostsPerWeek) || 0,
    postingFrequencyStdDev: Number(p.postingFrequencyStdDev) || 0,
    postingHoursDistribution: p.postingHoursDistribution ? JSON.parse(p.postingHoursDistribution) : {},
    peakPostingHours: p.peakPostingHours ? JSON.parse(p.peakPostingHours) : [],
    postingDaysDistribution: p.postingDaysDistribution ? JSON.parse(p.postingDaysDistribution) : {},
    avgEngagementRate: Number(p.avgEngagementRate) || 0,
    engagementRateTrend: p.engagementRateTrend ? JSON.parse(p.engagementRateTrend) : [],
    bestEngagementHours: p.bestEngagementHours ? JSON.parse(p.bestEngagementHours) : [],
    followerGrowthRate: Number(p.followerGrowthRate) || 0,
    followerHistory: p.followerHistory ? JSON.parse(p.followerHistory) : [],
    avgContentLength: p.avgContentLength || 0,
    emojiUsageRate: Number(p.emojiUsageRate) || 0,
    hashtagAvgCount: Number(p.hashtagAvgCount) || 0,
    mediaUsageRate: Number(p.mediaUsageRate) || 0,
    analysisPeriodStart: p.analysisPeriodStart || '',
    analysisPeriodEnd: p.analysisPeriodEnd || '',
    sampleSize: p.sampleSize || 0,
  }));
}

// ================== Helper Functions ==================

function createEmptyPattern(modelAccountId: number, startDate: Date, endDate: Date): BehaviorPattern {
  return {
    modelAccountId,
    avgPostsPerDay: 0,
    avgPostsPerWeek: 0,
    postingFrequencyStdDev: 0,
    postingHoursDistribution: {},
    peakPostingHours: [],
    postingDaysDistribution: {
      monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
      friday: 0, saturday: 0, sunday: 0,
    },
    avgEngagementRate: 0,
    engagementRateTrend: [],
    bestEngagementHours: [],
    followerGrowthRate: 0,
    followerHistory: [],
    avgContentLength: 0,
    emojiUsageRate: 0,
    hashtagAvgCount: 0,
    mediaUsageRate: 0,
    analysisPeriodStart: toMySQLTimestamp(startDate),
    analysisPeriodEnd: toMySQLTimestamp(endDate),
    sampleSize: 0,
  };
}

function analyzeFrequency(posts: any[], periodDays: number) {
  const totalPosts = posts.length;
  const avgPostsPerDay = totalPosts / periodDays;
  const avgPostsPerWeek = avgPostsPerDay * 7;

  // Calculate posts per day for std dev
  const postsByDay: { [date: string]: number } = {};
  posts.forEach(post => {
    if (post.postedAt) {
      const date = post.postedAt.split('T')[0];
      postsByDay[date] = (postsByDay[date] || 0) + 1;
    }
  });

  const dailyCounts = Object.values(postsByDay);
  const mean = dailyCounts.length > 0 ? dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length : 0;
  const variance = dailyCounts.length > 0
    ? dailyCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / dailyCounts.length
    : 0;
  const stdDev = Math.sqrt(variance);

  return { avgPostsPerDay, avgPostsPerWeek, stdDev };
}

function analyzeTimeOfDay(posts: any[]) {
  const hoursDistribution: PostingHoursDistribution = {};
  const hourEngagement: { [hour: string]: { total: number; count: number } } = {};

  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0');
    hoursDistribution[hour] = 0;
    hourEngagement[hour] = { total: 0, count: 0 };
  }

  posts.forEach(post => {
    if (post.postedAt) {
      const date = new Date(post.postedAt);
      const hour = date.getHours().toString().padStart(2, '0');
      hoursDistribution[hour]++;

      const engagement = (post.likesCount || 0) + (post.commentsCount || 0) + (post.sharesCount || 0);
      hourEngagement[hour].total += engagement;
      hourEngagement[hour].count++;
    }
  });

  // Find peak hours (top 3)
  const sortedHours = Object.entries(hoursDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .filter(([, count]) => count > 0)
    .map(([hour]) => hour);

  return { hoursDistribution, peakHours: sortedHours };
}

function analyzeDayOfWeek(posts: any[]): PostingDaysDistribution {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const distribution: PostingDaysDistribution = {
    monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
    friday: 0, saturday: 0, sunday: 0,
  };

  posts.forEach(post => {
    if (post.postedAt) {
      const date = new Date(post.postedAt);
      const dayIndex = date.getDay();
      const dayName = dayNames[dayIndex];
      distribution[dayName]++;
    }
  });

  return distribution;
}

function analyzeEngagement(posts: any[]) {
  if (posts.length === 0) {
    return { avgEngagementRate: 0, engagementTrend: [], bestHours: [] };
  }

  // Calculate average engagement rate
  const totalEngagement = posts.reduce((sum, p) => {
    return sum + (p.engagementRate || 0);
  }, 0);
  const avgEngagementRate = totalEngagement / posts.length;

  // Calculate trend by date
  const engagementByDate: { [date: string]: { total: number; count: number } } = {};
  const engagementByHour: { [hour: string]: { total: number; count: number } } = {};

  posts.forEach(post => {
    if (post.postedAt) {
      const date = post.postedAt.split('T')[0];
      const hour = new Date(post.postedAt).getHours().toString().padStart(2, '0');

      if (!engagementByDate[date]) {
        engagementByDate[date] = { total: 0, count: 0 };
      }
      engagementByDate[date].total += post.engagementRate || 0;
      engagementByDate[date].count++;

      if (!engagementByHour[hour]) {
        engagementByHour[hour] = { total: 0, count: 0 };
      }
      engagementByHour[hour].total += post.engagementRate || 0;
      engagementByHour[hour].count++;
    }
  });

  const engagementTrend: EngagementTrendPoint[] = Object.entries(engagementByDate)
    .map(([date, data]) => ({
      date,
      rate: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Find best engagement hours (top 3)
  const bestHours = Object.entries(engagementByHour)
    .map(([hour, data]) => ({
      hour,
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3)
    .filter(h => h.avgEngagement > 0)
    .map(h => h.hour);

  return { avgEngagementRate, engagementTrend, bestHours };
}

function analyzeContent(posts: any[]) {
  if (posts.length === 0) {
    return { avgLength: 0, emojiRate: 0, hashtagCount: 0, mediaRate: 0 };
  }

  let totalLength = 0;
  let postsWithEmoji = 0;
  let totalHashtags = 0;
  let postsWithMedia = 0;

  // Emoji regex pattern (simplified for broader compatibility)
  // Using surrogate pairs for emoji detection instead of Unicode property escapes
  const emojiRegex = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;

  posts.forEach(post => {
    if (post.content) {
      totalLength += post.content.length;

      if (emojiRegex.test(post.content)) {
        postsWithEmoji++;
      }
    }

    if (post.hashtags) {
      try {
        const tags = JSON.parse(post.hashtags);
        totalHashtags += Array.isArray(tags) ? tags.length : 0;
      } catch {
        // Count # symbols if not JSON
        const matches = post.hashtags.match(/#/g);
        totalHashtags += matches ? matches.length : 0;
      }
    }

    if (post.mediaUrls) {
      try {
        const media = JSON.parse(post.mediaUrls);
        if (Array.isArray(media) && media.length > 0) {
          postsWithMedia++;
        }
      } catch {
        if (post.mediaUrls.length > 0) {
          postsWithMedia++;
        }
      }
    }
  });

  return {
    avgLength: Math.round(totalLength / posts.length),
    emojiRate: postsWithEmoji / posts.length,
    hashtagCount: totalHashtags / posts.length,
    mediaRate: postsWithMedia / posts.length,
  };
}

async function savePatternToDatabase(pattern: BehaviorPattern): Promise<void> {
  // Check if pattern exists
  const existing = await db.query.modelAccountBehaviorPatterns.findFirst({
    where: eq(schema.modelAccountBehaviorPatterns.modelAccountId, pattern.modelAccountId),
  });

  const data = {
    modelAccountId: pattern.modelAccountId,
    avgPostsPerDay: pattern.avgPostsPerDay.toFixed(2),
    avgPostsPerWeek: pattern.avgPostsPerWeek.toFixed(2),
    postingFrequencyStdDev: pattern.postingFrequencyStdDev.toFixed(2),
    postingHoursDistribution: JSON.stringify(pattern.postingHoursDistribution),
    peakPostingHours: JSON.stringify(pattern.peakPostingHours),
    postingDaysDistribution: JSON.stringify(pattern.postingDaysDistribution),
    avgEngagementRate: pattern.avgEngagementRate.toFixed(2),
    engagementRateTrend: JSON.stringify(pattern.engagementRateTrend),
    bestEngagementHours: JSON.stringify(pattern.bestEngagementHours),
    followerGrowthRate: pattern.followerGrowthRate.toFixed(2),
    followerHistory: JSON.stringify(pattern.followerHistory),
    avgContentLength: pattern.avgContentLength,
    emojiUsageRate: pattern.emojiUsageRate.toFixed(2),
    hashtagAvgCount: pattern.hashtagAvgCount.toFixed(2),
    mediaUsageRate: pattern.mediaUsageRate.toFixed(2),
    analysisPeriodStart: pattern.analysisPeriodStart,
    analysisPeriodEnd: pattern.analysisPeriodEnd,
    sampleSize: pattern.sampleSize,
    lastAnalyzedAt: toMySQLTimestamp(new Date()),
  };

  if (existing) {
    await db
      .update(schema.modelAccountBehaviorPatterns)
      .set(data)
      .where(eq(schema.modelAccountBehaviorPatterns.id, existing.id));
  } else {
    await db.insert(schema.modelAccountBehaviorPatterns).values(data);
  }
}
