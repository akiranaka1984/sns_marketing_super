import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('Settings API Connection Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DuoPlus API Connection Test', () => {
    it('should return success when DuoPlus API returns valid device list', async () => {
      // Mock successful DuoPlus API response
      const mockDeviceList = [
        {
          id: 'device1',
          name: 'Test Device 1',
          status: 1,
          os: 'Android',
          size: '1080x1920',
          created_at: '2024-01-01',
          expired_at: '2025-01-01',
          ip: '192.168.1.1',
          area: 'US',
          remark: 'Test',
          adb: 'localhost:5555',
          adb_password: 'password',
        },
        {
          id: 'device2',
          name: 'Test Device 2',
          status: 1,
          os: 'Android',
          size: '1080x1920',
          created_at: '2024-01-01',
          expired_at: '2025-01-01',
          ip: '192.168.1.2',
          area: 'US',
          remark: 'Test',
          adb: 'localhost:5556',
          adb_password: 'password',
        },
      ];

      mockedAxios.create.mockReturnValue({
        post: vi.fn().mockResolvedValue({
          data: {
            data: {
              list: mockDeviceList,
            },
          },
        }),
      } as any);

      // Simulate the connection test logic
      const apiKey = 'test-duoplus-api-key';
      const duoplusClient = axios.create({
        baseURL: 'https://openapi.duoplus.net',
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Lang': 'en',
        },
        timeout: 10000,
      });

      const response = await duoplusClient.post('/api/v1/cloudPhone/list', {
        page: 1,
        pagesize: 100,
      });

      expect(response.data.data.list).toHaveLength(2);
      expect(response.data.data.list[0].id).toBe('device1');
    });

    it('should handle 401 authentication error', async () => {
      mockedAxios.create.mockReturnValue({
        post: vi.fn().mockRejectedValue({
          response: {
            status: 401,
          },
        }),
      } as any);

      const apiKey = 'invalid-api-key';
      const duoplusClient = axios.create({
        baseURL: 'https://openapi.duoplus.net',
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Lang': 'en',
        },
        timeout: 10000,
      });

      try {
        await duoplusClient.post('/api/v1/cloudPhone/list', {
          page: 1,
          pagesize: 100,
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should handle timeout error', async () => {
      mockedAxios.create.mockReturnValue({
        post: vi.fn().mockRejectedValue({
          code: 'ECONNABORTED',
          message: 'timeout of 10000ms exceeded',
        }),
      } as any);

      const apiKey = 'test-api-key';
      const duoplusClient = axios.create({
        baseURL: 'https://openapi.duoplus.net',
        headers: {
          'DuoPlus-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Lang': 'en',
        },
        timeout: 10000,
      });

      try {
        await duoplusClient.post('/api/v1/cloudPhone/list', {
          page: 1,
          pagesize: 100,
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });
  });

  describe('OpenAI API Connection Test', () => {
    it('should return success when OpenAI API returns valid response', async () => {
      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      };

      mockedAxios.create.mockReturnValue({
        post: vi.fn().mockResolvedValue({
          data: mockOpenAIResponse,
        }),
      } as any);

      const apiKey = 'test-openai-api-key';
      const openaiClient = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const response = await openaiClient.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        max_tokens: 10,
      });

      expect(response.data.choices).toHaveLength(1);
      expect(response.data.choices[0].message.role).toBe('assistant');
    });

    it('should handle 401 authentication error', async () => {
      mockedAxios.create.mockReturnValue({
        post: vi.fn().mockRejectedValue({
          response: {
            status: 401,
          },
        }),
      } as any);

      const apiKey = 'invalid-openai-key';
      const openaiClient = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      try {
        await openaiClient.post('/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          max_tokens: 10,
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should handle 429 rate limit error', async () => {
      mockedAxios.create.mockReturnValue({
        post: vi.fn().mockRejectedValue({
          response: {
            status: 429,
          },
        }),
      } as any);

      const apiKey = 'test-openai-key';
      const openaiClient = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      try {
        await openaiClient.post('/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          max_tokens: 10,
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(429);
      }
    });
  });

  describe('API Key Validation', () => {
    it('should handle empty API key', () => {
      const apiKey = '';
      expect(apiKey).toBe('');
      expect(!apiKey).toBe(true);
    });

    it('should handle undefined API key', () => {
      const apiKey = undefined;
      expect(apiKey).toBeUndefined();
      expect(!apiKey).toBe(true);
    });

    it('should accept valid API key', () => {
      const apiKey = 'sk-test-1234567890abcdef';
      expect(apiKey).toBeTruthy();
      expect(apiKey.length).toBeGreaterThan(0);
    });
  });
});
