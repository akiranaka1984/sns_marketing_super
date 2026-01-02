import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "./db";
import { interactionSettings, projects, strategies } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Interaction Settings", () => {
  let testProjectId: number;

  beforeAll(async () => {
    // テスト用プロジェクトを作成
    const [result] = await db.insert(projects).values({
      userId: 1,
      name: "Test Project for Interaction Settings",
      objective: "Test objective",
      status: "active",
    });
    testProjectId = Number(result.insertId);
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await db.delete(interactionSettings).where(eq(interactionSettings.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));
  });

  it("should create default interaction settings", async () => {
    // デフォルト設定を作成
    await db.insert(interactionSettings).values({
      projectId: testProjectId,
      isEnabled: false,
      likeEnabled: true,
      likeDelayMinMin: 5,
      likeDelayMinMax: 30,
      commentEnabled: true,
      commentDelayMinMin: 10,
      commentDelayMinMax: 60,
      defaultPersona: "フレンドリーなユーザー",
    });

    // 設定を取得
    const settings = await db.query.interactionSettings.findFirst({
      where: eq(interactionSettings.projectId, testProjectId),
    });

    expect(settings).toBeDefined();
    expect(settings?.isEnabled).toBe(false);
    expect(settings?.likeEnabled).toBe(true);
    expect(settings?.likeDelayMinMin).toBe(5);
    expect(settings?.likeDelayMinMax).toBe(30);
    expect(settings?.commentEnabled).toBe(true);
    expect(settings?.commentDelayMinMin).toBe(10);
    expect(settings?.commentDelayMinMax).toBe(60);
    expect(settings?.defaultPersona).toBe("フレンドリーなユーザー");
  });

  it("should update interaction settings", async () => {
    // 設定を更新
    const existing = await db.query.interactionSettings.findFirst({
      where: eq(interactionSettings.projectId, testProjectId),
    });

    if (existing) {
      await db.update(interactionSettings)
        .set({
          isEnabled: true,
          likeDelayMinMin: 10,
          likeDelayMinMax: 60,
        })
        .where(eq(interactionSettings.id, existing.id));

      // 更新された設定を取得
      const updated = await db.query.interactionSettings.findFirst({
        where: eq(interactionSettings.projectId, testProjectId),
      });

      expect(updated?.isEnabled).toBe(true);
      expect(updated?.likeDelayMinMin).toBe(10);
      expect(updated?.likeDelayMinMax).toBe(60);
    }
  });

  it("should load settings from AI strategy", async () => {
    // テスト用戦略を作成
    const strategyData = {
      mutualLikes: {
        enabled: true,
        delayMinutes: {
          min: 15,
          max: 45,
        },
      },
      mutualComments: {
        enabled: true,
        delayMinutes: {
          min: 20,
          max: 90,
        },
      },
      commentStyle: "金融に詳しい投資家",
    };

    await db.insert(strategies).values({
      userId: 1,
      projectId: testProjectId,
      objective: "Test strategy",
      engagementStrategy: JSON.stringify(strategyData),
    });

    // 戦略を取得
    const strategy = await db.query.strategies.findFirst({
      where: eq(strategies.projectId, testProjectId),
    });

    expect(strategy).toBeDefined();

    const engagementStrategy = JSON.parse(strategy!.engagementStrategy!);
    expect(engagementStrategy.mutualLikes.enabled).toBe(true);
    expect(engagementStrategy.mutualLikes.delayMinutes.min).toBe(15);
    expect(engagementStrategy.mutualLikes.delayMinutes.max).toBe(45);
    expect(engagementStrategy.mutualComments.enabled).toBe(true);
    expect(engagementStrategy.mutualComments.delayMinutes.min).toBe(20);
    expect(engagementStrategy.mutualComments.delayMinutes.max).toBe(90);
    expect(engagementStrategy.commentStyle).toBe("金融に詳しい投資家");

    // クリーンアップ
    await db.delete(strategies).where(eq(strategies.projectId, testProjectId));
  });
});
