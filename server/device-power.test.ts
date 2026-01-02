import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startDevice, stopDevice, restartDevice } from './device-power';

// Mock the duoplus-proxy module
vi.mock('./duoplus-proxy', () => ({
  powerOnDevice: vi.fn(),
  powerOffDevice: vi.fn(),
}));

import { powerOnDevice, powerOffDevice } from './duoplus-proxy';

describe('Device Power Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startDevice', () => {
    it('should start a device successfully', async () => {
      vi.mocked(powerOnDevice).mockResolvedValue(undefined);

      const result = await startDevice('snap_test123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('デバイスを起動しました');
      expect(powerOnDevice).toHaveBeenCalledWith('snap_test123');
    });

    it('should handle device already running error', async () => {
      vi.mocked(powerOnDevice).mockRejectedValue(new Error('Device is already running'));

      const result = await startDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('デバイスは既に起動しています');
    });

    it('should handle fail list error', async () => {
      vi.mocked(powerOnDevice).mockRejectedValue(new Error('Device in fail list'));

      const result = await startDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('しばらく待ってから再試行');
    });

    it('should handle API errors', async () => {
      vi.mocked(powerOnDevice).mockRejectedValue(new Error('Network error'));

      const result = await startDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('stopDevice', () => {
    it('should stop a device successfully', async () => {
      vi.mocked(powerOffDevice).mockResolvedValue(undefined);

      const result = await stopDevice('snap_test123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('デバイスを停止しました');
      expect(powerOffDevice).toHaveBeenCalledWith('snap_test123');
    });

    it('should handle device already stopped error', async () => {
      vi.mocked(powerOffDevice).mockRejectedValue(new Error('Device is already stopped'));

      const result = await stopDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('デバイスは既に停止しています');
    });

    it('should handle fail list error', async () => {
      vi.mocked(powerOffDevice).mockRejectedValue(new Error('Device in fail list'));

      const result = await stopDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('しばらく待ってから再試行');
    });

    it('should handle API errors', async () => {
      vi.mocked(powerOffDevice).mockRejectedValue(new Error('Network error'));

      const result = await stopDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('restartDevice', () => {
    it('should restart a device successfully', async () => {
      vi.mocked(powerOffDevice).mockResolvedValue(undefined);
      vi.mocked(powerOnDevice).mockResolvedValue(undefined);

      const result = await restartDevice('snap_test123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('デバイスを再起動しました');
      expect(powerOffDevice).toHaveBeenCalledWith('snap_test123');
      expect(powerOnDevice).toHaveBeenCalledWith('snap_test123');
    }, 10000); // Increase timeout for the 3 second wait

    it('should handle device not running error', async () => {
      vi.mocked(powerOffDevice).mockRejectedValue(new Error('Device is not running'));

      const result = await restartDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('デバイスが起動していないため再起動できません');
    });

    it('should handle API errors during power off', async () => {
      vi.mocked(powerOffDevice).mockRejectedValue(new Error('Network error'));

      const result = await restartDevice('snap_test123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });
});
