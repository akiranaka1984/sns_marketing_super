import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import type { BuzzLearningInput, ModelPatternInput } from "./aiEngine";
import { encrypt, decrypt, ensureEncrypted } from "./utils/encryption";

const connection = mysql.createPool(process.env.DATABASE_URL!);
export const db = drizzle(connection, { schema, mode: "default" });

/** Format Date to MySQL-compatible datetime string */
function toMySQLDatetime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * User operations
 */
export async function getUserByOpenId(openId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.openId, openId));
  return user;
}

export async function createUser(data: schema.InsertUser) {
  const [result] = await db.insert(schema.users).values(data);
  return result;
}

export async function updateUserLastSignedIn(openId: string) {
  await db.update(schema.users).set({ lastSignedIn: toMySQLDatetime() }).where(eq(schema.users.openId, openId));
}

export async function upsertUser(data: schema.InsertUser) {
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await updateUserLastSignedIn(data.openId);
    return existing;
  }
  const result = await createUser(data);
  return await getUserByOpenId(data.openId);
}

/**
 * Project operations
 */
export async function getAllProjects(userId: number) {
  return await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .orderBy(desc(schema.projects.createdAt));
}

export async function getProjectById(projectId: number, userId: number) {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
  return project;
}

export async function createProject(data: schema.InsertProject) {
  const [result] = await db.insert(schema.projects).values(data);
  return result.insertId;
}

export async function updateProject(projectId: number, userId: number, data: Partial<schema.InsertProject>) {
  await db
    .update(schema.projects)
    .set(data)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
}

/**
 * Update skipReview flag for all agents in a project
 * Called when project execution mode changes
 */
export async function updateAgentsSkipReview(projectId: number, skipReview: number) {
  await db
    .update(schema.agents)
    .set({ skipReview })
    .where(eq(schema.agents.projectId, projectId));
}

/**
 * Update reviewStatus for pending scheduled posts in a project
 * Called when project execution mode changes to fullAuto to auto-approve existing posts
 */
export async function updatePendingPostsReviewStatus(
  projectId: number,
  reviewStatus: 'approved' | 'pending_review'
) {
  await db
    .update(schema.scheduledPosts)
    .set({ reviewStatus, updatedAt: new Date().toISOString() })
    .where(and(
      eq(schema.scheduledPosts.projectId, projectId),
      eq(schema.scheduledPosts.status, 'pending'),
      inArray(schema.scheduledPosts.reviewStatus, ['draft', 'pending_review'])
    ));
}

export async function deleteProject(projectId: number, userId: number) {
  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
}

/**
 * Project-Account operations
 */
export async function getProjectAccounts(projectId: number) {
  return await db
    .select({
      id: schema.projectAccounts.id,
      projectId: schema.projectAccounts.projectId,
      accountId: schema.projectAccounts.accountId,
      personaRole: schema.projectAccounts.personaRole,
      personaTone: schema.projectAccounts.personaTone,
      personaCharacteristics: schema.projectAccounts.personaCharacteristics,
      isActive: schema.projectAccounts.isActive,
      account: schema.accounts,
    })
    .from(schema.projectAccounts)
    .leftJoin(schema.accounts, eq(schema.projectAccounts.accountId, schema.accounts.id))
    .where(eq(schema.projectAccounts.projectId, projectId));
}

export async function addAccountToProject(data: schema.InsertProjectAccount) {
  const [result] = await db.insert(schema.projectAccounts).values(data);
  return result.insertId;
}

export async function removeAccountFromProject(projectAccountId: number) {
  await db.delete(schema.projectAccounts).where(eq(schema.projectAccounts.id, projectAccountId));
}

export async function updateProjectAccountPersona(
  projectAccountId: number,
  data: Partial<schema.InsertProjectAccount>
) {
  await db
    .update(schema.projectAccounts)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.projectAccounts.id, projectAccountId));
}

/**
 * Account operations
 */
export async function getAllAccounts(userId: number) {
  return await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
}

export async function getAccountsByUserId(userId: number) {
  return await db
    .select({
      id: schema.accounts.id,
      userId: schema.accounts.userId,
      platform: schema.accounts.platform,
      username: schema.accounts.username,
      password: schema.accounts.password,
      xHandle: schema.accounts.xHandle,
      status: schema.accounts.status,
      deviceId: schema.accounts.deviceId,
      proxyId: schema.accounts.proxyId,
      lastLoginAt: schema.accounts.lastLoginAt,
      createdAt: schema.accounts.createdAt,
      updatedAt: schema.accounts.updatedAt,
      proxy: schema.proxies,
    })
    .from(schema.accounts)
    .leftJoin(schema.proxies, eq(schema.accounts.proxyId, schema.proxies.id))
    .where(eq(schema.accounts.userId, userId));
}

export async function getAccountById(accountId: number) {
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId));
  return account;
}

/**
 * Get an account's decrypted password
 */
export function getDecryptedPassword(account: { password: string | null }): string | null {
  if (!account.password) return null;
  return decrypt(account.password);
}

export async function getAccountByUsernameAndPlatform(
  username: string,
  platform: 'twitter' | 'tiktok' | 'instagram' | 'facebook',
  userId?: number
) {
  const conditions = [
    eq(schema.accounts.username, username),
    eq(schema.accounts.platform, platform)
  ];
  
  // If userId is provided, only check within that user's accounts
  if (userId !== undefined) {
    conditions.push(eq(schema.accounts.userId, userId));
  }
  
  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(and(...conditions));
  return account;
}

export async function createAccount(data: schema.InsertAccount) {
  const securedData = { ...data };
  if (securedData.password) {
    securedData.password = ensureEncrypted(securedData.password);
  }
  const [result] = await db.insert(schema.accounts).values(securedData);
  return result.insertId;
}

export async function updateAccount(accountId: number, data: Partial<schema.InsertAccount>) {
  const securedData = { ...data };
  if (securedData.password) {
    securedData.password = ensureEncrypted(securedData.password);
  }
  await db
    .update(schema.accounts)
    .set({ ...securedData, updatedAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, accountId));
}

export async function updateAccountStatus(accountId: number, status: 'pending' | 'active' | 'suspended' | 'failed', deviceId?: string) {
  const updateData: any = { status, updatedAt: new Date().toISOString() };
  if (status === 'active') {
    updateData.lastLoginAt = new Date().toISOString();
    if (deviceId) {
      updateData.deviceId = deviceId;
    }
  }
  await db.update(schema.accounts).set(updateData).where(eq(schema.accounts.id, accountId));
}

export async function updateAccountDeviceId(accountId: number, deviceId: string | null) {
  await db
    .update(schema.accounts)
    .set({ deviceId, updatedAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, accountId));
}

export async function deleteAccount(accountId: number) {
  await db.delete(schema.accounts).where(eq(schema.accounts.id, accountId));
}

export async function getAccountsByDeviceId(deviceId: string) {
  return await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.deviceId, deviceId))
    .orderBy(schema.accounts.platform);
}

export async function getDeviceAccountCounts(userId: number) {
  const accounts = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
  
  const deviceCounts: Record<string, { total: number; platforms: string[] }> = {};
  
  for (const account of accounts) {
    if (account.deviceId) {
      if (!deviceCounts[account.deviceId]) {
        deviceCounts[account.deviceId] = { total: 0, platforms: [] };
      }
      deviceCounts[account.deviceId].total++;
      if (!deviceCounts[account.deviceId].platforms.includes(account.platform)) {
        deviceCounts[account.deviceId].platforms.push(account.platform);
      }
    }
  }
  
  return deviceCounts;
}

/**
 * Strategy operations
 */
export async function getAllStrategies(userId: number) {
  return await db
    .select()
    .from(schema.strategies)
    .where(eq(schema.strategies.userId, userId))
    .orderBy(desc(schema.strategies.createdAt));
}

export async function getStrategiesByUserId(userId: number) {
  return await getAllStrategies(userId);
}

export async function getStrategiesByProject(projectId: number) {
  return await db
    .select()
    .from(schema.strategies)
    .where(eq(schema.strategies.projectId, projectId))
    .orderBy(desc(schema.strategies.createdAt));
}

export async function getStrategyById(strategyId: number) {
  const [strategy] = await db.select().from(schema.strategies).where(eq(schema.strategies.id, strategyId));
  return strategy;
}

export async function createStrategy(data: schema.InsertStrategy) {
  const [result] = await db.insert(schema.strategies).values(data);
  return result.insertId;
}

export async function updateStrategy(strategyId: number, data: Partial<schema.InsertStrategy>) {
  await db
    .update(schema.strategies)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.strategies.id, strategyId));
}

export async function deleteStrategy(strategyId: number) {
  await db.delete(schema.strategies).where(eq(schema.strategies.id, strategyId));
}

export async function linkStrategyToProject(strategyId: number, projectId: number) {
  await db
    .update(schema.strategies)
    .set({ projectId, updatedAt: new Date().toISOString() })
    .where(eq(schema.strategies.id, strategyId));
}

/**
 * Post operations
 */
export async function getPostsByProject(projectId: number) {
  return await db
    .select()
    .from(schema.scheduledPosts)
    .where(eq(schema.scheduledPosts.projectId, projectId))
    .orderBy(desc(schema.scheduledPosts.scheduledTime));
}

export async function getPostsByAccount(accountId: number) {
  return await db
    .select()
    .from(schema.scheduledPosts)
    .where(eq(schema.scheduledPosts.accountId, accountId))
    .orderBy(desc(schema.scheduledPosts.scheduledTime));
}

export async function getPostById(postId: number) {
  const [post] = await db.select().from(schema.scheduledPosts).where(eq(schema.scheduledPosts.id, postId));
  return post;
}

export async function createPost(data: schema.InsertScheduledPost) {
  const [result] = await db.insert(schema.scheduledPosts).values(data);
  return result.insertId;
}

export async function updatePost(postId: number, data: Partial<schema.InsertScheduledPost>) {
  await db
    .update(schema.scheduledPosts)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.scheduledPosts.id, postId));
}

export async function deletePost(postId: number) {
  await db.delete(schema.scheduledPosts).where(eq(schema.scheduledPosts.id, postId));
}

/**
 * Device operations
 */
export async function getAllDevices() {
  return await db.select().from(schema.devices);
}

export async function getAvailableDevice() {
  const [device] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.status, 'available'))
    .limit(1);
  return device;
}

export async function updateDeviceStatus(deviceId: string, status: 'available' | 'busy' | 'offline') {
  await db
    .update(schema.devices)
    .set({ status, lastUsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(schema.devices.deviceId, deviceId));
}

export async function getDeviceById(deviceId: string) {
  const [device] = await db.select().from(schema.devices).where(eq(schema.devices.deviceId, deviceId));
  return device;
}

export async function createDevice(data: schema.InsertDevice) {
  const [result] = await db.insert(schema.devices).values(data);
  return result;
}

export async function updateDevice(deviceId: string, data: Partial<schema.InsertDevice>) {
  await db
    .update(schema.devices)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.devices.deviceId, deviceId));
}

/**
 * Log operations
 */
export async function createLog(data: schema.InsertLog) {
  const [result] = await db.insert(schema.logs).values(data);
  return result;
}

export async function getLogsByAccountId(accountId: number) {
  return await getLogsByAccount(accountId);
}

export async function getRecentLogs(limit: number = 100) {
  return await db.select().from(schema.logs).orderBy(desc(schema.logs.createdAt)).limit(limit);
}

export async function getLogsByAccount(accountId: number) {
  return await db
    .select()
    .from(schema.logs)
    .where(eq(schema.logs.accountId, accountId))
    .orderBy(desc(schema.logs.createdAt));
}

/**
 * Analytics operations
 */
export async function getAnalyticsByAccount(accountId: number, limit?: number) {
  const query = db
    .select()
    .from(schema.analytics)
    .where(eq(schema.analytics.accountId, accountId))
    .orderBy(desc(schema.analytics.recordedAt));
  
  if (limit) {
    return await query.limit(limit);
  }
  return await query;
}

export async function getLatestAnalytics() {
  // Get the latest analytics for each account
  return await db.select().from(schema.analytics).orderBy(desc(schema.analytics.recordedAt)).limit(100);
}

export async function getAnalyticsSummary(accountId: number) {
  const analytics = await getAnalyticsByAccount(accountId, 30);
  if (analytics.length === 0) {
    return null;
  }
  
  const latest = analytics[0];
  const oldest = analytics[analytics.length - 1];
  
  return {
    current: latest,
    growth: {
      followers: latest.followersCount - oldest.followersCount,
      engagement: latest.engagementRate - oldest.engagementRate,
    },
  };
}

export async function createAnalytics(data: schema.InsertAnalytics) {
  const [result] = await db.insert(schema.analytics).values(data);
  return result;
}

/**
 * Settings operations - System-wide key-value configuration
 */
const SENSITIVE_SETTING_KEYS = new Set([
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'X_API_BEARER_TOKEN', 'X_API_KEY', 'X_API_SECRET',
]);

export async function getSetting(key: string): Promise<string | null> {
  const [setting] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  const value = setting?.value || null;
  if (value && SENSITIVE_SETTING_KEYS.has(key)) {
    return decrypt(value);
  }
  return value;
}

export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  const storedValue = SENSITIVE_SETTING_KEYS.has(key) ? ensureEncrypted(value) : value;
  const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key));

  if (existing.length > 0) {
    await db
      .update(schema.settings)
      .set({ value: storedValue, description, updatedAt: new Date().toISOString() })
      .where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, value: storedValue, description });
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await db.select().from(schema.settings);
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value || '';
    return acc;
  }, {} as Record<string, string>);
}


/**
 * Agent operations
 */
export async function getAgentsByUserId(userId: number) {
  return await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.userId, userId))
    .orderBy(desc(schema.agents.createdAt));
}

export async function getAgentById(agentId: number) {
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
  return agent;
}

export async function createAgent(data: schema.InsertAgent) {
  const [result] = await db.insert(schema.agents).values(data);
  return result.insertId;
}

export async function updateAgent(agentId: number, data: Partial<schema.InsertAgent>) {
  await db
    .update(schema.agents)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.agents.id, agentId));
}

export async function deleteAgent(agentId: number) {
  await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
}

/**
 * Agent Knowledge operations
 */
export async function getAgentKnowledge(agentId: number, type?: string) {
  if (type) {
    return await db
      .select()
      .from(schema.agentKnowledge)
      .where(and(
        eq(schema.agentKnowledge.agentId, agentId),
        eq(schema.agentKnowledge.knowledgeType, type as any),
        eq(schema.agentKnowledge.isActive, 1)
      ))
      .orderBy(desc(schema.agentKnowledge.confidence));
  }
  return await db
    .select()
    .from(schema.agentKnowledge)
    .where(and(
      eq(schema.agentKnowledge.agentId, agentId),
      eq(schema.agentKnowledge.isActive, 1)
    ))
    .orderBy(desc(schema.agentKnowledge.confidence));
}

export async function createAgentKnowledge(data: schema.InsertAgentKnowledge) {
  const [result] = await db.insert(schema.agentKnowledge).values(data);
  return result.insertId;
}

export async function updateAgentKnowledge(knowledgeId: number, data: Partial<schema.InsertAgentKnowledge>) {
  await db
    .update(schema.agentKnowledge)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.agentKnowledge.id, knowledgeId));
}

export async function deleteAgentKnowledge(knowledgeId: number) {
  await db
    .update(schema.agentKnowledge)
    .set({ isActive: 0, updatedAt: new Date().toISOString() })
    .where(eq(schema.agentKnowledge.id, knowledgeId));
}

/**
 * Agent Rules operations
 */
export async function getAgentRules(agentId: number, type?: string) {
  if (type) {
    return await db
      .select()
      .from(schema.agentRules)
      .where(and(
        eq(schema.agentRules.agentId, agentId),
        eq(schema.agentRules.ruleType, type as any),
        eq(schema.agentRules.isActive, 1)
      ))
      .orderBy(desc(schema.agentRules.priority));
  }
  return await db
    .select()
    .from(schema.agentRules)
    .where(and(
      eq(schema.agentRules.agentId, agentId),
      eq(schema.agentRules.isActive, 1)
    ))
    .orderBy(desc(schema.agentRules.priority));
}

export async function createAgentRule(data: schema.InsertAgentRule) {
  const [result] = await db.insert(schema.agentRules).values(data);
  return result.insertId;
}

export async function updateAgentRule(ruleId: number, data: Partial<schema.InsertAgentRule>) {
  await db
    .update(schema.agentRules)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.agentRules.id, ruleId));
}

export async function deleteAgentRule(ruleId: number) {
  await db
    .update(schema.agentRules)
    .set({ isActive: 0, updatedAt: new Date().toISOString() })
    .where(eq(schema.agentRules.id, ruleId));
}

/**
 * Agent Accounts operations
 */
export async function getAgentAccounts(agentId: number) {
  return await db
    .select({
      id: schema.agentAccounts.id,
      agentId: schema.agentAccounts.agentId,
      accountId: schema.agentAccounts.accountId,
      isActive: schema.agentAccounts.isActive,
      account: schema.accounts,
    })
    .from(schema.agentAccounts)
    .leftJoin(schema.accounts, eq(schema.agentAccounts.accountId, schema.accounts.id))
    .where(and(
      eq(schema.agentAccounts.agentId, agentId),
      eq(schema.agentAccounts.isActive, 1)
    ));
}

export async function linkAgentToAccount(agentId: number, accountId: number) {
  // Check if link already exists
  const existing = await db
    .select()
    .from(schema.agentAccounts)
    .where(and(
      eq(schema.agentAccounts.agentId, agentId),
      eq(schema.agentAccounts.accountId, accountId)
    ));
  
  if (existing.length > 0) {
    // Reactivate if inactive
    await db
      .update(schema.agentAccounts)
      .set({ isActive: 1, updatedAt: new Date().toISOString() })
      .where(eq(schema.agentAccounts.id, existing[0].id));
    return existing[0].id;
  }
  
  const [result] = await db.insert(schema.agentAccounts).values({
    agentId,
    accountId,
    isActive: 1,
  });
  return result.insertId;
}

export async function unlinkAgentFromAccount(agentId: number, accountId: number) {
  await db
    .update(schema.agentAccounts)
    .set({ isActive: 0, updatedAt: new Date().toISOString() })
    .where(and(
      eq(schema.agentAccounts.agentId, agentId),
      eq(schema.agentAccounts.accountId, accountId)
    ));
}

/**
 * Agent Execution Logs operations
 */
export async function getAgentExecutionLogs(agentId: number, limit: number = 50) {
  return await db
    .select()
    .from(schema.agentExecutionLogs)
    .where(eq(schema.agentExecutionLogs.agentId, agentId))
    .orderBy(desc(schema.agentExecutionLogs.createdAt))
    .limit(limit);
}

export async function createAgentExecutionLog(data: schema.InsertAgentExecutionLog) {
  const [result] = await db.insert(schema.agentExecutionLogs).values(data);
  return result.insertId;
}

/**
 * Agent Schedules operations
 */
export async function getAgentSchedules(agentId: number) {
  return await db
    .select()
    .from(schema.agentSchedules)
    .where(and(
      eq(schema.agentSchedules.agentId, agentId),
      eq(schema.agentSchedules.isActive, 1)
    ))
    .orderBy(schema.agentSchedules.timeSlot);
}

export async function createAgentSchedule(data: schema.InsertAgentSchedule) {
  const [result] = await db.insert(schema.agentSchedules).values(data);
  return result.insertId;
}

export async function updateAgentSchedule(scheduleId: number, data: Partial<schema.InsertAgentSchedule>) {
  await db
    .update(schema.agentSchedules)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.agentSchedules.id, scheduleId));
}

export async function deleteAgentSchedule(scheduleId: number) {
  await db
    .update(schema.agentSchedules)
    .set({ isActive: 0, updatedAt: new Date().toISOString() })
    .where(eq(schema.agentSchedules.id, scheduleId));
}

export async function getActiveAgentSchedules() {
  return await db
    .select({
      schedule: schema.agentSchedules,
      agent: schema.agents,
    })
    .from(schema.agentSchedules)
    .innerJoin(schema.agents, eq(schema.agentSchedules.agentId, schema.agents.id))
    .where(and(
      eq(schema.agentSchedules.isActive, 1),
      eq(schema.agents.isActive, 1)
    ));
}

/**
 * Post Performance Feedback operations
 */
export async function getPostPerformanceFeedback(postId: number) {
  const [feedback] = await db
    .select()
    .from(schema.postPerformanceFeedback)
    .where(eq(schema.postPerformanceFeedback.postId, postId));
  return feedback;
}

export async function createPostPerformanceFeedback(data: schema.InsertPostPerformanceFeedback) {
  const [result] = await db.insert(schema.postPerformanceFeedback).values(data);
  return result.insertId;
}

export async function updatePostPerformanceFeedback(feedbackId: number, data: Partial<schema.InsertPostPerformanceFeedback>) {
  await db
    .update(schema.postPerformanceFeedback)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.postPerformanceFeedback.id, feedbackId));
}

export async function getUnprocessedFeedback(limit: number = 100) {
  return await db
    .select()
    .from(schema.postPerformanceFeedback)
    .where(eq(schema.postPerformanceFeedback.isProcessed, 0))
    .orderBy(schema.postPerformanceFeedback.createdAt)
    .limit(limit);
}

/**
 * Account Persona operations
 */
export async function updateAccountPersona(
  accountId: number,
  data: {
    personaRole?: string | null;
    personaTone?: 'formal' | 'casual' | 'friendly' | 'professional' | 'humorous' | null;
    personaCharacteristics?: string | null;
  }
) {
  await db
    .update(schema.accounts)
    .set({
      personaRole: data.personaRole,
      personaTone: data.personaTone,
      personaCharacteristics: data.personaCharacteristics,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.accounts.id, accountId));
}

/**
 * Account-Model Account Link operations
 */
export async function getLinkedModelAccountsForAccount(accountId: number) {
  const links = await db
    .select({
      link: schema.accountModelAccounts,
      modelAccount: schema.modelAccounts,
    })
    .from(schema.accountModelAccounts)
    .innerJoin(
      schema.modelAccounts,
      eq(schema.accountModelAccounts.modelAccountId, schema.modelAccounts.id)
    )
    .where(eq(schema.accountModelAccounts.accountId, accountId));

  return links.map(row => ({
    ...row.link,
    modelAccount: row.modelAccount,
  }));
}

export async function linkModelAccountToAccount(
  accountId: number,
  modelAccountId: number,
  autoApplyLearnings: boolean = false
) {
  // Check if link already exists
  const [existing] = await db
    .select()
    .from(schema.accountModelAccounts)
    .where(
      and(
        eq(schema.accountModelAccounts.accountId, accountId),
        eq(schema.accountModelAccounts.modelAccountId, modelAccountId)
      )
    );

  if (existing) {
    // Update existing link
    await db
      .update(schema.accountModelAccounts)
      .set({
        autoApplyLearnings: autoApplyLearnings ? 1 : 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.accountModelAccounts.id, existing.id));
  } else {
    // Create new link
    await db.insert(schema.accountModelAccounts).values({
      accountId,
      modelAccountId,
      autoApplyLearnings: autoApplyLearnings ? 1 : 0,
    });
  }
}

export async function unlinkModelAccountFromAccount(
  accountId: number,
  modelAccountId: number
) {
  await db
    .delete(schema.accountModelAccounts)
    .where(
      and(
        eq(schema.accountModelAccounts.accountId, accountId),
        eq(schema.accountModelAccounts.modelAccountId, modelAccountId)
      )
    );
}

export async function updateAccountModelAccountLink(
  accountId: number,
  modelAccountId: number,
  data: { autoApplyLearnings: boolean }
) {
  await db
    .update(schema.accountModelAccounts)
    .set({
      autoApplyLearnings: data.autoApplyLearnings ? 1 : 0,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.accountModelAccounts.accountId, accountId),
        eq(schema.accountModelAccounts.modelAccountId, modelAccountId)
      )
    );
}

/**
 * Buzz Learning operations for strategy generation
 * First tries to get project-specific learnings, falls back to user-level learnings
 */
export async function getBuzzLearningsForProject(
  projectId: number,
  userId: number,
  options: { minConfidence?: number; limit?: number } = {}
): Promise<BuzzLearningInput[]> {
  const { minConfidence = 50, limit = 10 } = options;

  // First try project-specific learnings
  const projectConditions = [
    eq(schema.buzzLearnings.userId, userId),
    eq(schema.buzzLearnings.projectId, projectId),
    eq(schema.buzzLearnings.isActive, 1),
    gte(schema.buzzLearnings.confidence, minConfidence),
  ];

  let learnings = await db
    .select({
      id: schema.buzzLearnings.id,
      learningType: schema.buzzLearnings.learningType,
      title: schema.buzzLearnings.title,
      description: schema.buzzLearnings.description,
      patternData: schema.buzzLearnings.patternData,
      confidence: schema.buzzLearnings.confidence,
    })
    .from(schema.buzzLearnings)
    .where(and(...projectConditions))
    .orderBy(desc(schema.buzzLearnings.confidence))
    .limit(limit);

  // If no project-specific learnings, fall back to user-level learnings (projectId is NULL)
  if (learnings.length === 0) {
    const userConditions = [
      eq(schema.buzzLearnings.userId, userId),
      sql`${schema.buzzLearnings.projectId} IS NULL`,
      eq(schema.buzzLearnings.isActive, 1),
      gte(schema.buzzLearnings.confidence, minConfidence),
    ];

    learnings = await db
      .select({
        id: schema.buzzLearnings.id,
        learningType: schema.buzzLearnings.learningType,
        title: schema.buzzLearnings.title,
        description: schema.buzzLearnings.description,
        patternData: schema.buzzLearnings.patternData,
        confidence: schema.buzzLearnings.confidence,
      })
      .from(schema.buzzLearnings)
      .where(and(...userConditions))
      .orderBy(desc(schema.buzzLearnings.confidence))
      .limit(limit);
  }

  return learnings.map(l => ({
    id: l.id,
    learningType: l.learningType || 'general',
    title: l.title,
    description: l.description,
    patternData: l.patternData ? JSON.parse(l.patternData) : undefined,
    confidence: l.confidence,
  }));
}

/**
 * Model Pattern operations for strategy generation
 */
export async function getModelPatternsForProject(
  projectId: number,
  options: { limit?: number } = {}
): Promise<ModelPatternInput[]> {
  const { limit: maxLimit = 5 } = options;

  // Get model account IDs linked to this project via projectModelAccounts
  const projectModelLinks = await db
    .select({
      modelAccountId: schema.projectModelAccounts.modelAccountId,
    })
    .from(schema.projectModelAccounts)
    .where(eq(schema.projectModelAccounts.projectId, projectId))
    .limit(maxLimit);

  if (projectModelLinks.length === 0) {
    return [];
  }

  const modelAccountIds = projectModelLinks.map(l => l.modelAccountId);

  // Get behavior patterns for those model accounts
  const patterns = await db
    .select()
    .from(schema.modelAccountBehaviorPatterns)
    .where(inArray(schema.modelAccountBehaviorPatterns.modelAccountId, modelAccountIds));

  return patterns.map(p => ({
    modelAccountId: p.modelAccountId,
    avgPostsPerDay: Number(p.avgPostsPerDay) || 0,
    peakPostingHours: p.peakPostingHours ? JSON.parse(p.peakPostingHours) : [],
    avgEngagementRate: Number(p.avgEngagementRate) || 0,
    bestEngagementHours: p.bestEngagementHours ? JSON.parse(p.bestEngagementHours) : [],
    avgContentLength: p.avgContentLength || 0,
    emojiUsageRate: Number(p.emojiUsageRate) || 0,
    hashtagAvgCount: Number(p.hashtagAvgCount) || 0,
  }));
}
