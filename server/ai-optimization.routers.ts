import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { db } from "./db";
import { aiOptimizations, agents, postAnalytics, posts } from "../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

/**
 * AI Optimization Router
 * Manages AI-powered optimization of agent parameters based on performance data
 */

export const aiOptimizationRouter = router({
  /**
   * Analyze agent performance and suggest optimizations
   */
  analyzeAgent: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      projectId: z.number().optional(),
      daysBack: z.number().default(30),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[AIOptimization] Analyzing agent:", input.agentId);

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
        throw new Error("Agent not found");
      }

      // Get performance data for the last N days
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - input.daysBack);

      const performanceData = await db
        .select()
        .from(postAnalytics)
        .where(gte(postAnalytics.recordedAt, dateThreshold.toISOString()));

      // Calculate average metrics
      const avgEngagement = performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + (p.engagementRate ?? 0), 0) / performanceData.length
        : 0;
      const avgLikes = performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + (p.likesCount ?? 0), 0) / performanceData.length
        : 0;
      const avgViews = performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + (p.viewsCount ?? 0), 0) / performanceData.length
        : 0;

      // Generate AI-powered optimization suggestions
      const optimizationPrompt = `Analyze the following social media agent and its performance data, then suggest optimizations:

Agent Details:
- Name: ${agent.name}
- Theme: ${agent.theme}
- Tone: ${agent.tone}
- Style: ${agent.style}
- Target Audience: ${agent.targetAudience}
- Posting Frequency: ${agent.postingFrequency || "Not set"}

Performance Data (Last ${input.daysBack} days):
- Average Engagement Rate: ${avgEngagement / 100}%
- Average Likes: ${avgLikes}
- Average Views: ${avgViews}
- Total Posts: ${performanceData.length}

Suggest optimizations for:
1. Tone adjustment (if needed)
2. Style adjustment (if needed)
3. Content strategy improvements
4. Posting timing optimization

Format the response as JSON with the following structure:
{
  "toneAdjustment": {
    "current": "current tone",
    "suggested": "suggested tone",
    "reason": "reason for change"
  },
  "styleAdjustment": {
    "current": "current style",
    "suggested": "suggested style",
    "reason": "reason for change"
  },
  "contentStrategy": ["suggestion 1", "suggestion 2", ...],
  "timingOptimization": {
    "currentFrequency": "current frequency",
    "suggestedFrequency": "suggested frequency",
    "reason": "reason for change"
  },
  "expectedImprovement": 15
}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a social media optimization expert." },
            { role: "user", content: optimizationPrompt },
          ],
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "optimization_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  toneAdjustment: {
                    type: "object",
                    properties: {
                      current: { type: "string" },
                      suggested: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["current", "suggested", "reason"],
                    additionalProperties: false,
                  },
                  styleAdjustment: {
                    type: "object",
                    properties: {
                      current: { type: "string" },
                      suggested: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["current", "suggested", "reason"],
                    additionalProperties: false,
                  },
                  contentStrategy: {
                    type: "array",
                    items: { type: "string" },
                  },
                  timingOptimization: {
                    type: "object",
                    properties: {
                      currentFrequency: { type: "string" },
                      suggestedFrequency: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["currentFrequency", "suggestedFrequency", "reason"],
                    additionalProperties: false,
                  },
                  expectedImprovement: { type: "number" },
                },
                required: ["toneAdjustment", "styleAdjustment", "contentStrategy", "timingOptimization", "expectedImprovement"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error("No response from AI");
        }

        const suggestions = JSON.parse(content);

        // Save optimization to database
        const beforeParams = {
          tone: agent.tone,
          style: agent.style,
          postingFrequency: agent.postingFrequency,
        };

        const afterParams = {
          tone: suggestions.toneAdjustment.suggested,
          style: suggestions.styleAdjustment.suggested,
          postingFrequency: suggestions.timingOptimization.suggestedFrequency,
        };

        await db.insert(aiOptimizations).values({
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          agentId: input.agentId,
          type: "tone_adjustment",
          beforeParams: JSON.stringify(beforeParams),
          afterParams: JSON.stringify(afterParams),
          performanceImprovement: Math.round(suggestions.expectedImprovement * 100),
          insights: JSON.stringify(suggestions),
          status: "pending",
        });

        return {
          success: true,
          suggestions,
        };
      } catch (error: any) {
        console.error("[AIOptimization] Error generating optimization suggestions:", error);
        throw new Error(`Failed to generate optimization suggestions: ${error.message}`);
      }
    }),

  /**
   * Apply optimization to agent
   */
  applyOptimization: protectedProcedure
    .input(z.object({
      optimizationId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get optimization details
      const [optimization] = await db
        .select()
        .from(aiOptimizations)
        .where(
          and(
            eq(aiOptimizations.id, input.optimizationId),
            eq(aiOptimizations.userId, ctx.user.id)
          )
        );

      if (!optimization) {
        throw new Error("Optimization not found");
      }

      if (optimization.status === "applied") {
        throw new Error("Optimization already applied");
      }

      // Parse after params
      const afterParams = JSON.parse(optimization.afterParams ?? "{}");

      // Update agent with new parameters
      await db
        .update(agents)
        .set({
          tone: afterParams.tone,
          style: afterParams.style,
          postingFrequency: afterParams.postingFrequency,
        })
        .where(eq(agents.id, optimization.agentId ?? 0));

      // Update optimization status
      await db
        .update(aiOptimizations)
        .set({
          status: "applied",
          appliedAt: new Date().toISOString(),
        })
        .where(eq(aiOptimizations.id, input.optimizationId));

      return { success: true };
    }),

  /**
   * Revert optimization
   */
  revertOptimization: protectedProcedure
    .input(z.object({
      optimizationId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get optimization details
      const [optimization] = await db
        .select()
        .from(aiOptimizations)
        .where(
          and(
            eq(aiOptimizations.id, input.optimizationId),
            eq(aiOptimizations.userId, ctx.user.id)
          )
        );

      if (!optimization) {
        throw new Error("Optimization not found");
      }

      if (optimization.status !== "applied") {
        throw new Error("Optimization not applied yet");
      }

      // Parse before params
      const beforeParams = JSON.parse(optimization.beforeParams ?? "{}");

      // Revert agent to previous parameters
      await db
        .update(agents)
        .set({
          tone: beforeParams.tone,
          style: beforeParams.style,
          postingFrequency: beforeParams.postingFrequency,
        })
        .where(eq(agents.id, optimization.agentId ?? 0));

      // Update optimization status
      await db
        .update(aiOptimizations)
        .set({
          status: "reverted",
        })
        .where(eq(aiOptimizations.id, input.optimizationId));

      return { success: true };
    }),

  /**
   * List optimizations
   */
  listOptimizations: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      agentId: z.number().optional(),
      status: z.enum(["pending", "applied", "reverted"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(aiOptimizations.userId, ctx.user.id)];
      if (input.projectId) {
        conditions.push(eq(aiOptimizations.projectId, input.projectId));
      }
      if (input.agentId) {
        conditions.push(eq(aiOptimizations.agentId, input.agentId));
      }
      if (input.status) {
        conditions.push(eq(aiOptimizations.status, input.status));
      }

      const optimizations = await db
        .select()
        .from(aiOptimizations)
        .where(and(...conditions))
        .orderBy(desc(aiOptimizations.createdAt))
        .limit(input.limit);

      return optimizations.map((opt) => ({
        ...opt,
        beforeParams: opt.beforeParams ? JSON.parse(opt.beforeParams) : {},
        afterParams: opt.afterParams ? JSON.parse(opt.afterParams) : {},
        insights: opt.insights ? JSON.parse(opt.insights) : {},
        performanceImprovement: opt.performanceImprovement ? opt.performanceImprovement / 100 : 0,
      }));
    }),

  /**
   * Get optimization by ID
   */
  getOptimizationById: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const [optimization] = await db
        .select()
        .from(aiOptimizations)
        .where(
          and(
            eq(aiOptimizations.id, input.id),
            eq(aiOptimizations.userId, ctx.user.id)
          )
        );

      if (!optimization) {
        throw new Error("Optimization not found");
      }

      return {
        ...optimization,
        beforeParams: optimization.beforeParams ? JSON.parse(optimization.beforeParams) : {},
        afterParams: optimization.afterParams ? JSON.parse(optimization.afterParams) : {},
        insights: optimization.insights ? JSON.parse(optimization.insights) : {},
        performanceImprovement: optimization.performanceImprovement ? optimization.performanceImprovement / 100 : 0,
      };
    }),

  /**
   * Delete optimization
   */
  deleteOptimization: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(aiOptimizations)
        .where(
          and(
            eq(aiOptimizations.id, input.id),
            eq(aiOptimizations.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
