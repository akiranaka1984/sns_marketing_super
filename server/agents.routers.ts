import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { agents, agentKnowledge, agentRules, agentAccounts, agentSchedules, agentExecutionLogs, accounts, aiOptimizations } from "../drizzle/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { runAgent, analyzePostPerformance, consolidateKnowledge } from "./agent-engine";
import {
  DEFAULT_AUTO_OPTIMIZATION_SETTINGS,
  AutoOptimizationSettings,
  triggerOptimizationCheck,
  getPendingOptimizations,
  approveOptimization,
  rejectOptimization,
} from "./services/auto-optimization-scheduler";

export const agentsRouter = router({
  // Get all agents
  list: protectedProcedure.query(async ({ ctx }) => {
    const allAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, ctx.user.id))
      .orderBy(desc(agents.createdAt));
    
    return allAgents;
  }),

  // Get agent by ID with full details
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }
      
      // Get linked accounts
      const linkedAccounts = await db
        .select({
          id: agentAccounts.id,
          accountId: agentAccounts.accountId,
          isActive: agentAccounts.isActive,
          account: accounts,
        })
        .from(agentAccounts)
        .leftJoin(accounts, eq(agentAccounts.accountId, accounts.id))
        .where(and(
          eq(agentAccounts.agentId, input.id),
          eq(agentAccounts.isActive, 1)
        ));

      // Get knowledge count
      const knowledgeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentKnowledge)
        .where(and(
          eq(agentKnowledge.agentId, input.id),
          eq(agentKnowledge.isActive, 1)
        ));

      // Get rules count
      const rulesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentRules)
        .where(and(
          eq(agentRules.agentId, input.id),
          eq(agentRules.isActive, 1)
        ));

      // Get recent execution logs
      const recentLogs = await db
        .select()
        .from(agentExecutionLogs)
        .where(eq(agentExecutionLogs.agentId, input.id))
        .orderBy(desc(agentExecutionLogs.createdAt))
        .limit(10);
      
      return {
        ...agent[0],
        linkedAccounts,
        knowledgeCount: Number(knowledgeCount[0]?.count || 0),
        rulesCount: Number(rulesCount[0]?.count || 0),
        recentLogs,
      };
    }),

  // Create new agent
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        theme: z.string().min(1, "Theme is required"),
        tone: z.enum(["formal", "casual", "friendly", "professional", "humorous"]).optional(),
        style: z.enum(["ranking", "trivia", "story", "tutorial", "news", "review"]).optional(),
        targetAudience: z.string().optional(),
        description: z.string().optional(),
        projectId: z.number().optional(),
        postingFrequency: z.enum(["daily", "twice_daily", "three_times_daily", "weekly", "custom"]).optional(),
        postingTimeSlots: z.array(z.string()).optional(),
        skipReview: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [newAgent] = await db
        .insert(agents)
        .values({
          userId: ctx.user.id,
          name: input.name,
          theme: input.theme,
          tone: input.tone || "casual",
          style: input.style || "story",
          targetAudience: input.targetAudience || null,
          description: input.description || null,
          projectId: input.projectId || null,
          postingFrequency: input.postingFrequency || "daily",
          postingTimeSlots: input.postingTimeSlots ? JSON.stringify(input.postingTimeSlots) : JSON.stringify(["09:00"]),
          skipReview: input.skipReview ? 1 : 0,
        })
        .$returningId();

      return newAgent;
    }),

  // Update agent
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1, "Name is required").optional(),
        theme: z.string().optional(),
        tone: z.enum(["formal", "casual", "friendly", "professional", "humorous"]).optional(),
        style: z.enum(["ranking", "trivia", "story", "tutorial", "news", "review"]).optional(),
        targetAudience: z.string().optional(),
        description: z.string().optional(),
        projectId: z.number().optional(),
        postingFrequency: z.enum(["daily", "twice_daily", "three_times_daily", "weekly", "custom"]).optional(),
        postingTimeSlots: z.array(z.string()).optional(),
        skipReview: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const { id, ...updateData } = input;
      // Remove undefined values and handle postingTimeSlots
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          if (key === "postingTimeSlots") {
            cleanedData[key] = JSON.stringify(value);
          } else {
            cleanedData[key] = value;
          }
        }
      }
      
      if (Object.keys(cleanedData).length > 0) {
        await db.update(agents).set(cleanedData).where(eq(agents.id, id));
      }

      return { success: true };
    }),

  // Delete agent
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      await db.delete(agents).where(eq(agents.id, input.id));

      return { success: true };
    }),

  // ============================================
  // Account Linking
  // ============================================

  // Link account to agent
  linkAccount: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      accountId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      // Verify account ownership
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);
      
      if (account.length === 0 || account[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Account not found" });
      }

      // Check if link already exists
      const existing = await db
        .select()
        .from(agentAccounts)
        .where(and(
          eq(agentAccounts.agentId, input.agentId),
          eq(agentAccounts.accountId, input.accountId)
        ));
      
      if (existing.length > 0) {
        // Reactivate if inactive
        await db
          .update(agentAccounts)
          .set({ isActive: 1, updatedAt: new Date().toISOString() })
          .where(eq(agentAccounts.id, existing[0].id));
        return { success: true, id: existing[0].id };
      }

      const [result] = await db.insert(agentAccounts).values({
        agentId: input.agentId,
        accountId: input.accountId,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  // Unlink account from agent
  unlinkAccount: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      accountId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      await db
        .update(agentAccounts)
        .set({ isActive: 0, updatedAt: new Date().toISOString() })
        .where(and(
          eq(agentAccounts.agentId, input.agentId),
          eq(agentAccounts.accountId, input.accountId)
        ));

      return { success: true };
    }),

  // Get linked accounts
  getLinkedAccounts: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      return await db
        .select({
          id: agentAccounts.id,
          accountId: agentAccounts.accountId,
          isActive: agentAccounts.isActive,
          account: accounts,
        })
        .from(agentAccounts)
        .leftJoin(accounts, eq(agentAccounts.accountId, accounts.id))
        .where(and(
          eq(agentAccounts.agentId, input.agentId),
          eq(agentAccounts.isActive, 1)
        ));
    }),

  // ============================================
  // Knowledge Management
  // ============================================

  // Get agent knowledge
  getKnowledge: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      type: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      let query = db
        .select()
        .from(agentKnowledge)
        .where(and(
          eq(agentKnowledge.agentId, input.agentId),
          eq(agentKnowledge.isActive, 1)
        ))
        .orderBy(desc(agentKnowledge.confidence));

      if (input.type) {
        query = db
          .select()
          .from(agentKnowledge)
          .where(and(
            eq(agentKnowledge.agentId, input.agentId),
            eq(agentKnowledge.knowledgeType, input.type as any),
            eq(agentKnowledge.isActive, 1)
          ))
          .orderBy(desc(agentKnowledge.confidence));
      }

      return await query;
    }),

  // Add knowledge
  addKnowledge: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      knowledgeType: z.enum([
        "success_pattern",
        "failure_pattern",
        "content_template",
        "hashtag_strategy",
        "timing_insight",
        "audience_insight",
        "engagement_tactic",
        "general"
      ]),
      title: z.string().min(1),
      content: z.string().min(1),
      confidence: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const [result] = await db.insert(agentKnowledge).values({
        agentId: input.agentId,
        knowledgeType: input.knowledgeType,
        title: input.title,
        content: input.content,
        confidence: input.confidence || 50,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  // Update knowledge
  updateKnowledge: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      confidence: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          cleanedData[key] = value;
        }
      }

      if (Object.keys(cleanedData).length > 0) {
        await db.update(agentKnowledge)
          .set({ ...cleanedData, updatedAt: new Date().toISOString() })
          .where(eq(agentKnowledge.id, id));
      }

      return { success: true };
    }),

  // Delete knowledge (soft delete)
  deleteKnowledge: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.update(agentKnowledge)
        .set({ isActive: 0, updatedAt: new Date().toISOString() })
        .where(eq(agentKnowledge.id, input.id));

      return { success: true };
    }),

  // ============================================
  // Rules Management
  // ============================================

  // Get agent rules
  getRules: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      type: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      let query = db
        .select()
        .from(agentRules)
        .where(and(
          eq(agentRules.agentId, input.agentId),
          eq(agentRules.isActive, 1)
        ))
        .orderBy(desc(agentRules.priority));

      if (input.type) {
        query = db
          .select()
          .from(agentRules)
          .where(and(
            eq(agentRules.agentId, input.agentId),
            eq(agentRules.ruleType, input.type as any),
            eq(agentRules.isActive, 1)
          ))
          .orderBy(desc(agentRules.priority));
      }

      return await query;
    }),

  // Add rule
  addRule: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      ruleType: z.enum([
        "forbidden_word",
        "required_element",
        "content_limit",
        "posting_limit",
        "time_restriction",
        "platform_specific",
        "tone_guideline",
        "custom"
      ]),
      ruleName: z.string().min(1),
      ruleValue: z.string().min(1),
      priority: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const [result] = await db.insert(agentRules).values({
        agentId: input.agentId,
        ruleType: input.ruleType,
        ruleName: input.ruleName,
        ruleValue: input.ruleValue,
        priority: input.priority || 50,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  // Update rule
  updateRule: protectedProcedure
    .input(z.object({
      id: z.number(),
      ruleName: z.string().optional(),
      ruleValue: z.string().optional(),
      priority: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          cleanedData[key] = value;
        }
      }

      if (Object.keys(cleanedData).length > 0) {
        await db.update(agentRules)
          .set({ ...cleanedData, updatedAt: new Date().toISOString() })
          .where(eq(agentRules.id, id));
      }

      return { success: true };
    }),

  // Delete rule (soft delete)
  deleteRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.update(agentRules)
        .set({ isActive: 0, updatedAt: new Date().toISOString() })
        .where(eq(agentRules.id, input.id));

      return { success: true };
    }),

  // ============================================
  // Agent Execution
  // ============================================

  // Run agent manually
  run: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      accountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const result = await runAgent(input.agentId, input.accountId);
      return result;
    }),

  // Get execution logs
  getExecutionLogs: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      limit: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      return await db
        .select()
        .from(agentExecutionLogs)
        .where(eq(agentExecutionLogs.agentId, input.agentId))
        .orderBy(desc(agentExecutionLogs.createdAt))
        .limit(input.limit || 50);
    }),

  // ============================================
  // Learning & Optimization
  // ============================================

  // Analyze post performance and extract learnings
  analyzePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      await analyzePostPerformance(input.postId);
      return { success: true };
    }),

  // Consolidate knowledge (find patterns)
  consolidate: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      
      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      await consolidateKnowledge(input.agentId);
      return { success: true };
    }),

  // ============================================
  // AI-powered agent generation
  // ============================================

  generateAgents: protectedProcedure
    .input(
      z.object({
        count: z.number().min(1).max(20),
        industry: z.string().optional(),
        targetPlatforms: z.array(z.enum(["twitter", "instagram", "facebook", "tiktok"])).optional(),
        projectId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { count, industry, targetPlatforms, projectId } = input;

      // Build AI prompt
      const platformsText = targetPlatforms?.length 
        ? `for ${targetPlatforms.join(", ")} platforms` 
        : "for various social media platforms";
      const industryText = industry ? `in the ${industry} industry` : "across different industries";

      const prompt = `Generate ${count} unique SNS agent personas ${industryText} ${platformsText}.

For each agent, provide:
1. name: A catchy, memorable name for the persona
2. theme: The main topic/theme they focus on
3. tone: Choose from [formal, casual, friendly, professional, humorous]
4. style: Choose from [ranking, trivia, story, tutorial, news, review]
5. targetAudience: Description of their target audience
6. description: A brief description of the persona's characteristics
7. postingFrequency: Choose from [daily, twice_daily, three_times_daily, weekly]
8. postingTimeSlots: Array of 1-3 time slots in HH:MM format (e.g., ["09:00", "15:00", "21:00"])

Make each persona unique and engaging. Consider different niches, demographics, and content strategies.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert in social media marketing and content strategy." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_personas",
            strict: true,
            schema: {
              type: "object",
              properties: {
                agents: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      theme: { type: "string" },
                      tone: { type: "string", enum: ["formal", "casual", "friendly", "professional", "humorous"] },
                      style: { type: "string", enum: ["ranking", "trivia", "story", "tutorial", "news", "review"] },
                      targetAudience: { type: "string" },
                      description: { type: "string" },
                      postingFrequency: { type: "string", enum: ["daily", "twice_daily", "three_times_daily", "weekly"] },
                      postingTimeSlots: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["name", "theme", "tone", "style", "targetAudience", "description", "postingFrequency", "postingTimeSlots"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["agents"],
              additionalProperties: false,
            },
          },
        },
      });

      if (!response.choices || response.choices.length === 0) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "No response from AI" });
      }
      
      const content = response.choices[0].message.content;
      if (!content || typeof content !== "string") {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "Failed to generate agents: empty or invalid response" });
      }

      const generatedData = JSON.parse(content);
      const generatedAgents = generatedData.agents;

      // Insert all generated agents into database
      const insertedAgents = [];
      for (const agent of generatedAgents) {
        const [newAgent] = await db
          .insert(agents)
          .values({
            userId: ctx.user.id,
            projectId: projectId || null,
            name: agent.name,
            theme: agent.theme,
            tone: agent.tone as any,
            style: agent.style as any,
            targetAudience: agent.targetAudience,
            description: agent.description,
            postingFrequency: agent.postingFrequency as any,
            postingTimeSlots: JSON.stringify(agent.postingTimeSlots),
            isActive: 1,
          })
          .$returningId();
        
        insertedAgents.push(newAgent);
      }

      return {
        success: true,
        count: insertedAgents.length,
        agents: insertedAgents,
      };
    }),

  // Update agent schedule
  updateSchedule: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        postingFrequency: z.enum(["daily", "twice_daily", "three_times_daily", "weekly", "custom"]).optional(),
        postingTimeSlots: z.array(z.string()).optional(), // Array of time strings like ["09:00", "15:00"]
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const updateData: any = {};
      if (input.postingFrequency !== undefined) {
        updateData.postingFrequency = input.postingFrequency;
      }
      if (input.postingTimeSlots !== undefined) {
        updateData.postingTimeSlots = JSON.stringify(input.postingTimeSlots);
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive ? 1 : 0;
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(agents).set(updateData).where(eq(agents.id, input.id));
      }

      return { success: true };
    }),

  // ============================================
  // Auto-Optimization Settings
  // ============================================

  // Get auto-optimization settings for an agent
  getAutoOptimizationSettings: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const agentData = agent[0] as any;
      if (agentData.autoOptimizationSettings) {
        try {
          const parsed = JSON.parse(agentData.autoOptimizationSettings);
          return { ...DEFAULT_AUTO_OPTIMIZATION_SETTINGS, ...parsed };
        } catch (e) {
          return DEFAULT_AUTO_OPTIMIZATION_SETTINGS;
        }
      }

      return DEFAULT_AUTO_OPTIMIZATION_SETTINGS;
    }),

  // Update auto-optimization settings
  updateAutoOptimizationSettings: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      settings: z.object({
        enabled: z.boolean().optional(),
        minEngagementRateThreshold: z.number().min(0).max(100).optional(),
        checkIntervalHours: z.number().min(1).max(168).optional(),
        maxAutoOptimizationsPerWeek: z.number().min(0).max(20).optional(),
        requireConfirmation: z.boolean().optional(),
        optimizationTypes: z.array(z.enum([
          'tone_adjustment',
          'style_adjustment',
          'content_strategy',
          'timing_optimization'
        ])).optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      // Get current settings and merge with new ones
      const agentData = agent[0] as any;
      let currentSettings: AutoOptimizationSettings = DEFAULT_AUTO_OPTIMIZATION_SETTINGS;
      if (agentData.autoOptimizationSettings) {
        try {
          currentSettings = {
            ...DEFAULT_AUTO_OPTIMIZATION_SETTINGS,
            ...JSON.parse(agentData.autoOptimizationSettings),
          };
        } catch (e) {}
      }

      const newSettings: AutoOptimizationSettings = {
        ...currentSettings,
        ...input.settings,
      };

      await db.update(agents)
        .set({
          autoOptimizationSettings: JSON.stringify(newSettings),
          updatedAt: new Date().toISOString(),
        } as any)
        .where(eq(agents.id, input.agentId));

      return { success: true, settings: newSettings };
    }),

  // Manually trigger optimization check
  triggerOptimization: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      const result = await triggerOptimizationCheck(input.agentId);
      return result;
    }),

  // Get pending optimizations for an agent
  getPendingOptimizations: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      return await getPendingOptimizations(input.agentId);
    }),

  // Approve a pending optimization
  approveOptimization: protectedProcedure
    .input(z.object({ optimizationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership via the optimization record
      const optimization = await db.query.aiOptimizations.findFirst({
        where: eq(aiOptimizations.id, input.optimizationId),
      });

      if (!optimization) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Optimization not found" });
      }

      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, optimization.agentId!))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      await approveOptimization(input.optimizationId);
      return { success: true };
    }),

  // Reject a pending optimization
  rejectOptimization: protectedProcedure
    .input(z.object({ optimizationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership via the optimization record
      const optimization = await db.query.aiOptimizations.findFirst({
        where: eq(aiOptimizations.id, input.optimizationId),
      });

      if (!optimization) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Optimization not found" });
      }

      // Verify agent ownership
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, optimization.agentId!))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      await rejectOptimization(input.optimizationId);
      return { success: true };
    }),

  // Get optimization history for an agent
  getOptimizationHistory: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      limit: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (agent.length === 0 || agent[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Agent not found" });
      }

      return await db.query.aiOptimizations.findMany({
        where: eq(aiOptimizations.agentId, input.agentId),
        orderBy: [desc(aiOptimizations.createdAt)],
        limit: input.limit || 20,
      });
    }),
});
