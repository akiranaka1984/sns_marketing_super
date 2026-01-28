import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { accountRelationships, accounts, projectAccounts } from "../drizzle/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";

/**
 * Account Relationships Router
 * Manages intimacy/closeness relationships between accounts in a project
 */

export const accountRelationshipsRouter = router({
  /**
   * Get all relationships for a project
   */
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const relationships = await db.query.accountRelationships.findMany({
        where: and(
          eq(accountRelationships.projectId, input.projectId),
          eq(accountRelationships.isActive, true)
        ),
        orderBy: [desc(accountRelationships.intimacyLevel)],
      });

      // Get account details for each relationship
      const accountIds = new Set<number>();
      relationships.forEach(r => {
        accountIds.add(r.fromAccountId);
        accountIds.add(r.toAccountId);
      });

      const accountsData = accountIds.size > 0
        ? await db.query.accounts.findMany({
            where: inArray(accounts.id, Array.from(accountIds)),
          })
        : [];

      const accountsMap = new Map(accountsData.map(a => [a.id, a]));

      return relationships.map(r => ({
        ...r,
        fromAccount: accountsMap.get(r.fromAccountId),
        toAccount: accountsMap.get(r.toAccountId),
      }));
    }),

  /**
   * Get relationships for a specific account
   */
  getForAccount: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      accountId: z.number(),
    }))
    .query(async ({ input }) => {
      const relationships = await db.query.accountRelationships.findMany({
        where: and(
          eq(accountRelationships.projectId, input.projectId),
          or(
            eq(accountRelationships.fromAccountId, input.accountId),
            eq(accountRelationships.toAccountId, input.accountId)
          ),
          eq(accountRelationships.isActive, true)
        ),
      });

      return relationships;
    }),

  /**
   * Create or update a relationship between two accounts
   */
  upsert: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      fromAccountId: z.number(),
      toAccountId: z.number(),
      intimacyLevel: z.number().min(0).max(100).default(50),
      relationshipType: z.enum(['friend', 'acquaintance', 'follower', 'colleague', 'rival', 'stranger']).default('acquaintance'),
      interactionProbability: z.number().min(0).max(100).default(70),
      preferredReactionTypes: z.array(z.enum(['like', 'comment', 'retweet'])).optional(),
      commentStyle: z.enum(['supportive', 'curious', 'playful', 'professional', 'neutral']).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Check if relationship already exists
      const existing = await db.query.accountRelationships.findFirst({
        where: and(
          eq(accountRelationships.projectId, input.projectId),
          eq(accountRelationships.fromAccountId, input.fromAccountId),
          eq(accountRelationships.toAccountId, input.toAccountId)
        ),
      });

      if (existing) {
        // Update existing relationship
        await db.update(accountRelationships)
          .set({
            intimacyLevel: input.intimacyLevel,
            relationshipType: input.relationshipType,
            interactionProbability: input.interactionProbability,
            preferredReactionTypes: input.preferredReactionTypes
              ? JSON.stringify(input.preferredReactionTypes)
              : null,
            commentStyle: input.commentStyle || null,
            notes: input.notes || null,
            isActive: true,
          })
          .where(eq(accountRelationships.id, existing.id));

        return { id: existing.id, updated: true };
      } else {
        // Create new relationship
        const [result] = await db.insert(accountRelationships).values({
          projectId: input.projectId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          intimacyLevel: input.intimacyLevel,
          relationshipType: input.relationshipType,
          interactionProbability: input.interactionProbability,
          preferredReactionTypes: input.preferredReactionTypes
            ? JSON.stringify(input.preferredReactionTypes)
            : JSON.stringify(['like', 'comment']),
          commentStyle: input.commentStyle || 'neutral',
          notes: input.notes || null,
          isActive: true,
        });

        return { id: Number(result.insertId), updated: false };
      }
    }),

  /**
   * Bulk create relationships (for initializing all project accounts)
   */
  initializeForProject: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      defaultIntimacyLevel: z.number().min(0).max(100).default(50),
      defaultRelationshipType: z.enum(['friend', 'acquaintance', 'follower', 'colleague', 'rival', 'stranger']).default('acquaintance'),
    }))
    .mutation(async ({ input }) => {
      // Get all accounts in the project
      const projectAccountsList = await db.query.projectAccounts.findMany({
        where: and(
          eq(projectAccounts.projectId, input.projectId),
          eq(projectAccounts.isActive, true)
        ),
      });

      const accountIds = projectAccountsList.map(pa => pa.accountId);

      if (accountIds.length < 2) {
        return { created: 0, message: "Need at least 2 accounts in project" };
      }

      let created = 0;

      // Create relationships between all pairs
      for (const fromId of accountIds) {
        for (const toId of accountIds) {
          if (fromId === toId) continue;

          // Check if relationship exists
          const existing = await db.query.accountRelationships.findFirst({
            where: and(
              eq(accountRelationships.projectId, input.projectId),
              eq(accountRelationships.fromAccountId, fromId),
              eq(accountRelationships.toAccountId, toId)
            ),
          });

          if (!existing) {
            await db.insert(accountRelationships).values({
              projectId: input.projectId,
              fromAccountId: fromId,
              toAccountId: toId,
              intimacyLevel: input.defaultIntimacyLevel,
              relationshipType: input.defaultRelationshipType,
              interactionProbability: 70,
              preferredReactionTypes: JSON.stringify(['like', 'comment']),
              commentStyle: 'neutral',
              isActive: true,
            });
            created++;
          }
        }
      }

      return { created, total: accountIds.length * (accountIds.length - 1) };
    }),

  /**
   * Update relationship
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      intimacyLevel: z.number().min(0).max(100).optional(),
      relationshipType: z.enum(['friend', 'acquaintance', 'follower', 'colleague', 'rival', 'stranger']).optional(),
      interactionProbability: z.number().min(0).max(100).optional(),
      preferredReactionTypes: z.array(z.enum(['like', 'comment', 'retweet'])).optional(),
      commentStyle: z.enum(['supportive', 'curious', 'playful', 'professional', 'neutral']).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;

      const cleanedData: any = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          if (key === 'preferredReactionTypes') {
            cleanedData[key] = JSON.stringify(value);
          } else {
            cleanedData[key] = value;
          }
        }
      }

      if (Object.keys(cleanedData).length > 0) {
        await db.update(accountRelationships)
          .set(cleanedData)
          .where(eq(accountRelationships.id, id));
      }

      return { success: true };
    }),

  /**
   * Delete relationship (soft delete)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.update(accountRelationships)
        .set({
          isActive: false,
        })
        .where(eq(accountRelationships.id, input.id));

      return { success: true };
    }),

  /**
   * Get relationship matrix for a project (for visualization)
   */
  getMatrix: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      // Get all accounts in project
      const projectAccountsList = await db.query.projectAccounts.findMany({
        where: and(
          eq(projectAccounts.projectId, input.projectId),
          eq(projectAccounts.isActive, true)
        ),
      });

      const accountIds = projectAccountsList.map(pa => pa.accountId);

      // Get account details
      const accountsData = accountIds.length > 0
        ? await db.query.accounts.findMany({
            where: inArray(accounts.id, accountIds),
          })
        : [];

      // Get all relationships
      const relationships = await db.query.accountRelationships.findMany({
        where: and(
          eq(accountRelationships.projectId, input.projectId),
          eq(accountRelationships.isActive, true)
        ),
      });

      // Build matrix
      const matrix: Record<number, Record<number, typeof accountRelationships.$inferSelect | null>> = {};

      for (const fromId of accountIds) {
        matrix[fromId] = {};
        for (const toId of accountIds) {
          if (fromId === toId) {
            matrix[fromId][toId] = null;
          } else {
            matrix[fromId][toId] = relationships.find(
              r => r.fromAccountId === fromId && r.toAccountId === toId
            ) || null;
          }
        }
      }

      return {
        accounts: accountsData,
        matrix,
      };
    }),
});
