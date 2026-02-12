/**
 * Network Orchestrator Service
 * Cross-account strategic orchestration for coordinated SNS amplification.
 *
 * Manages account roles, generates amplification plans with randomized timing,
 * creates natural multi-turn conversation threads via LLM, and executes
 * orchestration plans by scheduling interactions.
 */

import { db } from "../db";
import { eq, and, inArray, ne, isNotNull } from "drizzle-orm";
import {
  accountRoles,
  orchestrationPlans,
  accounts,
  interactions,
  postUrls,
  interactionSettings,
  accountRelationships,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountRole = "main" | "amplifier" | "engagement" | "support";

export interface RoleAssignment {
  accountId: number;
  role: AccountRole;
}

export interface PlannedAction {
  accountId: number;
  actionType: "like" | "comment" | "retweet";
  delayMinutes: number;
  content?: string;
}

export interface ConversationTurn {
  accountId: number;
  comment: string;
  delayMinutes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[NetworkOrchestrator]";

/** Return a random integer between `min` and `max` (inclusive). */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// 1. Account Role Management
// ---------------------------------------------------------------------------

/**
 * Assign roles to accounts within a project.
 * Existing role records for the given accounts are updated; new ones are created.
 */
export async function assignAccountRoles(
  projectId: number,
  assignments: RoleAssignment[],
): Promise<void> {
  console.log(
    `${LOG_PREFIX} Assigning ${assignments.length} roles for project ${projectId}`,
  );

  for (const { accountId, role } of assignments) {
    // Check if a role record already exists for this project + account pair
    const [existing] = await db
      .select()
      .from(accountRoles)
      .where(
        and(
          eq(accountRoles.projectId, projectId),
          eq(accountRoles.accountId, accountId),
        ),
      );

    if (existing) {
      await db
        .update(accountRoles)
        .set({ role, isActive: 1, updatedAt: new Date() })
        .where(eq(accountRoles.id, existing.id));
    } else {
      await db.insert(accountRoles).values({
        projectId,
        accountId,
        role,
        priority: role === "main" ? 100 : role === "amplifier" ? 75 : role === "engagement" ? 50 : 25,
        isActive: 1,
      });
    }
  }

  console.log(`${LOG_PREFIX} Role assignment complete for project ${projectId}`);
}

/**
 * Retrieve all active role assignments for a project.
 */
export async function getProjectRoles(projectId: number) {
  const roles = await db
    .select({
      id: accountRoles.id,
      projectId: accountRoles.projectId,
      accountId: accountRoles.accountId,
      role: accountRoles.role,
      priority: accountRoles.priority,
      isActive: accountRoles.isActive,
      config: accountRoles.config,
      createdAt: accountRoles.createdAt,
      updatedAt: accountRoles.updatedAt,
    })
    .from(accountRoles)
    .where(
      and(
        eq(accountRoles.projectId, projectId),
        eq(accountRoles.isActive, 1),
      ),
    );

  console.log(
    `${LOG_PREFIX} Found ${roles.length} active roles for project ${projectId}`,
  );
  return roles;
}

// ---------------------------------------------------------------------------
// 2. Orchestration Plan Generation
// ---------------------------------------------------------------------------

/**
 * Generate a full amplification plan for a newly published post.
 *
 * Flow:
 *   1. Main account posts (time 0).
 *   2. 15-60 min later: amplifier accounts retweet + comment.
 *   3. 30-120 min later: engagement accounts create conversation threads.
 *
 * Timing within each window is randomised for a natural appearance.
 */
export async function generateAmplificationPlan(
  projectId: number,
  triggerPostId: number,
  postUrl: string,
  postContent: string,
): Promise<number> {
  console.log(
    `${LOG_PREFIX} Generating amplification plan for project ${projectId}, post ${triggerPostId}`,
  );

  // Fetch role assignments grouped by role
  const roles = await getProjectRoles(projectId);

  const mainAccounts = roles.filter((r) => r.role === "main");
  const amplifierAccounts = roles.filter((r) => r.role === "amplifier");
  const engagementAccounts = roles.filter((r) => r.role === "engagement");
  const supportAccounts = roles.filter((r) => r.role === "support");

  // Gather account IDs that need persona information
  const allAccountIds = roles.map((r) => r.accountId);
  let accountMap = new Map<number, typeof accounts.$inferSelect>();

  if (allAccountIds.length > 0) {
    const accountRows = await db
      .select()
      .from(accounts)
      .where(inArray(accounts.id, allAccountIds));
    for (const acc of accountRows) {
      accountMap.set(acc.id, acc);
    }
  }

  // Fetch interaction settings for the project (for custom delay ranges)
  const [settings] = await db
    .select()
    .from(interactionSettings)
    .where(eq(interactionSettings.projectId, projectId));

  const actions: PlannedAction[] = [];

  // --- Amplifier wave (15-60 min after post) ---------------------------------
  for (const amp of amplifierAccounts) {
    // Retweet
    actions.push({
      accountId: amp.accountId,
      actionType: "retweet",
      delayMinutes: randomBetween(15, 60),
    });

    // Comment from the amplifier
    const account = accountMap.get(amp.accountId);
    const persona = account?.persona || account?.personaCharacteristics || "フレンドリーなユーザー";
    const tone = account?.personaTone || "casual";

    actions.push({
      accountId: amp.accountId,
      actionType: "comment",
      delayMinutes: randomBetween(15, 60),
      content: await generateSingleComment(postContent, persona, tone),
    });
  }

  // --- Engagement wave (30-120 min after post) --------------------------------
  for (const eng of engagementAccounts) {
    // Like
    actions.push({
      accountId: eng.accountId,
      actionType: "like",
      delayMinutes: randomBetween(30, 90),
    });

    // Comment
    const account = accountMap.get(eng.accountId);
    const persona = account?.persona || account?.personaCharacteristics || "一般ユーザー";
    const tone = account?.personaTone || "casual";

    actions.push({
      accountId: eng.accountId,
      actionType: "comment",
      delayMinutes: randomBetween(30, 120),
      content: await generateSingleComment(postContent, persona, tone),
    });
  }

  // --- Support wave (likes only, spread across 15-120 min) --------------------
  for (const sup of supportAccounts) {
    actions.push({
      accountId: sup.accountId,
      actionType: "like",
      delayMinutes: randomBetween(15, 120),
    });
  }

  // Sort actions by delay so they execute in chronological order
  actions.sort((a, b) => a.delayMinutes - b.delayMinutes);

  // Persist the plan
  const [result] = await db.insert(orchestrationPlans).values({
    projectId,
    triggerPostId,
    triggerPostUrl: postUrl,
    planType: "amplification",
    status: "planned",
    actions: JSON.stringify(actions),
    totalActions: actions.length,
    completedActions: 0,
    failedActions: 0,
  });

  const planId = result.insertId;

  console.log(
    `${LOG_PREFIX} Amplification plan ${planId} created with ${actions.length} actions ` +
      `(amplifiers: ${amplifierAccounts.length}, engagement: ${engagementAccounts.length}, ` +
      `support: ${supportAccounts.length})`,
  );

  return planId;
}

// ---------------------------------------------------------------------------
// 3. Conversation Thread Generation
// ---------------------------------------------------------------------------

/**
 * Use LLM to generate a natural multi-turn conversation between 2-3 accounts
 * about a given post.
 */
export async function generateConversationThread(
  projectId: number,
  postContent: string,
  participantAccountIds: number[],
): Promise<ConversationTurn[]> {
  console.log(
    `${LOG_PREFIX} Generating conversation thread for project ${projectId} ` +
      `with ${participantAccountIds.length} participants`,
  );

  if (participantAccountIds.length < 2) {
    console.warn(`${LOG_PREFIX} Need at least 2 participants for a conversation`);
    return [];
  }

  // Limit to 3 participants at most
  const limitedIds = participantAccountIds.slice(0, 3);

  // Fetch account details for persona information
  const participantAccounts = await db
    .select()
    .from(accounts)
    .where(inArray(accounts.id, limitedIds));

  if (participantAccounts.length < 2) {
    console.warn(`${LOG_PREFIX} Could not find enough participant accounts`);
    return [];
  }

  // Fetch relationships between participants for style cues
  const relationships = await db
    .select()
    .from(accountRelationships)
    .where(
      and(
        eq(accountRelationships.projectId, projectId),
        inArray(accountRelationships.fromAccountId, limitedIds),
        inArray(accountRelationships.toAccountId, limitedIds),
        eq(accountRelationships.isActive, 1),
      ),
    );

  // Build participant descriptions for the prompt
  const participantDescriptions = participantAccounts.map((acc) => {
    const role = acc.personaRole || "一般ユーザー";
    const tone = acc.personaTone || "casual";
    const characteristics = acc.personaCharacteristics || "特になし";
    return `- @${acc.username} (ID: ${acc.id}): 役割=${role}, トーン=${tone}, 特徴=${characteristics}`;
  });

  // Build relationship context
  let relationshipContext = "";
  if (relationships.length > 0) {
    const relDescriptions = relationships.map((rel) => {
      const fromAcc = participantAccounts.find((a) => a.id === rel.fromAccountId);
      const toAcc = participantAccounts.find((a) => a.id === rel.toAccountId);
      return `  @${fromAcc?.username || rel.fromAccountId} → @${toAcc?.username || rel.toAccountId}: ` +
        `関係=${rel.relationshipType}, 親密度=${rel.intimacyLevel}/100, ` +
        `コメントスタイル=${rel.commentStyle || "neutral"}`;
    });
    relationshipContext = `\n\n参加者間の関係:\n${relDescriptions.join("\n")}`;
  }

  const systemPrompt =
    `あなたはSNS（X/Twitter）上での自然な会話を生成するAIです。\n` +
    `以下の参加者が、ある投稿について自然な会話をします。\n` +
    `各参加者のペルソナ・トーンに合わせたコメントを生成してください。\n\n` +
    `ルール:\n` +
    `- 各コメントは140文字以内\n` +
    `- 会話は3〜5ターン\n` +
    `- 自然で人間らしい会話にする\n` +
    `- 宣伝っぽくならないようにする\n` +
    `- 各参加者の個性・トーンを反映する\n` +
    `- 参加者間の関係性を反映する（ある場合）\n\n` +
    `参加者:\n${participantDescriptions.join("\n")}` +
    relationshipContext;

  const userPrompt =
    `以下の投稿について自然な会話を生成してください。\n\n` +
    `投稿内容:\n"${postContent}"\n\n` +
    `以下のJSON形式で返してください（他のテキストは含めないでください）:\n` +
    `[{"accountId": <number>, "comment": "<text>", "delayMinutes": <number>}]\n\n` +
    `delayMinutesは最初のコメントを0として、前のコメントからの間隔（1〜5分）にしてください。`;

  try {
    const llmResult = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      responseFormat: { type: "json_object" },
    });

    const responseText =
      typeof llmResult.choices[0]?.message?.content === "string"
        ? llmResult.choices[0].message.content
        : "";

    // Parse the response – the LLM may wrap the array inside an object key
    let parsed: ConversationTurn[];
    try {
      const raw = JSON.parse(responseText);
      if (Array.isArray(raw)) {
        parsed = raw;
      } else if (raw.conversation && Array.isArray(raw.conversation)) {
        parsed = raw.conversation;
      } else if (raw.comments && Array.isArray(raw.comments)) {
        parsed = raw.comments;
      } else if (raw.turns && Array.isArray(raw.turns)) {
        parsed = raw.turns;
      } else {
        // Try to find any array value in the response object
        const arrValue = Object.values(raw).find((v) => Array.isArray(v)) as ConversationTurn[] | undefined;
        parsed = arrValue || [];
      }
    } catch {
      console.error(`${LOG_PREFIX} Failed to parse LLM conversation response: ${responseText}`);
      return [];
    }

    // Validate and normalise parsed turns
    const validTurns: ConversationTurn[] = [];
    const validAccountIds = new Set(limitedIds);

    let cumulativeDelay = 0;
    for (const turn of parsed) {
      if (!turn.accountId || !turn.comment) continue;
      if (!validAccountIds.has(turn.accountId)) continue;

      const delayFromPrevious = typeof turn.delayMinutes === "number" ? turn.delayMinutes : randomBetween(1, 5);
      cumulativeDelay += delayFromPrevious;

      validTurns.push({
        accountId: turn.accountId,
        comment: String(turn.comment).slice(0, 280),
        delayMinutes: cumulativeDelay,
      });
    }

    console.log(
      `${LOG_PREFIX} Generated ${validTurns.length} conversation turns for project ${projectId}`,
    );

    return validTurns;
  } catch (error: any) {
    console.error(
      `${LOG_PREFIX} LLM conversation generation failed: ${error.message}`,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// 4. Plan Execution
// ---------------------------------------------------------------------------

/**
 * Execute a previously generated orchestration plan.
 *
 * Reads the plan actions and creates `interactions` records with the
 * appropriate scheduled times. Updates the plan status to "in_progress".
 */
export async function executeOrchestrationPlan(planId: number): Promise<void> {
  console.log(`${LOG_PREFIX} Executing orchestration plan ${planId}`);

  // Load the plan
  const [plan] = await db
    .select()
    .from(orchestrationPlans)
    .where(eq(orchestrationPlans.id, planId));

  if (!plan) {
    console.error(`${LOG_PREFIX} Plan ${planId} not found`);
    return;
  }

  if (plan.status !== "planned") {
    console.warn(
      `${LOG_PREFIX} Plan ${planId} is in status "${plan.status}", expected "planned". Skipping.`,
    );
    return;
  }

  // Parse actions
  let actions: PlannedAction[];
  try {
    actions = JSON.parse(plan.actions) as PlannedAction[];
  } catch {
    console.error(`${LOG_PREFIX} Failed to parse plan actions for plan ${planId}`);
    await db
      .update(orchestrationPlans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));
    return;
  }

  if (actions.length === 0) {
    console.warn(`${LOG_PREFIX} Plan ${planId} has no actions`);
    await db
      .update(orchestrationPlans)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));
    return;
  }

  // Gather account IDs to look up deviceIds
  const accountIds = [...new Set(actions.map((a) => a.accountId))];
  const accountRows = await db
    .select()
    .from(accounts)
    .where(inArray(accounts.id, accountIds));

  const accountDeviceMap = new Map<number, string>();
  for (const acc of accountRows) {
    if (acc.deviceId) {
      accountDeviceMap.set(acc.id, acc.deviceId);
    }
  }

  // Find the postUrl record for the trigger post
  let postUrlId: number | null = null;
  if (plan.triggerPostUrl) {
    const [postUrlRow] = await db
      .select()
      .from(postUrls)
      .where(eq(postUrls.postUrl, plan.triggerPostUrl));
    if (postUrlRow) {
      postUrlId = postUrlRow.id;
    }
  }

  // Mark plan as in progress
  const now = new Date();
  await db
    .update(orchestrationPlans)
    .set({ status: "in_progress", startedAt: now, updatedAt: now })
    .where(eq(orchestrationPlans.id, planId));

  // Create interaction records for each action
  let createdCount = 0;
  let skippedCount = 0;

  for (const action of actions) {
    const deviceId = accountDeviceMap.get(action.accountId);
    if (!deviceId) {
      console.warn(
        `${LOG_PREFIX} No device found for account ${action.accountId}, skipping action`,
      );
      skippedCount++;
      continue;
    }

    const scheduledAt = new Date(now.getTime() + action.delayMinutes * 60 * 1000);

    await db.insert(interactions).values({
      postUrlId,
      fromAccountId: action.accountId,
      fromDeviceId: deviceId,
      interactionType: action.actionType,
      commentContent: action.content || null,
      status: "pending",
      scheduledAt: scheduledAt.toISOString().slice(0, 19).replace("T", " "),
      retryCount: 0,
      metadata: JSON.stringify({
        orchestrationPlanId: planId,
        source: "network_orchestrator",
      }),
    });

    createdCount++;
  }

  // Update plan counters – skipped actions count as failed
  if (skippedCount > 0) {
    await db
      .update(orchestrationPlans)
      .set({
        failedActions: skippedCount,
        updatedAt: new Date(),
      })
      .where(eq(orchestrationPlans.id, planId));
  }

  console.log(
    `${LOG_PREFIX} Plan ${planId} execution started: ${createdCount} interactions created, ` +
      `${skippedCount} skipped`,
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate a single comment using LLM given the post content, persona and tone.
 */
async function generateSingleComment(
  postContent: string,
  persona: string,
  tone: string,
): Promise<string> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            `あなたはSNSユーザーです。以下のペルソナに基づいてコメントを生成してください。\n` +
            `ペルソナ: ${persona}\n` +
            `トーン: ${tone}\n` +
            `ルール:\n` +
            `- 140文字以内\n` +
            `- 自然で人間らしいコメント\n` +
            `- 宣伝っぽくしない\n` +
            `- コメントのテキストのみ返してください`,
        },
        {
          role: "user",
          content: `以下の投稿に対するコメントを生成してください:\n\n"${postContent}"`,
        },
      ],
    });

    const content = result.choices[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    return text.trim().slice(0, 280);
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Failed to generate single comment: ${error.message}`);
    return "";
  }
}
