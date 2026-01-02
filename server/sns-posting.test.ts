import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock db
vi.mock('./db', () => ({
  db: {
    query: {
      settings: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import axios from 'axios';
import { db } from './db';

describe('SNS Posting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('postToSNS', () => {
    it('should return error when API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);

      const { postToSNS } = await import('./sns-posting');
      
      const result = await postToSNS('twitter', 'device123', 'Test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('DUOPLUS_API_KEY not configured');
    });

    it('should return error for unsupported platform', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { postToSNS } = await import('./sns-posting');
      
      const result = await postToSNS('unsupported', 'device123', 'Test content');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('UNSUPPORTED_PLATFORM');
    });

    it('should call DuoPlus API for Twitter platform', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({ data: { code: 200 } });

      const { postToTwitter } = await import('./sns-posting');
      
      const promise = postToTwitter('device123', 'Test tweet');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('Instagram posting with media', () => {
    it('should return error when no media URL is provided for Instagram', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { postToInstagram } = await import('./sns-posting');
      
      const result = await postToInstagram('device123', 'Test caption');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_MEDIA_PROVIDED');
    });

    it('should return error when empty mediaUrls array is provided', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { postToInstagram } = await import('./sns-posting');
      
      const result = await postToInstagram('device123', 'Test caption', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_MEDIA_PROVIDED');
    });

    it('should return error when all mediaUrls are empty strings', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { postToInstagram } = await import('./sns-posting');
      
      const result = await postToInstagram('device123', 'Test caption', ['', '  ', '']);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_MEDIA_URLS');
      expect(result.message).toContain('All URLs are empty');
    });

    it('should attempt to download media for Instagram when URL is provided', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({ data: { code: 200 } });

      const { postToInstagram } = await import('./sns-posting');
      
      const promise = postToInstagram('device123', 'Test caption', ['https://example.com/image.jpg']);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(axios.post).toHaveBeenCalled();
    });

    it('should handle multiple media URLs for Instagram carousel', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({ data: { code: 200 } });

      const { postToInstagram } = await import('./sns-posting');
      
      const mediaUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ];
      
      const promise = postToInstagram('device123', 'Carousel test', mediaUrls);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('TikTok posting with media', () => {
    it('should return error when no media URL is provided for TikTok', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { postToTikTok } = await import('./sns-posting');
      
      const result = await postToTikTok('device123', 'Test caption');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_MEDIA_PROVIDED');
    });

    it('should attempt to download video for TikTok when URL is provided', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({ data: { code: 200 } });

      const { postToTikTok } = await import('./sns-posting');
      
      const promise = postToTikTok('device123', 'Test caption', ['https://example.com/video.mp4']);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(axios.post).toHaveBeenCalled();
    });

    it('should handle multiple media URLs for TikTok photo mode', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({ data: { code: 200 } });

      const { postToTikTok } = await import('./sns-posting');
      
      const mediaUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ];
      
      const promise = postToTikTok('device123', 'Photo mode test', mediaUrls);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('isDevicePoweredOn', () => {
    it('should return false when API key is not found', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue(null);

      const { isDevicePoweredOn } = await import('./sns-posting');
      
      const result = await isDevicePoweredOn('device123');
      
      expect(result).toBe(false);
    });

    it('should return true when device is powered on', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          data: {
            list: [
              { id: 'device123', status: 1 },
              { id: 'device456', status: 0 },
            ],
          },
        },
      });

      const { isDevicePoweredOn } = await import('./sns-posting');
      
      const result = await isDevicePoweredOn('device123');
      
      expect(result).toBe(true);
    });

    it('should return false when device is powered off', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          data: {
            list: [
              { id: 'device123', status: 0 },
            ],
          },
        },
      });

      const { isDevicePoweredOn } = await import('./sns-posting');
      
      const result = await isDevicePoweredOn('device123');
      
      expect(result).toBe(false);
    });

    it('should return false when device is not in list', async () => {
      vi.mocked(db.query.settings.findFirst).mockResolvedValue({
        id: 1,
        key: 'DUOPLUS_API_KEY',
        value: 'test-api-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          data: {
            list: [
              { id: 'other_device', status: 1 },
            ],
          },
        },
      });

      const { isDevicePoweredOn } = await import('./sns-posting');
      
      const result = await isDevicePoweredOn('device123');
      
      expect(result).toBe(false);
    });
  });
});
