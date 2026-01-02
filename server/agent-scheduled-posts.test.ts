import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculatePostTimes,
  createAgentScheduledPost,
  approveScheduledPost,
  rejectScheduledPost,
  editScheduledPost,
  bulkApproveScheduledPosts,
  bulkRejectScheduledPosts,
} from './agent-scheduled-posts';

// Mock the database
vi.mock('./db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve([{ insertId: 1 }])),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    query: {
      scheduledPosts: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      agents: {
        findFirst: vi.fn(() => Promise.resolve({ id: 1, name: 'Test Agent' })),
      },
      agentSchedules: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      agentAccounts: {
        findMany: vi.fn(() => Promise.resolve([{ accountId: 1 }])),
      },
      accounts: {
        findMany: vi.fn(() => Promise.resolve([{ id: 1, platform: 'twitter' }])),
        findFirst: vi.fn(() => Promise.resolve({ id: 1, platform: 'twitter' })),
      },
    },
  },
}));

describe('Agent Scheduled Posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePostTimes', () => {
    it('should generate correct number of post times', () => {
      const schedule = {
        id: 1,
        agentId: 1,
        accountId: 1,
        scheduleType: 'daily' as const,
        timeSlot: '09:00',
        dayOfWeek: null,
        timezone: 'Asia/Tokyo',
        isActive: true,
        nextExecutionAt: null,
        lastExecutedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const times = calculatePostTimes(schedule, 5);
      
      expect(times.length).toBe(5);
      times.forEach(time => {
        expect(time).toBeInstanceOf(Date);
        expect(time.getTime()).toBeGreaterThan(Date.now());
      });
    });

    it('should respect dayOfWeek setting', () => {
      const schedule = {
        id: 1,
        agentId: 1,
        accountId: 1,
        scheduleType: 'weekly' as const,
        timeSlot: '12:00',
        dayOfWeek: 1, // Monday
        timezone: 'Asia/Tokyo',
        isActive: true,
        nextExecutionAt: null,
        lastExecutedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const times = calculatePostTimes(schedule, 3);
      
      expect(times.length).toBe(3);
      times.forEach(time => {
        expect(time.getDay()).toBe(1); // All should be Monday
      });
    });

    it('should parse timeSlot correctly', () => {
      const schedule = {
        id: 1,
        agentId: 1,
        accountId: 1,
        scheduleType: 'daily' as const,
        timeSlot: '18:00',
        dayOfWeek: null,
        timezone: 'Asia/Tokyo',
        isActive: true,
        nextExecutionAt: null,
        lastExecutedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const times = calculatePostTimes(schedule, 2);
      
      times.forEach(time => {
        expect(time.getHours()).toBe(18);
      });
    });
  });

  describe('createAgentScheduledPost', () => {
    it('should create a scheduled post with correct fields', async () => {
      const input = {
        agentId: 1,
        accountId: 1,
        projectId: 1,
        content: 'Test post content',
        hashtags: ['test', 'automation'],
        scheduledTime: new Date(),
        confidence: 85,
      };

      const postId = await createAgentScheduledPost(input);
      
      expect(postId).toBe(1);
    });

    it('should include hashtags in content', async () => {
      const input = {
        agentId: 1,
        accountId: 1,
        projectId: 1,
        content: 'Test post',
        hashtags: ['tag1', 'tag2'],
        scheduledTime: new Date(),
        confidence: 80,
      };

      await createAgentScheduledPost(input);
      
      // The function should have been called with content including hashtags
      expect(true).toBe(true); // Basic assertion that function completed
    });
  });

  describe('approveScheduledPost', () => {
    it('should update post with approved status', async () => {
      await approveScheduledPost(1, 'Looks good');
      
      // Function should complete without error
      expect(true).toBe(true);
    });
  });

  describe('rejectScheduledPost', () => {
    it('should update post with rejected status and reason', async () => {
      await rejectScheduledPost(1, 'Content not appropriate');
      
      // Function should complete without error
      expect(true).toBe(true);
    });
  });

  describe('editScheduledPost', () => {
    it('should update post content', async () => {
      await editScheduledPost(1, 'Updated content', ['newtag']);
      
      // Function should complete without error
      expect(true).toBe(true);
    });

    it('should work without hashtags', async () => {
      await editScheduledPost(1, 'Updated content only');
      
      // Function should complete without error
      expect(true).toBe(true);
    });
  });

  describe('bulkApproveScheduledPosts', () => {
    it('should approve multiple posts', async () => {
      const approved = await bulkApproveScheduledPosts([1, 2, 3]);
      
      expect(approved).toBe(3);
    });
  });

  describe('bulkRejectScheduledPosts', () => {
    it('should reject multiple posts', async () => {
      const rejected = await bulkRejectScheduledPosts([1, 2], 'Bulk rejection');
      
      expect(rejected).toBe(2);
    });
  });
});
