import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "./db";
import { contentRewrites, collectedContents, agents } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

import { createLogger } from "./utils/logger";

const logger = createLogger("content-rewrite.routers");

/**
 * Content Rewrite Router
 * Manages AI-powered content rewriting based on agent personas
 */

export const contentRewriteRouter = router({
  /**
   * Rewrite a single piece of content
   */
  rewriteContent: protectedProcedure
    .input(z.object({
      collectedContentId: z.number().optional(),
      originalContent: z.string(),
      agentId: z.number(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get agent details
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.agentId),
            eq(agents.userId, ctx.user.id)
          )
        );

      if (!agent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      // Create rewrite prompt based on agent persona
      const prompt = `You are a social media content creator with the following persona:

Name: ${agent.name}
Theme: ${agent.theme}
Tone: ${agent.tone}
Style: ${agent.style}
Target Audience: ${agent.targetAudience}
Description: ${agent.description}

Rewrite the following content to match this persona. Keep the core message but adapt the tone, style, and language to fit the persona. Make it engaging and suitable for social media.

Original content:
${input.originalContent}

Rewritten content:`;

      try {
        // Use user's OpenAI API key if configured, otherwise fall back to Manus Forge API
        const customApiKey = process.env.OPENAI_API_KEY;
        const customApiUrl = customApiKey ? 'https://api.openai.com' : undefined;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert social media content creator." },
            { role: "user", content: prompt },
          ],
        });

        const rewrittenContent = response.choices[0]?.message?.content;

        if (!rewrittenContent || typeof rewrittenContent !== 'string') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "No response from AI" });
        }

        // Save rewrite to database
        await db.insert(contentRewrites).values({
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          collectedContentId: input.collectedContentId ?? null,
          agentId: input.agentId,
          originalContent: input.originalContent,
          rewrittenContent: rewrittenContent.trim(),
          rewritePrompt: prompt,
          status: "completed",
          rewrittenAt: new Date().toISOString(),
        });

        return {
          success: true,
          rewrittenContent: rewrittenContent.trim(),
        };
      } catch (error: any) {
        logger.error("[ContentRewrite] Error rewriting content:", error);

        // Save failed rewrite to database
        await db.insert(contentRewrites).values({
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          collectedContentId: input.collectedContentId ?? null,
          agentId: input.agentId,
          originalContent: input.originalContent,
          rewrittenContent: "",
          rewritePrompt: prompt,
          status: "failed",
          errorMessage: error.message,
        });

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to rewrite content: ${error.message}` });
      }
    }),

  /**
   * Batch rewrite multiple collected contents
   */
  batchRewrite: protectedProcedure
    .input(z.object({
      collectedContentIds: z.array(z.number()),
      agentId: z.number(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get agent details
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, input.agentId),
            eq(agents.userId, ctx.user.id)
          )
        );

      if (!agent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      // Get collected contents
      const contents = await db
        .select()
        .from(collectedContents)
        .where(
          and(
            eq(collectedContents.userId, ctx.user.id)
          )
        );

      const selectedContents = contents.filter((c) =>
        input.collectedContentIds.includes(c.id)
      );

      const results = [];

      for (const content of selectedContents) {
        try {
          // Create rewrite prompt
          const prompt = `You are a social media content creator with the following persona:

Name: ${agent.name}
Theme: ${agent.theme}
Tone: ${agent.tone}
Style: ${agent.style}
Target Audience: ${agent.targetAudience}

Rewrite the following content to match this persona:

${content.content}

Rewritten content:`;

          // Use user's OpenAI API key if configured
          const customApiKey = process.env.OPENAI_API_KEY;
          const customApiUrl = customApiKey ? 'https://api.openai.com' : undefined;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are an expert social media content creator." },
              { role: "user", content: prompt },
            ],
          });

          const rewrittenContent = response.choices[0]?.message?.content;

          if (!rewrittenContent || typeof rewrittenContent !== 'string') {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "No response from AI" });
          }

          // Save rewrite
          await db.insert(contentRewrites).values({
            userId: ctx.user.id,
            projectId: input.projectId ?? null,
            collectedContentId: content.id,
            agentId: input.agentId,
            originalContent: content.content,
            rewrittenContent: rewrittenContent.trim(),
            rewritePrompt: prompt,
            status: "completed",
            rewrittenAt: new Date().toISOString(),
          });

          results.push({
            contentId: content.id,
            success: true,
          });
        } catch (error: any) {
          logger.error(`[ContentRewrite] Error rewriting content ${content.id}:`, error);

          // Save failed rewrite
          await db.insert(contentRewrites).values({
            userId: ctx.user.id,
            projectId: input.projectId ?? null,
            collectedContentId: content.id,
            agentId: input.agentId,
            originalContent: content.content,
            rewrittenContent: "",
            rewritePrompt: "",
            status: "failed",
            errorMessage: error.message,
          });

          results.push({
            contentId: content.id,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        results,
        totalProcessed: results.length,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
      };
    }),

  /**
   * List rewrites
   */
  listRewrites: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      agentId: z.number().optional(),
      status: z.enum(["pending", "completed", "failed"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(contentRewrites.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(contentRewrites.projectId, input.projectId));
      }
      if (input.agentId) {
        conditions.push(eq(contentRewrites.agentId, input.agentId));
      }
      if (input.status) {
        conditions.push(eq(contentRewrites.status, input.status));
      }

      const rewrites = await db
        .select()
        .from(contentRewrites)
        .where(and(...conditions))
        .orderBy(desc(contentRewrites.createdAt))
        .limit(input.limit);

      return rewrites;
    }),

  /**
   * Get rewrite by ID
   */
  getRewriteById: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const [rewrite] = await db
        .select()
        .from(contentRewrites)
        .where(
          and(
            eq(contentRewrites.id, input.id),
            eq(contentRewrites.userId, ctx.user.id)
          )
        );

      if (!rewrite) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Rewrite not found" });
      }

      return rewrite;
    }),

  /**
   * Delete rewrite
   */
  deleteRewrite: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(contentRewrites)
        .where(
          and(
            eq(contentRewrites.id, input.id),
            eq(contentRewrites.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
