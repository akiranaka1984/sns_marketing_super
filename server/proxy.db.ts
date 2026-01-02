import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

const connection = mysql.createPool(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema, mode: "default" });
import { proxies, accounts } from "../drizzle/schema";
import type { InsertProxy, Proxy } from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Get all proxies
 */
export async function getAllProxies(): Promise<Proxy[]> {
  return await db.select().from(proxies);
}

/**
 * Get available (unassigned) proxies
 */
export async function getAvailableProxies(): Promise<Proxy[]> {
  return await db
    .select()
    .from(proxies)
    .where(eq(proxies.status, "available"));
}

/**
 * Get proxy by ID
 */
export async function getProxyById(id: number): Promise<Proxy | null> {
  const results = await db
    .select()
    .from(proxies)
    .where(eq(proxies.id, id))
    .limit(1);
  return results[0] || null;
}

/**
 * Create a new proxy
 */
export async function createProxy(proxy: InsertProxy): Promise<Proxy> {
  const [newProxy] = await db.insert(proxies).values(proxy);
  return await getProxyById(newProxy.insertId) as Proxy;
}

/**
 * Bulk create proxies
 */
export async function bulkCreateProxies(proxyList: InsertProxy[]): Promise<number> {
  if (proxyList.length === 0) return 0;
  
  await db.insert(proxies).values(proxyList);
  return proxyList.length;
}

/**
 * Update proxy DuoPlus ID
 */
export async function updateProxyDuoPlusId(proxyId: number, duoplusProxyId: string): Promise<void> {
  await db
    .update(proxies)
    .set({ duoplusProxyId })
    .where(eq(proxies.id, proxyId));
}

/**
 * Assign proxy to account
 */
export async function assignProxyToAccount(proxyId: number, accountId: number): Promise<void> {
  // Update proxy status and assignment
  await db
    .update(proxies)
    .set({
      status: "assigned",
      assignedAccountId: accountId,
      lastUsedAt: new Date(),
    })
    .where(eq(proxies.id, proxyId));

  // Update account with proxy ID
  await db
    .update(accounts)
    .set({ proxyId })
    .where(eq(accounts.id, accountId));
}

/**
 * Unassign proxy from account
 */
export async function unassignProxyFromAccount(accountId: number): Promise<void> {
  // Get account's current proxy
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account || !account.proxyId) return;

  // Update proxy status to available
  await db
    .update(proxies)
    .set({
      status: "available",
      assignedAccountId: null,
    })
    .where(eq(proxies.id, account.proxyId));

  // Remove proxy ID from account
  await db
    .update(accounts)
    .set({ proxyId: null })
    .where(eq(accounts.id, accountId));
}

/**
 * Delete proxy by ID
 */
export async function deleteProxy(id: number): Promise<void> {
  // First, unassign from any account
  const proxy = await getProxyById(id);
  if (proxy && proxy.assignedAccountId) {
    await unassignProxyFromAccount(proxy.assignedAccountId);
  }

  // Then delete the proxy
  await db.delete(proxies).where(eq(proxies.id, id));
}

/**
 * Get accounts without proxy
 */
export async function getAccountsWithoutProxy(userId: number): Promise<any[]> {
  return await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        isNull(accounts.proxyId)
      )
    );
}

/**
 * Parse CSV line to proxy object
 * Format: host:port:username:password
 */
export function parseProxyLine(line: string): InsertProxy | null {
  const parts = line.trim().split(':');
  if (parts.length !== 4) return null;

  const [host, portStr, username, password] = parts;
  const port = parseInt(portStr, 10);

  if (!host || isNaN(port) || !username || !password) return null;

  return {
    host,
    port,
    username,
    password,
    status: "available",
  };
}

/**
 * Parse CSV content to proxy list
 */
export function parseProxyCSV(csvContent: string): InsertProxy[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const proxies: InsertProxy[] = [];

  for (const line of lines) {
    const proxy = parseProxyLine(line);
    if (proxy) {
      proxies.push(proxy);
    }
  }

  return proxies;
}
