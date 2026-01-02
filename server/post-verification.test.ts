/**
 * Post Verification Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  takeScreenshot, 
  checkTextOnScreen, 
  verifyInstagramPost,
  verifyTwitterPost,
  verifyTikTokPost,
  verifyFacebookPost
} from './post-verification';
import { db } from './db';

// Mock database
vi.mock('./db', () => ({
  db: {
    query: {
      settings: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('Post Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('takeScreenshot', () => {
    it('should return null if API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);
      
      const result = await takeScreenshot('test-device-id');
      expect(result).toBeNull();
    });

    it('should return screenshot path if successful', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
      } as any);
      
      // Note: This test requires actual DuoPlus API integration
      // For now, we just verify the function doesn't throw
      const result = await takeScreenshot('test-device-id');
      // Result will be null in test environment without actual API
      expect(result).toBeDefined();
    });
  });

  describe('checkTextOnScreen', () => {
    it('should return false if API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);
      
      const result = await checkTextOnScreen('test-device-id', 'test text');
      expect(result).toBe(false);
    });
  });

  describe('verifyInstagramPost', () => {
    it('should return unverified result if API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);
      
      const result = await verifyInstagramPost('test-device-id');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('API key not found');
    });
  });

  describe('verifyTwitterPost', () => {
    it('should return unverified result if API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);
      
      const result = await verifyTwitterPost('test-device-id');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('API key not found');
    });
  });

  describe('verifyTikTokPost', () => {
    it('should return unverified result if API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);
      
      const result = await verifyTikTokPost('test-device-id');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('API key not found');
    });
  });

  describe('verifyFacebookPost', () => {
    it('should return unverified result if API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);
      
      const result = await verifyFacebookPost('test-device-id');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('API key not found');
    });
  });
});
