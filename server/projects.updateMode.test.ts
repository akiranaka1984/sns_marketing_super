/**
 * Test: projects.updateMode
 * 
 * プロジェクトの実行モード切替機能のテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './routers';
import { db } from './db';
import { projects, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('projects.updateMode', () => {
  let testUserId: number;
  let testProjectId: number;

  beforeEach(async () => {
    // テストユーザーを作成
    const [userResult] = await db.insert(users).values({
      openId: `test-user-${Date.now()}`,
      name: 'Test User',
      role: 'user',
    });
    testUserId = userResult.insertId;

    // テストプロジェクトを作成
    const [projectResult] = await db.insert(projects).values({
      userId: testUserId,
      name: 'Test Project',
      objective: 'Test Objective',
      status: 'active',
      executionMode: 'confirm', // デフォルトは確認モード
    });
    testProjectId = projectResult.insertId;
  });

  it('should update execution mode to fullAuto', async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: 'test', name: 'Test', role: 'user' },
    });

    const result = await caller.projects.updateMode({
      id: testProjectId,
      executionMode: 'fullAuto',
    });

    expect(result.success).toBe(true);

    // データベースを確認
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, testProjectId),
    });

    expect(project?.executionMode).toBe('fullAuto');
  });

  it('should update execution mode to manual', async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: 'test', name: 'Test', role: 'user' },
    });

    const result = await caller.projects.updateMode({
      id: testProjectId,
      executionMode: 'manual',
    });

    expect(result.success).toBe(true);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, testProjectId),
    });

    expect(project?.executionMode).toBe('manual');
  });

  it('should update execution mode to confirm', async () => {
    // まずfullAutoに変更
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: 'test', name: 'Test', role: 'user' },
    });

    await caller.projects.updateMode({
      id: testProjectId,
      executionMode: 'fullAuto',
    });

    // confirmに戻す
    const result = await caller.projects.updateMode({
      id: testProjectId,
      executionMode: 'confirm',
    });

    expect(result.success).toBe(true);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, testProjectId),
    });

    expect(project?.executionMode).toBe('confirm');
  });
});
