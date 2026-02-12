/**
 * Content Calendar Engine
 *
 * Strategic content calendar planning service.
 * Generates weekly calendars with balanced content types,
 * manages content type rotation, fills planned slots with
 * generated content, and analyzes content gaps.
 */

import { db } from "../db";
import {
  contentCalendar,
  projects,
  agents,
  agentAccounts,
  accounts,
  strategies,
  campaigns,
  scheduledPosts,
  posts,
  trackedTrends,
} from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql, count, between, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { generateContent, buildAgentContext } from "../agent-engine";

/** Convert Date to MySQL-compatible timestamp string */
function toMySQLTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// ============================================
// Types
// ============================================

/** Content type weights for calendar distribution */
const CONTENT_TYPE_WEIGHTS = {
  educational: 0.30,
  engagement: 0.25,
  promotional: 0.15,
  story: 0.20,
  reserved: 0.10,
} as const;

type PlannableContentType = keyof typeof CONTENT_TYPE_WEIGHTS;

/** Posting frequency to daily count mapping */
const FREQUENCY_TO_DAILY_COUNT: Record<string, number> = {
  daily: 1,
  twice_daily: 2,
  three_times_daily: 3,
  weekly: 0.14, // ~1 per week
  custom: 1,
};

/** Default time slots for posting */
const DEFAULT_TIME_SLOTS = ["09:00", "12:00", "18:00", "21:00"];

interface CalendarSlot {
  date: Date;
  timeSlot: string;
  contentType: PlannableContentType;
  topic: string | null;
}

interface GapAnalysisResult {
  totalDays: number;
  daysWithContent: number;
  daysWithoutContent: number;
  emptyDates: string[];
  typeDistribution: Record<string, number>;
  typeImbalances: Array<{
    type: string;
    actual: number;
    expected: number;
    deviation: number;
  }>;
  recommendations: string[];
}

interface DiversityReport {
  adjusted: boolean;
  changes: Array<{
    calendarId: number;
    from: string;
    to: string;
  }>;
  distribution: Record<string, number>;
}

// ============================================
// Calendar Generation
// ============================================

/**
 * Generate a weekly content calendar for a project.
 * Creates content slots with balanced content types based
 * on agent posting frequency and strategy.
 */
export async function generateWeeklyCalendar(
  projectId: number,
  weekStartDate: Date
): Promise<typeof contentCalendar.$inferSelect[]> {
  console.log(`[ContentCalendar] Generating weekly calendar for project ${projectId}, week starting ${weekStartDate.toISOString()}`);

  // Get project and strategy
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error(`[ContentCalendar] Project ${projectId} not found`);
  }

  const activeStrategy = await db.query.strategies.findFirst({
    where: and(
      eq(strategies.projectId, projectId),
      eq(strategies.isActive, 1)
    ),
    orderBy: desc(strategies.createdAt),
  });

  // Get agents linked to this project
  const projectAgents = await db.query.agents.findMany({
    where: and(
      eq(agents.projectId, projectId),
      eq(agents.isActive, 1)
    ),
  });

  if (projectAgents.length === 0) {
    throw new Error(`[ContentCalendar] No active agents found for project ${projectId}`);
  }

  // Get linked accounts through agent accounts
  const agentIds = projectAgents.map(a => a.id);
  const agentAccountLinks = await db
    .select()
    .from(agentAccounts)
    .where(and(
      inArray(agentAccounts.agentId, agentIds),
      eq(agentAccounts.isActive, 1)
    ));

  const accountIds = [...new Set(agentAccountLinks.map(l => l.accountId))];
  const linkedAccounts = accountIds.length > 0
    ? await db.query.accounts.findMany({
        where: inArray(accounts.id, accountIds),
      })
    : [];

  // Determine posting frequency from the first agent (primary agent)
  const primaryAgent = projectAgents[0];
  const postingFrequency = primaryAgent.postingFrequency || "daily";
  const dailyPostCount = FREQUENCY_TO_DAILY_COUNT[postingFrequency] || 1;

  // Parse custom time slots if available
  let timeSlots = DEFAULT_TIME_SLOTS;
  if (primaryAgent.postingTimeSlots) {
    try {
      const parsed = JSON.parse(primaryAgent.postingTimeSlots);
      if (Array.isArray(parsed) && parsed.length > 0) {
        timeSlots = parsed;
      }
    } catch {
      // Use defaults
    }
  }

  // Limit time slots based on daily count
  const postsPerDay = Math.max(1, Math.round(dailyPostCount));
  const selectedTimeSlots = timeSlots.slice(0, postsPerDay);

  // Calculate total slots for the week
  const totalSlots = postsPerDay * 7;

  // Generate topic suggestions via LLM
  const topics = await generateTopicSuggestions(
    project,
    activeStrategy,
    totalSlots
  );

  // Build content slots with balanced type distribution
  const slots: CalendarSlot[] = [];
  const typePool = buildTypePool(totalSlots);
  let topicIndex = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const slotDate = new Date(weekStartDate);
    slotDate.setDate(slotDate.getDate() + dayOffset);

    for (const timeSlot of selectedTimeSlots) {
      const contentType = typePool[slots.length] || "engagement";
      slots.push({
        date: slotDate,
        timeSlot,
        contentType,
        topic: topics[topicIndex] || null,
      });
      topicIndex++;
    }
  }

  // Determine default account and agent IDs
  const defaultAccountId = linkedAccounts.length > 0 ? linkedAccounts[0].id : null;
  const defaultAgentId = primaryAgent.id;

  // Save to database
  const insertValues = slots.map(slot => ({
    projectId,
    accountId: defaultAccountId,
    agentId: defaultAgentId,
    scheduledDate: toMySQLTimestamp(slot.date),
    timeSlot: slot.timeSlot,
    contentType: slot.contentType as typeof contentCalendar.$inferInsert["contentType"],
    topic: slot.topic,
    status: "planned" as const,
  }));

  if (insertValues.length > 0) {
    await db.insert(contentCalendar).values(insertValues);
  }

  // Retrieve the inserted entries
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const generated = await db.query.contentCalendar.findMany({
    where: and(
      eq(contentCalendar.projectId, projectId),
      gte(contentCalendar.scheduledDate, toMySQLTimestamp(weekStartDate)),
      lte(contentCalendar.scheduledDate, toMySQLTimestamp(weekEndDate))
    ),
    orderBy: [contentCalendar.scheduledDate, contentCalendar.timeSlot],
  });

  console.log(`[ContentCalendar] Generated ${generated.length} calendar slots for project ${projectId}`);
  return generated;
}

/**
 * Build a pool of content types distributed according to weights.
 * Shuffled to avoid long runs of the same type.
 */
function buildTypePool(totalSlots: number): PlannableContentType[] {
  const pool: PlannableContentType[] = [];
  const types = Object.keys(CONTENT_TYPE_WEIGHTS) as PlannableContentType[];

  // Allocate slots based on weights
  let remaining = totalSlots;
  const allocations: Record<string, number> = {};

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    if (i === types.length - 1) {
      // Last type gets remaining slots
      allocations[type] = remaining;
    } else {
      const count = Math.round(totalSlots * CONTENT_TYPE_WEIGHTS[type]);
      allocations[type] = count;
      remaining -= count;
    }
  }

  // Fill pool
  for (const type of types) {
    for (let i = 0; i < allocations[type]; i++) {
      pool.push(type);
    }
  }

  // Shuffle with constraint: no more than 2 consecutive same types
  return shuffleWithConstraint(pool, 2);
}

/**
 * Shuffle array ensuring no more than maxConsecutive identical adjacent items.
 */
function shuffleWithConstraint<T>(arr: T[], maxConsecutive: number): T[] {
  const result = [...arr];

  // Fisher-Yates shuffle first
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  // Fix consecutive violations
  for (let pass = 0; pass < 3; pass++) {
    for (let i = maxConsecutive; i < result.length; i++) {
      let consecutiveCount = 1;
      for (let k = 1; k <= maxConsecutive; k++) {
        if (result[i] === result[i - k]) {
          consecutiveCount++;
        } else {
          break;
        }
      }

      if (consecutiveCount > maxConsecutive) {
        // Find a swap candidate
        for (let j = i + 1; j < result.length; j++) {
          if (result[j] !== result[i]) {
            [result[i], result[j]] = [result[j], result[i]];
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Generate topic suggestions for calendar slots using LLM.
 */
async function generateTopicSuggestions(
  project: typeof projects.$inferSelect,
  strategy: typeof strategies.$inferSelect | undefined | null,
  slotCount: number
): Promise<string[]> {
  const strategyContext = strategy
    ? `\nStrategy: ${strategy.name || "Active strategy"}\nObjective: ${strategy.objective}\nDescription: ${strategy.description || ""}`
    : "";

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a strategic SNS content planner. Generate topic suggestions for a weekly content calendar. Output JSON only.`,
        },
        {
          role: "user",
          content: `Generate ${slotCount} topic suggestions for the following project's weekly content calendar.

Project: ${project.name}
Objective: ${project.objective}
${project.description ? `Description: ${project.description}` : ""}${strategyContext}

Content types to cover:
- Educational (30%): Teaching, tips, how-to, insights
- Engagement (25%): Questions, polls, discussions, community building
- Promotional (15%): Product/service highlights, offers, CTAs
- Story (20%): Behind-the-scenes, personal stories, case studies
- Reserved for trends (10%): Leave as generic trend-ready topics

Return JSON: {"topics": ["topic1", "topic2", ...]}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "topic_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              topics: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["topics"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(typeof messageContent === "string" ? messageContent : "{}");
    return result.topics || [];
  } catch (error) {
    console.error("[ContentCalendar] Failed to generate topic suggestions:", error);
    // Return empty topics on failure; slots will have null topics
    return [];
  }
}

// ============================================
// Content Type Rotation
// ============================================

/**
 * Get the recommended next content type for a project/account.
 * Ensures no more than 2 consecutive same-type posts.
 */
export async function getNextContentType(
  projectId: number,
  accountId?: number
): Promise<string> {
  console.log(`[ContentCalendar] Getting next content type for project ${projectId}${accountId ? `, account ${accountId}` : ""}`);

  // Get recent calendar slots
  const conditions = [eq(contentCalendar.projectId, projectId)];
  if (accountId) {
    conditions.push(eq(contentCalendar.accountId, accountId));
  }

  const recentSlots = await db.query.contentCalendar.findMany({
    where: and(...conditions),
    orderBy: [desc(contentCalendar.scheduledDate), desc(contentCalendar.timeSlot)],
    limit: 10,
  });

  // Get recent published posts
  const postConditions = [eq(posts.projectId, projectId)];
  if (accountId) {
    postConditions.push(eq(posts.accountId, accountId));
  }

  const recentPosts = await db.query.posts.findMany({
    where: and(...postConditions),
    orderBy: desc(posts.createdAt),
    limit: 10,
  });

  // Determine recent content types sequence
  const recentTypes: string[] = [];

  // From calendar slots first (they are forward-looking)
  for (const slot of recentSlots) {
    if (slot.contentType) {
      recentTypes.push(slot.contentType);
    }
  }

  // Check for 2 consecutive same types at the tail
  if (recentTypes.length >= 2 && recentTypes[0] === recentTypes[1]) {
    const lastType = recentTypes[0];
    // Choose a different type, weighted by distribution
    const types = Object.keys(CONTENT_TYPE_WEIGHTS) as PlannableContentType[];
    const available = types.filter(t => t !== lastType && t !== "reserved");

    // Pick based on weights
    const totalWeight = available.reduce((sum, t) => sum + CONTENT_TYPE_WEIGHTS[t], 0);
    let rand = Math.random() * totalWeight;
    for (const t of available) {
      rand -= CONTENT_TYPE_WEIGHTS[t];
      if (rand <= 0) {
        console.log(`[ContentCalendar] Recommended next type: ${t} (avoiding consecutive ${lastType})`);
        return t;
      }
    }
    return available[0];
  }

  // Otherwise pick based on overall weights
  const types = Object.keys(CONTENT_TYPE_WEIGHTS) as PlannableContentType[];
  const nonReserved = types.filter(t => t !== "reserved");
  const totalWeight = nonReserved.reduce((sum, t) => sum + CONTENT_TYPE_WEIGHTS[t], 0);
  let rand = Math.random() * totalWeight;
  for (const t of nonReserved) {
    rand -= CONTENT_TYPE_WEIGHTS[t];
    if (rand <= 0) {
      console.log(`[ContentCalendar] Recommended next type: ${t}`);
      return t;
    }
  }

  return "engagement";
}

/**
 * Ensure content type diversity in a week's calendar.
 * Rebalances if any type is significantly over/under-represented.
 */
export async function ensureDiversity(
  projectId: number,
  weekStartDate: Date
): Promise<DiversityReport> {
  console.log(`[ContentCalendar] Checking diversity for project ${projectId}, week ${weekStartDate.toISOString()}`);

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const weekSlots = await db.query.contentCalendar.findMany({
    where: and(
      eq(contentCalendar.projectId, projectId),
      gte(contentCalendar.scheduledDate, toMySQLTimestamp(weekStartDate)),
      lte(contentCalendar.scheduledDate, toMySQLTimestamp(weekEndDate))
    ),
  });

  if (weekSlots.length === 0) {
    return { adjusted: false, changes: [], distribution: {} };
  }

  // Count current distribution
  const distribution: Record<string, number> = {};
  for (const slot of weekSlots) {
    distribution[slot.contentType] = (distribution[slot.contentType] || 0) + 1;
  }

  const total = weekSlots.length;
  const changes: DiversityReport["changes"] = [];
  const tolerance = 0.15; // 15% tolerance

  // Check for over-represented types
  const types = Object.keys(CONTENT_TYPE_WEIGHTS) as PlannableContentType[];

  for (const type of types) {
    const actual = (distribution[type] || 0) / total;
    const expected = CONTENT_TYPE_WEIGHTS[type];
    const deviation = actual - expected;

    if (deviation > tolerance) {
      // Over-represented: convert some to under-represented types
      const excess = Math.floor(deviation * total);

      // Find under-represented types
      const underRepresented = types.filter(t => {
        const actualT = (distribution[t] || 0) / total;
        return actualT < CONTENT_TYPE_WEIGHTS[t] - tolerance / 2;
      });

      if (underRepresented.length > 0) {
        // Find slots of the over-represented type that are still 'planned'
        const overSlots = weekSlots.filter(
          s => s.contentType === type && s.status === "planned"
        );

        let converted = 0;
        for (const slot of overSlots) {
          if (converted >= excess) break;

          const targetType = underRepresented[converted % underRepresented.length];
          await db
            .update(contentCalendar)
            .set({ contentType: targetType })
            .where(eq(contentCalendar.id, slot.id));

          changes.push({
            calendarId: slot.id,
            from: type,
            to: targetType,
          });

          // Update local distribution
          distribution[type] = (distribution[type] || 0) - 1;
          distribution[targetType] = (distribution[targetType] || 0) + 1;
          converted++;
        }
      }
    }
  }

  const adjusted = changes.length > 0;
  if (adjusted) {
    console.log(`[ContentCalendar] Rebalanced ${changes.length} slots for diversity`);
  } else {
    console.log(`[ContentCalendar] Content distribution is balanced`);
  }

  return { adjusted, changes, distribution };
}

// ============================================
// Calendar Execution
// ============================================

/**
 * Fill a single calendar slot with generated content.
 * Builds agent context, generates content matching the slot's type,
 * creates a scheduledPost, and updates the calendar entry.
 */
export async function fillCalendarSlot(
  calendarId: number,
  agentId: number
): Promise<{ success: boolean; scheduledPostId?: number; error?: string }> {
  console.log(`[ContentCalendar] Filling calendar slot ${calendarId} with agent ${agentId}`);

  // Get the calendar entry
  const calendarEntry = await db.query.contentCalendar.findFirst({
    where: eq(contentCalendar.id, calendarId),
  });

  if (!calendarEntry) {
    return { success: false, error: "Calendar entry not found" };
  }

  if (calendarEntry.status !== "planned") {
    return { success: false, error: `Slot is not in 'planned' status (current: ${calendarEntry.status})` };
  }

  // Build agent context
  const agentContext = await buildAgentContext(agentId);
  if (!agentContext) {
    return { success: false, error: "Agent not found or context build failed" };
  }

  // Get account for the scheduled post
  const accountId = calendarEntry.accountId;
  if (!accountId) {
    // Fall back to the first account linked to the agent
    if (agentContext.accounts.length === 0) {
      return { success: false, error: "No account available for posting" };
    }
  }

  const targetAccountId = accountId || agentContext.accounts[0].id;

  // Generate content matching the slot's content type
  // We add content type guidance as additional context
  const contentTypeGuidance = getContentTypeGuidance(calendarEntry.contentType);
  const topicGuidance = calendarEntry.topic ? `\nTopic: ${calendarEntry.topic}` : "";

  // Temporarily augment agent context with content type direction
  // by adding it to the agent theme
  const originalTheme = agentContext.agent.theme;
  agentContext.agent = {
    ...agentContext.agent,
    theme: `${originalTheme}\n\n[Content Calendar Direction]\nContent Type: ${calendarEntry.contentType}\n${contentTypeGuidance}${topicGuidance}`,
  };

  try {
    const generated = await generateContent(
      agentContext,
      undefined,
      targetAccountId
    );

    // Restore original theme
    agentContext.agent.theme = originalTheme;

    // Build the scheduled time from the calendar entry
    const scheduledDate = new Date(calendarEntry.scheduledDate);
    if (calendarEntry.timeSlot) {
      const [hours, minutes] = calendarEntry.timeSlot.split(":").map(Number);
      scheduledDate.setHours(hours || 0, minutes || 0, 0, 0);
    }

    // Create a scheduled post
    const [insertResult] = await db.insert(scheduledPosts).values({
      projectId: calendarEntry.projectId,
      accountId: targetAccountId,
      agentId,
      content: generated.content,
      hashtags: JSON.stringify(generated.hashtags),
      scheduledTime: toMySQLTimestamp(scheduledDate),
      status: "pending",
      generatedByAgent: 1,
      reviewStatus: "pending_review",
      contentConfidence: generated.confidence,
      originalContent: generated.content,
    });

    const scheduledPostId = insertResult.insertId;

    // Update calendar entry
    await db
      .update(contentCalendar)
      .set({
        status: "content_generated",
        scheduledPostId,
      })
      .where(eq(contentCalendar.id, calendarId));

    console.log(`[ContentCalendar] Filled slot ${calendarId} with scheduledPost ${scheduledPostId}`);
    return { success: true, scheduledPostId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ContentCalendar] Failed to fill slot ${calendarId}:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fill all pending calendar slots within the next 48 hours.
 * Skips 'reserved' type slots (those are reserved for trend responses).
 */
export async function fillPendingSlots(
  projectId: number
): Promise<{ filled: number; failed: number; skipped: number }> {
  console.log(`[ContentCalendar] Filling pending slots for project ${projectId}`);

  const now = new Date();
  const cutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours from now

  // Get all 'planned' slots within the next 48 hours
  const pendingSlots = await db.query.contentCalendar.findMany({
    where: and(
      eq(contentCalendar.projectId, projectId),
      eq(contentCalendar.status, "planned"),
      gte(contentCalendar.scheduledDate, toMySQLTimestamp(now)),
      lte(contentCalendar.scheduledDate, toMySQLTimestamp(cutoff))
    ),
    orderBy: [contentCalendar.scheduledDate, contentCalendar.timeSlot],
  });

  let filled = 0;
  let failed = 0;
  let skipped = 0;

  for (const slot of pendingSlots) {
    // Skip reserved slots
    if (slot.contentType === "reserved") {
      skipped++;
      console.log(`[ContentCalendar] Skipping reserved slot ${slot.id}`);
      continue;
    }

    // Determine agent to use
    const agentId = slot.agentId;
    if (!agentId) {
      // Try to find a project agent
      const projectAgent = await db.query.agents.findFirst({
        where: and(
          eq(agents.projectId, projectId),
          eq(agents.isActive, 1)
        ),
      });

      if (!projectAgent) {
        console.error(`[ContentCalendar] No agent available for slot ${slot.id}`);
        failed++;
        continue;
      }

      const result = await fillCalendarSlot(slot.id, projectAgent.id);
      if (result.success) {
        filled++;
      } else {
        failed++;
      }
    } else {
      const result = await fillCalendarSlot(slot.id, agentId);
      if (result.success) {
        filled++;
      } else {
        failed++;
      }
    }
  }

  console.log(`[ContentCalendar] Fill results: ${filled} filled, ${failed} failed, ${skipped} skipped (reserved)`);
  return { filled, failed, skipped };
}

/**
 * Get content type guidance text for content generation.
 */
function getContentTypeGuidance(contentType: string): string {
  switch (contentType) {
    case "educational":
      return "Create educational content: tips, how-to guides, insights, data-driven analysis, or expert knowledge. Focus on providing value and teaching something useful.";
    case "engagement":
      return "Create engagement-driving content: ask questions, start discussions, create polls, request opinions, or share relatable observations. Focus on sparking conversation.";
    case "promotional":
      return "Create promotional content: highlight products/services, share offers, include clear calls-to-action, showcase results, or demonstrate value. Be persuasive but authentic.";
    case "story":
      return "Create storytelling content: behind-the-scenes glimpses, personal experiences, case studies, journey updates, or narrative-driven posts. Focus on emotional connection.";
    case "trend_response":
      return "Create trend-responsive content: react to current events, trending topics, or viral content. Make it timely and relevant while staying on-brand.";
    case "filler":
      return "Create light, easy-to-consume content: fun facts, quotes, throwbacks, or simple updates. Keep it casual and low-effort for the audience.";
    default:
      return "Create engaging, valuable content that resonates with the target audience.";
  }
}

// ============================================
// Gap Analysis
// ============================================

/**
 * Analyze content gaps for a project.
 * Checks for days with no planned content and content type imbalances.
 */
export async function analyzeContentGaps(
  projectId: number,
  days: number = 14
): Promise<GapAnalysisResult> {
  console.log(`[ContentCalendar] Analyzing content gaps for project ${projectId} over ${days} days`);

  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Get all calendar entries in the range
  const calendarEntries = await db.query.contentCalendar.findMany({
    where: and(
      eq(contentCalendar.projectId, projectId),
      gte(contentCalendar.scheduledDate, toMySQLTimestamp(now)),
      lte(contentCalendar.scheduledDate, toMySQLTimestamp(endDate))
    ),
    orderBy: contentCalendar.scheduledDate,
  });

  // Build a set of dates that have content
  const datesWithContent = new Set<string>();
  const typeDistribution: Record<string, number> = {};

  for (const entry of calendarEntries) {
    const dateStr = new Date(entry.scheduledDate).toISOString().split("T")[0];
    datesWithContent.add(dateStr);
    typeDistribution[entry.contentType] = (typeDistribution[entry.contentType] || 0) + 1;
  }

  // Find empty dates
  const emptyDates: string[] = [];
  for (let d = 0; d < days; d++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + d);
    const dateStr = checkDate.toISOString().split("T")[0];
    if (!datesWithContent.has(dateStr)) {
      emptyDates.push(dateStr);
    }
  }

  // Analyze type imbalances
  const total = calendarEntries.length;
  const typeImbalances: GapAnalysisResult["typeImbalances"] = [];
  const types = Object.keys(CONTENT_TYPE_WEIGHTS) as PlannableContentType[];

  if (total > 0) {
    for (const type of types) {
      const actual = (typeDistribution[type] || 0) / total;
      const expected = CONTENT_TYPE_WEIGHTS[type];
      const deviation = Math.abs(actual - expected);

      if (deviation > 0.1) {
        typeImbalances.push({
          type,
          actual: Math.round(actual * 100),
          expected: Math.round(expected * 100),
          deviation: Math.round(deviation * 100),
        });
      }
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (emptyDates.length > 0) {
    if (emptyDates.length > days * 0.5) {
      recommendations.push(
        `${emptyDates.length} days out of ${days} have no planned content. Consider generating a weekly calendar to fill these gaps.`
      );
    } else {
      recommendations.push(
        `${emptyDates.length} days have no planned content: ${emptyDates.slice(0, 5).join(", ")}${emptyDates.length > 5 ? "..." : ""}`
      );
    }
  }

  if (typeImbalances.length > 0) {
    for (const imbalance of typeImbalances) {
      if (imbalance.actual < imbalance.expected) {
        recommendations.push(
          `Content type "${imbalance.type}" is under-represented: ${imbalance.actual}% actual vs ${imbalance.expected}% expected. Add more ${imbalance.type} content.`
        );
      } else {
        recommendations.push(
          `Content type "${imbalance.type}" is over-represented: ${imbalance.actual}% actual vs ${imbalance.expected}% expected. Reduce ${imbalance.type} content.`
        );
      }
    }
  }

  if (calendarEntries.length === 0) {
    recommendations.push(
      "No content calendar entries found. Generate a weekly calendar to start planning."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Content calendar is well-balanced with good coverage.");
  }

  const result: GapAnalysisResult = {
    totalDays: days,
    daysWithContent: datesWithContent.size,
    daysWithoutContent: emptyDates.length,
    emptyDates,
    typeDistribution,
    typeImbalances,
    recommendations,
  };

  console.log(`[ContentCalendar] Gap analysis: ${result.daysWithContent}/${result.totalDays} days covered, ${typeImbalances.length} type imbalances`);
  return result;
}

// ============================================
// Calendar Management
// ============================================

/**
 * Get calendar entries for a project within a date range.
 */
export async function getCalendar(
  projectId: number,
  startDate: Date,
  endDate: Date
): Promise<typeof contentCalendar.$inferSelect[]> {
  console.log(`[ContentCalendar] Fetching calendar for project ${projectId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const entries = await db.query.contentCalendar.findMany({
    where: and(
      eq(contentCalendar.projectId, projectId),
      gte(contentCalendar.scheduledDate, toMySQLTimestamp(startDate)),
      lte(contentCalendar.scheduledDate, toMySQLTimestamp(endDate))
    ),
    orderBy: [contentCalendar.scheduledDate, contentCalendar.timeSlot],
  });

  console.log(`[ContentCalendar] Found ${entries.length} calendar entries`);
  return entries;
}

/**
 * Update a calendar slot's properties.
 */
export async function updateSlot(
  calendarId: number,
  updates: Partial<{
    contentType: typeof contentCalendar.$inferInsert["contentType"];
    topic: string | null;
    timeSlot: string;
    status: typeof contentCalendar.$inferInsert["status"];
    notes: string | null;
    accountId: number | null;
    agentId: number | null;
    campaignId: number | null;
  }>
): Promise<typeof contentCalendar.$inferSelect | null> {
  console.log(`[ContentCalendar] Updating calendar slot ${calendarId}`);

  await db
    .update(contentCalendar)
    .set(updates)
    .where(eq(contentCalendar.id, calendarId));

  const updated = await db.query.contentCalendar.findFirst({
    where: eq(contentCalendar.id, calendarId),
  });

  return updated || null;
}

/**
 * Convert a reserved calendar slot into a trend response.
 * Updates the slot's content type and links it to the detected trend.
 */
export async function markSlotAsTrendResponse(
  calendarId: number,
  trendId: number
): Promise<{ success: boolean; error?: string }> {
  console.log(`[ContentCalendar] Marking slot ${calendarId} as trend response for trend ${trendId}`);

  // Get the calendar entry
  const calendarEntry = await db.query.contentCalendar.findFirst({
    where: eq(contentCalendar.id, calendarId),
  });

  if (!calendarEntry) {
    return { success: false, error: "Calendar entry not found" };
  }

  if (calendarEntry.contentType !== "reserved" && calendarEntry.status !== "planned") {
    console.log(`[ContentCalendar] Slot ${calendarId} is not reserved/planned (type: ${calendarEntry.contentType}, status: ${calendarEntry.status}), converting anyway`);
  }

  // Get the trend
  const trend = await db.query.trackedTrends.findFirst({
    where: eq(trackedTrends.id, trendId),
  });

  if (!trend) {
    return { success: false, error: "Trend not found" };
  }

  // Update the calendar entry
  await db
    .update(contentCalendar)
    .set({
      contentType: "trend_response",
      topic: `Trend: ${trend.trendName}`,
      notes: JSON.stringify({
        trendId: trend.id,
        trendName: trend.trendName,
        trendType: trend.trendType,
        relevanceScore: trend.relevanceScore,
      }),
    })
    .where(eq(contentCalendar.id, calendarId));

  // Update trend status to 'responding'
  await db
    .update(trackedTrends)
    .set({ status: "responding" })
    .where(eq(trackedTrends.id, trendId));

  console.log(`[ContentCalendar] Slot ${calendarId} marked for trend "${trend.trendName}"`);
  return { success: true };
}
