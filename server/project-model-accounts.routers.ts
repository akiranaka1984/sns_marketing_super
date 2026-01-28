import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { db } from "./db";
import { projectModelAccounts, modelAccounts, buzzLearnings, projectAccounts, accounts } from "../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { applyBuzzLearningToAccount } from "./services/account-learning-service";

export const projectModelAccountsRouter = router({
  // List linked model accounts for a project
  list: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const links = await db
        .select({
          link: projectModelAccounts,
          modelAccount: modelAccounts,
        })
        .from(projectModelAccounts)
        .innerJoin(modelAccounts, eq(projectModelAccounts.modelAccountId, modelAccounts.id))
        .where(eq(projectModelAccounts.projectId, input.projectId))
        .orderBy(desc(projectModelAccounts.createdAt));

      // Get learning counts for each model account
      const result = [];
      for (const item of links) {
        const learningsCount = await db
          .select()
          .from(buzzLearnings)
          .where(and(
            eq(buzzLearnings.userId, ctx.user.id),
          ))
          .then(learnings => {
            // Filter learnings that came from posts by this model account
            return learnings.filter(l => {
              try {
                const exampleIds = JSON.parse(l.examplePostIds || '[]');
                // For now, count all learnings as there's no direct link
                return true;
              } catch {
                return false;
              }
            }).length;
          });

        result.push({
          ...item.link,
          modelAccount: item.modelAccount,
          learningsCount,
        });
      }

      return result;
    }),

  // Link a model account to a project
  link: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      modelAccountId: z.number(),
      autoApplyLearnings: z.boolean().default(false),
      targetAccountIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify model account belongs to user
      const modelAccount = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, input.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!modelAccount) {
        return { success: false, error: "Model account not found" };
      }

      // Check if already linked
      const existing = await db.query.projectModelAccounts.findFirst({
        where: and(
          eq(projectModelAccounts.projectId, input.projectId),
          eq(projectModelAccounts.modelAccountId, input.modelAccountId)
        ),
      });

      if (existing) {
        return { success: false, error: "Model account is already linked to this project", id: existing.id };
      }

      const [result] = await db.insert(projectModelAccounts).values({
        projectId: input.projectId,
        modelAccountId: input.modelAccountId,
        autoApplyLearnings: input.autoApplyLearnings ? 1 : 0,
        targetAccountIds: input.targetAccountIds ? JSON.stringify(input.targetAccountIds) : null,
      });

      return { success: true, id: result.insertId };
    }),

  // Unlink a model account from a project
  unlink: protectedProcedure
    .input(z.object({
      linkId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const link = await db.query.projectModelAccounts.findFirst({
        where: eq(projectModelAccounts.id, input.linkId),
      });

      if (!link) {
        return { success: false, error: "Link not found" };
      }

      // Verify user owns the model account
      const modelAccount = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, link.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!modelAccount) {
        return { success: false, error: "Unauthorized" };
      }

      await db.delete(projectModelAccounts)
        .where(eq(projectModelAccounts.id, input.linkId));

      return { success: true };
    }),

  // Update link settings
  updateSettings: protectedProcedure
    .input(z.object({
      linkId: z.number(),
      autoApplyLearnings: z.boolean().optional(),
      targetAccountIds: z.array(z.number()).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const link = await db.query.projectModelAccounts.findFirst({
        where: eq(projectModelAccounts.id, input.linkId),
      });

      if (!link) {
        return { success: false, error: "Link not found" };
      }

      // Verify user owns the model account
      const modelAccount = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, link.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!modelAccount) {
        return { success: false, error: "Unauthorized" };
      }

      const updateData: any = {};
      if (input.autoApplyLearnings !== undefined) {
        updateData.autoApplyLearnings = input.autoApplyLearnings ? 1 : 0;
      }
      if (input.targetAccountIds !== undefined) {
        updateData.targetAccountIds = input.targetAccountIds ? JSON.stringify(input.targetAccountIds) : null;
      }

      await db.update(projectModelAccounts)
        .set(updateData)
        .where(eq(projectModelAccounts.id, input.linkId));

      return { success: true };
    }),

  // Manually apply learnings from model account to project accounts
  applyLearnings: protectedProcedure
    .input(z.object({
      linkId: z.number(),
      learningIds: z.array(z.number()).optional(), // specific learnings, or all if not provided
    }))
    .mutation(async ({ ctx, input }) => {
      const link = await db.query.projectModelAccounts.findFirst({
        where: eq(projectModelAccounts.id, input.linkId),
      });

      if (!link) {
        return { success: false, error: "Link not found" };
      }

      // Verify user owns the model account
      const modelAccount = await db.query.modelAccounts.findFirst({
        where: and(
          eq(modelAccounts.id, link.modelAccountId),
          eq(modelAccounts.userId, ctx.user.id)
        ),
      });

      if (!modelAccount) {
        return { success: false, error: "Unauthorized" };
      }

      // Get project accounts
      const projectAccountsList = await db
        .select({
          projectAccount: projectAccounts,
          account: accounts,
        })
        .from(projectAccounts)
        .innerJoin(accounts, eq(projectAccounts.accountId, accounts.id))
        .where(eq(projectAccounts.projectId, link.projectId));

      // Filter by target accounts if specified
      let targetAccounts = projectAccountsList;
      if (link.targetAccountIds) {
        try {
          const targetIds = JSON.parse(link.targetAccountIds) as number[];
          if (targetIds.length > 0) {
            targetAccounts = projectAccountsList.filter(pa => targetIds.includes(pa.account.id));
          }
        } catch {
          // Use all accounts if parsing fails
        }
      }

      if (targetAccounts.length === 0) {
        return { success: false, error: "No target accounts found" };
      }

      // Get learnings to apply
      let learningsToApply = await db
        .select()
        .from(buzzLearnings)
        .where(and(
          eq(buzzLearnings.userId, ctx.user.id),
          eq(buzzLearnings.isActive, 1)
        ))
        .orderBy(desc(buzzLearnings.confidence));

      if (input.learningIds && input.learningIds.length > 0) {
        learningsToApply = learningsToApply.filter(l => input.learningIds!.includes(l.id));
      }

      if (learningsToApply.length === 0) {
        return { success: false, error: "No learnings to apply" };
      }

      // Apply learnings to each target account
      let applied = 0;
      let errors = 0;

      for (const account of targetAccounts) {
        for (const learning of learningsToApply) {
          try {
            await applyBuzzLearningToAccount(learning.id, account.account.id, link.projectId);
            applied++;
          } catch (error: any) {
            console.error(`[ProjectModelAccounts] Error applying learning ${learning.id} to account ${account.account.id}:`, error);
            errors++;
          }
        }
      }

      // Update sync timestamp
      await db.update(projectModelAccounts)
        .set({ lastSyncedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') })
        .where(eq(projectModelAccounts.id, input.linkId));

      return {
        success: true,
        applied,
        errors,
        targetAccountsCount: targetAccounts.length,
        learningsCount: learningsToApply.length,
      };
    }),

  // Get available model accounts (not yet linked to project)
  getAvailableModelAccounts: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Get all model accounts for user
      const allModelAccounts = await db
        .select()
        .from(modelAccounts)
        .where(eq(modelAccounts.userId, ctx.user.id));

      // Get already linked model accounts
      const linkedIds = await db
        .select({ modelAccountId: projectModelAccounts.modelAccountId })
        .from(projectModelAccounts)
        .where(eq(projectModelAccounts.projectId, input.projectId))
        .then(rows => rows.map(r => r.modelAccountId));

      // Filter out already linked
      return allModelAccounts.filter(ma => !linkedIds.includes(ma.id));
    }),

  // Get applied learnings for a project (from all linked model accounts)
  getAppliedLearnings: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Get all learnings that have been applied to accounts in this project
      const learnings = await db
        .select()
        .from(buzzLearnings)
        .where(and(
          eq(buzzLearnings.userId, ctx.user.id),
          eq(buzzLearnings.isActive, 1)
        ))
        .orderBy(desc(buzzLearnings.confidence))
        .limit(input.limit);

      return learnings;
    }),
});

/**
 * Sync learnings to all linked projects with auto-apply enabled
 * Called after extractPatterns creates new buzzLearnings
 */
export async function syncLearningsToLinkedProjects(
  learningIds: number[],
  userId: number
): Promise<{ projectId: number; applied: number; errors: number }[]> {
  const results: { projectId: number; applied: number; errors: number }[] = [];

  // Get all project-model links with auto-apply enabled
  const autoApplyLinks = await db
    .select({
      link: projectModelAccounts,
      modelAccount: modelAccounts,
    })
    .from(projectModelAccounts)
    .innerJoin(modelAccounts, eq(projectModelAccounts.modelAccountId, modelAccounts.id))
    .where(and(
      eq(modelAccounts.userId, userId),
      eq(projectModelAccounts.autoApplyLearnings, 1)
    ));

  if (autoApplyLinks.length === 0) {
    return results;
  }

  // Get the learnings
  const learnings = await db
    .select()
    .from(buzzLearnings)
    .where(and(
      inArray(buzzLearnings.id, learningIds),
      eq(buzzLearnings.userId, userId)
    ));

  // For each link with auto-apply
  for (const { link } of autoApplyLinks) {
    let applied = 0;
    let errors = 0;

    // Get project accounts
    const projectAccountsList = await db
      .select({ accountId: projectAccounts.accountId })
      .from(projectAccounts)
      .where(eq(projectAccounts.projectId, link.projectId));

    // Filter by target accounts if specified
    let targetAccountIds = projectAccountsList.map(pa => pa.accountId);
    if (link.targetAccountIds) {
      try {
        const targetIds = JSON.parse(link.targetAccountIds) as number[];
        if (targetIds.length > 0) {
          targetAccountIds = targetAccountIds.filter(id => targetIds.includes(id));
        }
      } catch {
        // Use all accounts
      }
    }

    // Apply learnings to each target account
    for (const accountId of targetAccountIds) {
      for (const learning of learnings) {
        try {
          await applyBuzzLearningToAccount(learning.id, accountId, link.projectId);
          applied++;
        } catch (error: any) {
          console.error(`[AutoApply] Error applying learning ${learning.id} to account ${accountId}:`, error);
          errors++;
        }
      }
    }

    // Update sync timestamp
    await db.update(projectModelAccounts)
      .set({ lastSyncedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') })
      .where(eq(projectModelAccounts.id, link.id));

    results.push({ projectId: link.projectId, applied, errors });
  }

  return results;
}
