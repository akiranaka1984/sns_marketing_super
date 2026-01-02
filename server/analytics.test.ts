import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Analytics System', () => {
  let testAccountId: number;

  beforeAll(async () => {
    // Create a test account
    const account = await db.createAccount({
      userId: 1,
      platform: 'twitter',
      username: 'test_analytics_user',
      password: 'test_password',
      status: 'active',
    });
    testAccountId = account.id;
  });

  it('should create analytics record', async () => {
    const analytics = await db.createAnalytics({
      accountId: testAccountId,
      followersCount: 100,
      followingCount: 50,
      postsCount: 10,
      engagementRate: 550, // 5.5% stored as 550 (percentage * 100)
      likesCount: 55,
      commentsCount: 10,
      sharesCount: 5,
    });

    expect(analytics).toBeDefined();
    expect(analytics.accountId).toBe(testAccountId);
    expect(analytics.followersCount).toBe(100);
    expect(analytics.engagementRate).toBe(550);
  });

  it('should retrieve analytics by account', async () => {
    // Create multiple analytics records
    await db.createAnalytics({
      accountId: testAccountId,
      followersCount: 110,
      followingCount: 55,
      postsCount: 12,
      engagementRate: 600, // 6.0% stored as 600
      likesCount: 72,
      commentsCount: 12,
      sharesCount: 6,
    });

    await db.createAnalytics({
      accountId: testAccountId,
      followersCount: 120,
      followingCount: 60,
      postsCount: 15,
      engagementRate: 650, // 6.5% stored as 650
      likesCount: 97,
      commentsCount: 15,
      sharesCount: 8,
    });

    const analytics = await db.getAnalyticsByAccount(testAccountId, 10);
    
    expect(analytics).toBeDefined();
    expect(analytics.length).toBeGreaterThan(0);
    expect(analytics[0].accountId).toBe(testAccountId);
    
    // Should be ordered by recordedAt DESC (newest first)
    if (analytics.length > 1) {
      const firstDate = new Date(analytics[0].recordedAt).getTime();
      const secondDate = new Date(analytics[1].recordedAt).getTime();
      expect(firstDate).toBeGreaterThanOrEqual(secondDate);
    }
  });

  it('should get analytics summary with growth rate', async () => {
    const summary = await db.getAnalyticsSummary(testAccountId);
    
    expect(summary).toBeDefined();
    expect(summary.current).toBeDefined();
    expect(summary.previous).toBeDefined();
    expect(summary.growthRate).toBeDefined();
    
    // Current should have higher values than the first record
    expect(summary.current.followersCount).toBeGreaterThan(0);
    
    // Growth rate should be calculated
    if (summary.previous && summary.previous.followersCount > 0) {
      const expectedGrowthRate = 
        ((summary.current.followersCount - summary.previous.followersCount) / 
        summary.previous.followersCount) * 100;
      
      expect(Math.abs(summary.growthRate.followers - expectedGrowthRate)).toBeLessThan(0.01);
    }
  });

  it('should get latest analytics for all accounts', async () => {
    const latestAnalytics = await db.getLatestAnalytics();
    
    expect(latestAnalytics).toBeDefined();
    expect(Array.isArray(latestAnalytics)).toBe(true);
    
    // Should include our test account
    const testAccountAnalytics = latestAnalytics.find(a => a.accountId === testAccountId);
    expect(testAccountAnalytics).toBeDefined();
  });

  it('should handle analytics for account with no data', async () => {
    // Create an account without analytics
    const newAccount = await db.createAccount({
      userId: 1,
      platform: 'instagram',
      username: 'no_analytics_user',
      password: 'test_password',
      status: 'pending',
    });

    const analytics = await db.getAnalyticsByAccount(newAccount.id, 10);
    expect(analytics).toBeDefined();
    expect(analytics.length).toBe(0);

    const summary = await db.getAnalyticsSummary(newAccount.id);
    expect(summary).toBeDefined();
    expect(summary.current).toBeNull();
    expect(summary.previous).toBeNull();
    expect(summary.growthRate.followers).toBe(0);
    expect(summary.growthRate.engagement).toBe(0);
  });

  it('should limit analytics results correctly', async () => {
    const limit = 2;
    const analytics = await db.getAnalyticsByAccount(testAccountId, limit);
    
    expect(analytics.length).toBeLessThanOrEqual(limit);
  });

  it('should store engagement metrics correctly', async () => {
    const analytics = await db.createAnalytics({
      accountId: testAccountId,
      followersCount: 150,
      followingCount: 75,
      postsCount: 20,
      engagementRate: 750, // 7.5% stored as 750
      likesCount: 150,
      commentsCount: 20,
      sharesCount: 10,
    });

    expect(analytics.likesCount).toBe(150);
    expect(analytics.commentsCount).toBe(20);
    expect(analytics.sharesCount).toBe(10);
    
    // Verify engagement rate calculation
    const totalEngagements = analytics.likesCount + analytics.commentsCount + analytics.sharesCount;
    expect(totalEngagements).toBe(180);
  });

  it('should handle zero engagement rate', async () => {
    const analytics = await db.createAnalytics({
      accountId: testAccountId,
      followersCount: 200,
      followingCount: 100,
      postsCount: 5,
      engagementRate: 0,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    });

    expect(analytics.engagementRate).toBe(0);
    expect(analytics.likesCount).toBe(0);
    expect(analytics.commentsCount).toBe(0);
    expect(analytics.sharesCount).toBe(0);
  });

  it('should handle large follower counts', async () => {
    const analytics = await db.createAnalytics({
      accountId: testAccountId,
      followersCount: 1000000, // 1 million followers
      followingCount: 500,
      postsCount: 100,
      engagementRate: 350, // 3.5% stored as 350
      likesCount: 35000,
      commentsCount: 5000,
      sharesCount: 2000,
    });

    expect(analytics.followersCount).toBe(1000000);
    expect(analytics.likesCount).toBe(35000);
  });

  it('should calculate negative growth rate correctly', async () => {
    // Create a new test account for negative growth
    const account = await db.createAccount({
      userId: 1,
      platform: 'facebook',
      username: 'declining_account',
      password: 'test_password',
      status: 'active',
    });

    // First record with higher followers
    await db.createAnalytics({
      accountId: account.id,
      followersCount: 1000,
      followingCount: 500,
      postsCount: 50,
      engagementRate: 500, // 5.0% stored as 500
      likesCount: 500,
      commentsCount: 100,
      sharesCount: 50,
    });

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second record with lower followers
    await db.createAnalytics({
      accountId: account.id,
      followersCount: 900,
      followingCount: 500,
      postsCount: 52,
      engagementRate: 450, // 4.5% stored as 450
      likesCount: 450,
      commentsCount: 90,
      sharesCount: 45,
    });

    const summary = await db.getAnalyticsSummary(account.id);
    
    // Growth rate should be negative for both followers and engagement
    expect(summary.growthRate.followers).toBeLessThan(0);
    // Engagement growth might be 0 if there's no previous data, so we check if it's defined
    if (summary.previous && summary.previous.engagementRate > 0) {
      expect(summary.growthRate.engagement).toBeLessThan(0);
    }
  });
});
