import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { contentReviews, contentRewrites } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Content Review Router
 * Manages content review workflow for approval/rejection
 */

export const contentReviewRouter = router({
  /**
   * Submit content for review
   */
  submitForReview: protectedProcedure
    .input(z.object({
      contentRewriteId: z.number(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if content rewrite exists
      const [rewrite] = await db
        .select()
        .from(contentRewrites)
        .where(
          and(
            eq(contentRewrites.id, input.contentRewriteId),
            eq(contentRewrites.userId, ctx.user.id)
          )
        );

      if (!rewrite) {
        throw new Error("Content rewrite not found");
      }

      // Create review entry
      await db.insert(contentReviews).values({
        userId: ctx.user.id,
        projectId: input.projectId ?? null,
        contentRewriteId: input.contentRewriteId,
        reviewerId: ctx.user.id, // Self-review for now
        status: "pending",
      });

      return { success: true };
    }),

  /**
   * Approve content
   */
  approveContent: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      feedback: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(contentReviews)
        .set({
          status: "approved",
          feedback: input.feedback ?? null,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(contentReviews.id, input.reviewId),
            eq(contentReviews.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Reject content
   */
  rejectContent: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      feedback: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(contentReviews)
        .set({
          status: "rejected",
          feedback: input.feedback,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(contentReviews.id, input.reviewId),
            eq(contentReviews.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Request revision
   */
  requestRevision: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      feedback: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(contentReviews)
        .set({
          status: "revision_requested",
          feedback: input.feedback,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(contentReviews.id, input.reviewId),
            eq(contentReviews.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * List pending reviews
   */
  listPendingReviews: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(contentReviews.userId, ctx.user.id),
        eq(contentReviews.status, "pending"),
      ];
      if (input.projectId) {
        conditions.push(eq(contentReviews.projectId, input.projectId));
      }

      const reviews = await db
        .select()
        .from(contentReviews)
        .where(and(...conditions))
        .orderBy(desc(contentReviews.createdAt))
        .limit(input.limit);

      // Get associated content rewrites
      const reviewsWithContent = await Promise.all(
        reviews.map(async (review) => {
          const [rewrite] = await db
            .select()
            .from(contentRewrites)
            .where(eq(contentRewrites.id, review.contentRewriteId ?? 0));

          return {
            ...review,
            rewrite,
          };
        })
      );

      return reviewsWithContent;
    }),

  /**
   * List all reviews
   */
  listReviews: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      status: z.enum(["pending", "approved", "rejected", "revision_requested"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(contentReviews.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(contentReviews.projectId, input.projectId));
      }
      if (input.status) {
        conditions.push(eq(contentReviews.status, input.status));
      }

      const reviews = await db
        .select()
        .from(contentReviews)
        .where(and(...conditions))
        .orderBy(desc(contentReviews.createdAt))
        .limit(input.limit);

      // Get associated content rewrites
      const reviewsWithContent = await Promise.all(
        reviews.map(async (review) => {
          const [rewrite] = await db
            .select()
            .from(contentRewrites)
            .where(eq(contentRewrites.id, review.contentRewriteId ?? 0));

          return {
            ...review,
            rewrite,
          };
        })
      );

      return reviewsWithContent;
    }),

  /**
   * Get review by ID
   */
  getReviewById: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const [review] = await db
        .select()
        .from(contentReviews)
        .where(
          and(
            eq(contentReviews.id, input.id),
            eq(contentReviews.userId, ctx.user.id)
          )
        );

      if (!review) {
        throw new Error("Review not found");
      }

      // Get associated content rewrite
      const [rewrite] = await db
        .select()
        .from(contentRewrites)
        .where(eq(contentRewrites.id, review.contentRewriteId ?? 0));

      return {
        ...review,
        rewrite,
      };
    }),

  /**
   * Delete review
   */
  deleteReview: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(contentReviews)
        .where(
          and(
            eq(contentReviews.id, input.id),
            eq(contentReviews.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Get review statistics
   */
  getReviewStats: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(contentReviews.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(contentReviews.projectId, input.projectId));
      }

      const allReviews = await db
        .select()
        .from(contentReviews)
        .where(and(...conditions));

      const stats = {
        total: allReviews.length,
        pending: allReviews.filter((r) => r.status === "pending").length,
        approved: allReviews.filter((r) => r.status === "approved").length,
        rejected: allReviews.filter((r) => r.status === "rejected").length,
        revisionRequested: allReviews.filter((r) => r.status === "revision_requested").length,
        approvalRate: allReviews.length > 0
          ? Math.round((allReviews.filter((r) => r.status === "approved").length / allReviews.length) * 100)
          : 0,
      };

      return stats;
    }),
});
