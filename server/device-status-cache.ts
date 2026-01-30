/**
 * Device Status Cache
 * Reduces server load by caching device status for 30 seconds
 */

interface CachedStatus {
  status: any;
  timestamp: number;
}

class DeviceStatusCache {
  private cache: Map<string, CachedStatus> = new Map();
  private readonly TTL = 30000; // 30 seconds
  private readonly MAX_SIZE = 200; // Maximum cache entries

  get(deviceId: string): any | null {
    const cached = this.cache.get(deviceId);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.TTL) {
      // Expired
      this.cache.delete(deviceId);
      return null;
    }

    return cached.status;
  }

  set(deviceId: string, status: any): void {
    // Clean up old entries if cache is too large
    if (this.cache.size >= this.MAX_SIZE) {
      this.cleanup();
    }

    this.cache.set(deviceId, {
      status,
      timestamp: Date.now(),
    });
  }

  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Find expired entries
    this.cache.forEach((cached, deviceId) => {
      if (now - cached.timestamp > this.TTL) {
        entriesToDelete.push(deviceId);
      }
    });

    // Delete expired entries
    for (const deviceId of entriesToDelete) {
      this.cache.delete(deviceId);
    }

    // If still too large, delete oldest entries
    if (this.cache.size >= this.MAX_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, Math.floor(this.MAX_SIZE / 4));
      for (const [deviceId] of toDelete) {
        this.cache.delete(deviceId);
      }
    }
  }

  delete(deviceId: string): void {
    this.cache.delete(deviceId);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const deviceStatusCache = new DeviceStatusCache();
