import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { collectedContents, collectionSchedules } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import axios from "axios";

/**
 * Content Collection Router
 * Manages content collection from various platforms
 */

export const contentCollectionRouter = router({
  /**
   * Create a collection schedule
   */
  createSchedule: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      platform: z.enum(["twitter", "tiktok", "instagram", "facebook", "youtube", "other"]),
      searchKeywords: z.array(z.string()).optional(),
      searchHashtags: z.array(z.string()).optional(),
      searchAccounts: z.array(z.string()).optional(),
      frequency: z.enum(["hourly", "daily", "weekly"]).default("daily"),
      maxItemsPerRun: z.number().default(50),
    }))
    .mutation(async ({ input, ctx }) => {
      const schedule = await db.insert(collectionSchedules).values({
        userId: ctx.user.id,
        projectId: input.projectId ?? null,
        platform: input.platform,
        searchKeywords: input.searchKeywords ? JSON.stringify(input.searchKeywords) : null,
        searchHashtags: input.searchHashtags ? JSON.stringify(input.searchHashtags) : null,
        searchAccounts: input.searchAccounts ? JSON.stringify(input.searchAccounts) : null,
        frequency: input.frequency,
        maxItemsPerRun: input.maxItemsPerRun,
        isActive: 1,
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      });

      return {
        success: true,
        scheduleId: 1, // Return a placeholder ID
      };
    }),

  /**
   * List collection schedules
   */
  listSchedules: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(collectionSchedules.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(collectionSchedules.projectId, input.projectId));
      }

      const schedules = await db
        .select()
        .from(collectionSchedules)
        .where(and(...conditions))
        .orderBy(desc(collectionSchedules.createdAt));

      return schedules.map((schedule) => ({
        ...schedule,
        searchKeywords: schedule.searchKeywords ? JSON.parse(schedule.searchKeywords) : [],
        searchHashtags: schedule.searchHashtags ? JSON.parse(schedule.searchHashtags) : [],
        searchAccounts: schedule.searchAccounts ? JSON.parse(schedule.searchAccounts) : [],
      }));
    }),

  /**
   * Update collection schedule
   */
  updateSchedule: protectedProcedure
    .input(z.object({
      id: z.number(),
      searchKeywords: z.array(z.string()).optional(),
      searchHashtags: z.array(z.string()).optional(),
      searchAccounts: z.array(z.string()).optional(),
      frequency: z.enum(["hourly", "daily", "weekly"]).optional(),
      maxItemsPerRun: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const updateData: any = {};
      if (updates.searchKeywords !== undefined) {
        updateData.searchKeywords = JSON.stringify(updates.searchKeywords);
      }
      if (updates.searchHashtags !== undefined) {
        updateData.searchHashtags = JSON.stringify(updates.searchHashtags);
      }
      if (updates.searchAccounts !== undefined) {
        updateData.searchAccounts = JSON.stringify(updates.searchAccounts);
      }
      if (updates.frequency !== undefined) {
        updateData.frequency = updates.frequency;
      }
      if (updates.maxItemsPerRun !== undefined) {
        updateData.maxItemsPerRun = updates.maxItemsPerRun;
      }
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive;
      }

      await db
        .update(collectionSchedules)
        .set(updateData)
        .where(
          and(
            eq(collectionSchedules.id, id),
            eq(collectionSchedules.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Delete collection schedule
   */
  deleteSchedule: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(collectionSchedules)
        .where(
          and(
            eq(collectionSchedules.id, input.id),
            eq(collectionSchedules.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Manually collect content
   */
  collectContent: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get schedule
      const [schedule] = await db
        .select()
        .from(collectionSchedules)
        .where(
          and(
            eq(collectionSchedules.id, input.scheduleId),
            eq(collectionSchedules.userId, ctx.user.id)
          )
        );

      if (!schedule) {
        throw new Error("Schedule not found");
      }

      // Parse search parameters
      const keywords = schedule.searchKeywords ? JSON.parse(schedule.searchKeywords) : [];
      const hashtags = schedule.searchHashtags ? JSON.parse(schedule.searchHashtags) : [];
      const accounts = schedule.searchAccounts ? JSON.parse(schedule.searchAccounts) : [];

      // Simulate content collection (in production, this would use platform APIs)
      const collectedItems: any[] = [];
      
      // For demo purposes, create sample collected content
      const maxItems = schedule.maxItemsPerRun ?? 50;
      for (let i = 0; i < Math.min(5, maxItems); i++) {
        const keyword = keywords[i % keywords.length] || "sample";
        const hashtag = hashtags[i % hashtags.length] || "trending";
        
        await db.insert(collectedContents).values({
          userId: ctx.user.id,
          projectId: schedule.projectId ?? null,
          platform: schedule.platform,
          sourceUrl: `https://${schedule.platform}.com/post/${Date.now()}-${i}`,
          author: `user_${Math.floor(Math.random() * 1000)}`,
          content: `Sample content about ${keyword} with #${hashtag}. This is a demo collected content.`,
          mediaUrls: JSON.stringify([]),
          hashtags: JSON.stringify([hashtag]),
          likes: Math.floor(Math.random() * 1000),
          comments: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50),
          views: Math.floor(Math.random() * 10000),
        });

        collectedItems.push({
          id: i + 1,
          platform: schedule.platform,
          author: `user_${Math.floor(Math.random() * 1000)}`,
        });
      }

      // Update schedule last run time
      await db
        .update(collectionSchedules)
        .set({
          lastRunAt: new Date().toISOString(),
          nextRunAt: new Date(Date.now() + getNextRunDelay(schedule.frequency)).toISOString(),
        })
        .where(eq(collectionSchedules.id, input.scheduleId));

      return {
        success: true,
        collectedCount: collectedItems.length,
        items: collectedItems,
      };
    }),

  /**
   * List collected content
   */
  listCollectedContent: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      platform: z.enum(["twitter", "tiktok", "instagram", "facebook", "youtube", "other"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(collectedContents.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(collectedContents.projectId, input.projectId));
      }
      if (input.platform) {
        conditions.push(eq(collectedContents.platform, input.platform));
      }

      const contents = await db
        .select()
        .from(collectedContents)
        .where(and(...conditions))
        .orderBy(desc(collectedContents.collectedAt))
        .limit(input.limit);

      return contents.map((content) => ({
        ...content,
        mediaUrls: content.mediaUrls ? JSON.parse(content.mediaUrls) : [],
        hashtags: content.hashtags ? JSON.parse(content.hashtags) : [],
      }));
    }),

  /**
   * Delete collected content
   */
  deleteCollectedContent: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(collectedContents)
        .where(
          and(
            eq(collectedContents.id, input.id),
            eq(collectedContents.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});

/**
 * Helper function to calculate next run delay based on frequency
 */
function getNextRunDelay(frequency: "hourly" | "daily" | "weekly"): number {
  switch (frequency) {
    case "hourly":
      return 60 * 60 * 1000; // 1 hour
    case "daily":
      return 24 * 60 * 60 * 1000; // 1 day
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    default:
      return 24 * 60 * 60 * 1000; // Default to 1 day
  }
}
