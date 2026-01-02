import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { postAnalytics, accounts, scheduledPosts } from "../drizzle/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";

export const analyticsRouter = router({
  /**
   * Get performance overview for all accounts
   */
  getOverview: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get all user accounts
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = userAccounts.map((acc) => acc.id);

      if (accountIds.length === 0) {
        return {
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          avgEngagementRate: 0,
          accountPerformance: [],
        };
      }

      // Build date filter
      let dateFilter = sql`1=1`;
      if (input.startDate) {
        dateFilter = and(
          dateFilter,
          gte(postAnalytics.recordedAt, new Date(input.startDate))
        )!;
      }
      if (input.endDate) {
        dateFilter = and(
          dateFilter,
          lte(postAnalytics.recordedAt, new Date(input.endDate))
        )!;
      }

      // Get aggregated analytics
      const analytics = await db
        .select({
          accountId: postAnalytics.accountId,
          totalPosts: sql<number>`COUNT(*)`,
          totalViews: sql<number>`SUM(${postAnalytics.viewsCount})`,
          totalLikes: sql<number>`SUM(${postAnalytics.likesCount})`,
          totalComments: sql<number>`SUM(${postAnalytics.commentsCount})`,
          totalShares: sql<number>`SUM(${postAnalytics.sharesCount})`,
          avgEngagementRate: sql<number>`AVG(${postAnalytics.engagementRate})`,
        })
        .from(postAnalytics)
        .where(and(inArray(postAnalytics.accountId, accountIds), dateFilter))
        .groupBy(postAnalytics.accountId);

      // Calculate totals
      const totals = analytics.reduce(
        (acc, curr) => ({
          totalPosts: acc.totalPosts + Number(curr.totalPosts),
          totalViews: acc.totalViews + Number(curr.totalViews || 0),
          totalLikes: acc.totalLikes + Number(curr.totalLikes || 0),
          totalComments: acc.totalComments + Number(curr.totalComments || 0),
          totalShares: acc.totalShares + Number(curr.totalShares || 0),
          avgEngagementRate:
            acc.avgEngagementRate + Number(curr.avgEngagementRate || 0),
        }),
        {
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          avgEngagementRate: 0,
        }
      );

      // Calculate average engagement rate
      if (analytics.length > 0) {
        totals.avgEngagementRate = totals.avgEngagementRate / analytics.length;
      }

      // Get account performance details
      const accountPerformance = await Promise.all(
        analytics.map(async (analytic) => {
          const account = userAccounts.find((acc) => acc.id === analytic.accountId);
          return {
            accountId: analytic.accountId,
            accountName: account?.username || "Unknown",
            platform: account?.platform || "unknown",
            totalPosts: Number(analytic.totalPosts),
            totalViews: Number(analytic.totalViews || 0),
            totalLikes: Number(analytic.totalLikes || 0),
            totalComments: Number(analytic.totalComments || 0),
            totalShares: Number(analytic.totalShares || 0),
            avgEngagementRate: Number(analytic.avgEngagementRate || 0) / 100, // Convert back to percentage
          };
        })
      );

      return {
        ...totals,
        avgEngagementRate: totals.avgEngagementRate / 100, // Convert back to percentage
        accountPerformance,
      };
    }),

  /**
   * Get time-series analytics data for charts
   */
  getTimeSeries: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
        interval: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Verify account ownership if accountId is provided
      if (input.accountId) {
        const account = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
          .limit(1);

        if (account.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Account not found or access denied",
          });
        }
      }

      // Build query
      // Build date column for grouping using proper SQL template
      const dateColumn = sql<string>`DATE(\`recordedAt\`)`;

      let query = db
        .select({
          date: dateColumn,
          views: sql<number>`SUM(\`viewsCount\`)`,
          likes: sql<number>`SUM(\`likesCount\`)`,
          comments: sql<number>`SUM(\`commentsCount\`)`,
          shares: sql<number>`SUM(\`sharesCount\`)`,
          engagementRate: sql<number>`AVG(\`engagementRate\`)`,
        })
        .from(postAnalytics)
        .where(
          and(
            gte(postAnalytics.recordedAt, new Date(input.startDate)),
            lte(postAnalytics.recordedAt, new Date(input.endDate)),
            input.accountId
              ? eq(postAnalytics.accountId, input.accountId)
              : undefined
          )
        )
        .groupBy(dateColumn)
        .orderBy(dateColumn);

      const results = await query;

      return results.map((row) => ({
        date: row.date,
        views: Number(row.views || 0),
        likes: Number(row.likes || 0),
        comments: Number(row.comments || 0),
        shares: Number(row.shares || 0),
        engagementRate: Number(row.engagementRate || 0) / 100,
      }));
    }),

  /**
   * Get top performing posts
   */
  getTopPosts: protectedProcedure
    .input(
      z.object({
        accountId: z.number().optional(),
        limit: z.number().default(10),
        sortBy: z.enum(["views", "likes", "engagement"]).default("engagement"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get user accounts
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId));

      const accountIds = input.accountId
        ? [input.accountId]
        : userAccounts.map((acc) => acc.id);

      if (accountIds.length === 0) {
        return [];
      }

      // Get top posts based on sort criteria
      let topPosts;
      if (input.sortBy === "views") {
        topPosts = await db
          .select({
            postId: postAnalytics.postId,
            accountId: postAnalytics.accountId,
            platform: postAnalytics.platform,
            views: postAnalytics.viewsCount,
            likes: postAnalytics.likesCount,
            comments: postAnalytics.commentsCount,
            shares: postAnalytics.sharesCount,
            engagementRate: postAnalytics.engagementRate,
            recordedAt: postAnalytics.recordedAt,
          })
          .from(postAnalytics)
          .where(inArray(postAnalytics.accountId, accountIds))
          .orderBy(desc(postAnalytics.viewsCount))
          .limit(input.limit);
      } else if (input.sortBy === "likes") {
        topPosts = await db
          .select({
            postId: postAnalytics.postId,
            accountId: postAnalytics.accountId,
            platform: postAnalytics.platform,
            views: postAnalytics.viewsCount,
            likes: postAnalytics.likesCount,
            comments: postAnalytics.commentsCount,
            shares: postAnalytics.sharesCount,
            engagementRate: postAnalytics.engagementRate,
            recordedAt: postAnalytics.recordedAt,
          })
          .from(postAnalytics)
          .where(inArray(postAnalytics.accountId, accountIds))
          .orderBy(desc(postAnalytics.likesCount))
          .limit(input.limit);
      } else {
        topPosts = await db
          .select({
            postId: postAnalytics.postId,
            accountId: postAnalytics.accountId,
            platform: postAnalytics.platform,
            views: postAnalytics.viewsCount,
            likes: postAnalytics.likesCount,
            comments: postAnalytics.commentsCount,
            shares: postAnalytics.sharesCount,
            engagementRate: postAnalytics.engagementRate,
            recordedAt: postAnalytics.recordedAt,
          })
          .from(postAnalytics)
          .where(inArray(postAnalytics.accountId, accountIds))
          .orderBy(desc(postAnalytics.engagementRate))
          .limit(input.limit);
      }

      // Get post content from scheduled_posts
      const postsWithContent = await Promise.all(
        topPosts.map(async (post) => {
          const postContent = await db
            .select()
            .from(scheduledPosts)
            .where(eq(scheduledPosts.id, post.postId))
            .limit(1);

          const account = userAccounts.find((acc) => acc.id === post.accountId);

          return {
            ...post,
            content: postContent[0]?.content || "",
            accountName: account?.username || "Unknown",
            engagementRate: post.engagementRate / 100,
          };
        })
      );

      return postsWithContent;
    }),

  /**
   * Record analytics data (called after posting)
   */
  recordAnalytics: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        accountId: z.number(),
        platform: z.enum(["twitter", "tiktok", "instagram", "facebook"]),
        views: z.number().default(0),
        likes: z.number().default(0),
        comments: z.number().default(0),
        shares: z.number().default(0),
        saves: z.number().default(0),
        clicks: z.number().default(0),
        reach: z.number().default(0),
        impressions: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Calculate engagement rate
      const totalEngagements = input.likes + input.comments + input.shares;
      const engagementRate =
        input.impressions > 0
          ? Math.round((totalEngagements / input.impressions) * 10000) // Store as percentage * 100
          : 0;

      // Insert analytics record
      await db.insert(postAnalytics).values({
        postId: input.postId,
        accountId: input.accountId,
        platform: input.platform,
        viewsCount: input.views,
        likesCount: input.likes,
        commentsCount: input.comments,
        sharesCount: input.shares,
        savesCount: input.saves,
        clicksCount: input.clicks,
        engagementRate,
        reachCount: input.reach,
        impressionsCount: input.impressions,
        recordedAt: new Date(),
      });

      return { success: true };
    }),
});
