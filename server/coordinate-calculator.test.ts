import { describe, it, expect } from 'vitest';
import {
  calculateTapCoordinates,
  calculateMultipleTapCoordinates,
  getInstagramCoordinates,
  isValidResolution,
  INSTAGRAM_COORDINATES,
  type DeviceResolution,
} from './coordinate-calculator';

describe('Coordinate Calculator', () => {
  describe('calculateTapCoordinates', () => {
    it('should return the same coordinates for base resolution (1080x2400)', () => {
      const baseResolution: DeviceResolution = { width: 1080, height: 2400 };
      const result = calculateTapCoordinates(540, 1200, baseResolution);
      
      expect(result).toEqual({ x: 540, y: 1200 });
    });

    it('should scale coordinates correctly for 2x resolution (2160x4800)', () => {
      const highResolution: DeviceResolution = { width: 2160, height: 4800 };
      const result = calculateTapCoordinates(540, 1200, highResolution);
      
      expect(result).toEqual({ x: 1080, y: 2400 });
    });

    it('should scale coordinates correctly for 1.5x resolution (1620x3600)', () => {
      const mediumResolution: DeviceResolution = { width: 1620, height: 3600 };
      const result = calculateTapCoordinates(540, 1200, mediumResolution);
      
      expect(result).toEqual({ x: 810, y: 1800 });
    });

    it('should scale coordinates correctly for lower resolution (720x1600)', () => {
      const lowResolution: DeviceResolution = { width: 720, height: 1600 };
      const result = calculateTapCoordinates(540, 1200, lowResolution);
      
      // 540 * (720/1080) = 360
      // 1200 * (1600/2400) = 800
      expect(result).toEqual({ x: 360, y: 800 });
    });

    it('should round coordinates to nearest integer', () => {
      const customResolution: DeviceResolution = { width: 1000, height: 2000 };
      const result = calculateTapCoordinates(540, 1200, customResolution);
      
      // 540 * (1000/1080) = 500
      // 1200 * (2000/2400) = 1000
      expect(result).toEqual({ x: 500, y: 1000 });
    });
  });

  describe('calculateMultipleTapCoordinates', () => {
    it('should scale multiple coordinates correctly', () => {
      const baseCoordinates = [
        { x: 540, y: 1850 },
        { x: 980, y: 100 },
        { x: 150, y: 600 },
      ];
      const deviceResolution: DeviceResolution = { width: 2160, height: 4800 };
      
      const result = calculateMultipleTapCoordinates(baseCoordinates, deviceResolution);
      
      expect(result).toEqual([
        { x: 1080, y: 3700 },
        { x: 1960, y: 200 },
        { x: 300, y: 1200 },
      ]);
    });

    it('should handle empty array', () => {
      const deviceResolution: DeviceResolution = { width: 1080, height: 2400 };
      const result = calculateMultipleTapCoordinates([], deviceResolution);
      
      expect(result).toEqual([]);
    });
  });

  describe('getInstagramCoordinates', () => {
    it('should return scaled Instagram coordinates for base resolution', () => {
      const baseResolution: DeviceResolution = { width: 1080, height: 2400 };
      const coords = getInstagramCoordinates(baseResolution);
      
      expect(coords.createButton).toEqual({ x: 540, y: 1850 });
      expect(coords.postOption).toEqual({ x: 540, y: 1700 });
      expect(coords.mediaSelect).toEqual({ x: 150, y: 600 });
      expect(coords.nextButton).toEqual({ x: 980, y: 100 });
      expect(coords.captionArea).toEqual({ x: 540, y: 300 });
      expect(coords.shareButton).toEqual({ x: 980, y: 100 });
    });

    it('should return scaled Instagram coordinates for 2x resolution', () => {
      const highResolution: DeviceResolution = { width: 2160, height: 4800 };
      const coords = getInstagramCoordinates(highResolution);
      
      expect(coords.createButton).toEqual({ x: 1080, y: 3700 });
      expect(coords.postOption).toEqual({ x: 1080, y: 3400 });
      expect(coords.mediaSelect).toEqual({ x: 300, y: 1200 });
      expect(coords.nextButton).toEqual({ x: 1960, y: 200 });
      expect(coords.captionArea).toEqual({ x: 1080, y: 600 });
      expect(coords.shareButton).toEqual({ x: 1960, y: 200 });
    });

    it('should return scaled Instagram coordinates for lower resolution', () => {
      const lowResolution: DeviceResolution = { width: 720, height: 1600 };
      const coords = getInstagramCoordinates(lowResolution);
      
      // 540 * (720/1080) = 360
      // 1850 * (1600/2400) = 1233.33 → 1233
      expect(coords.createButton).toEqual({ x: 360, y: 1233 });
      expect(coords.postOption).toEqual({ x: 360, y: 1133 });
      expect(coords.mediaSelect).toEqual({ x: 100, y: 400 });
      expect(coords.nextButton).toEqual({ x: 653, y: 67 });
      expect(coords.captionArea).toEqual({ x: 360, y: 200 });
      expect(coords.shareButton).toEqual({ x: 653, y: 67 });
    });
  });

  describe('isValidResolution', () => {
    it('should return true for valid resolution', () => {
      const validResolution: DeviceResolution = { width: 1080, height: 2400 };
      expect(isValidResolution(validResolution)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidResolution(null)).toBe(false);
    });

    it('should return false for zero width', () => {
      const invalidResolution: DeviceResolution = { width: 0, height: 2400 };
      expect(isValidResolution(invalidResolution)).toBe(false);
    });

    it('should return false for zero height', () => {
      const invalidResolution: DeviceResolution = { width: 1080, height: 0 };
      expect(isValidResolution(invalidResolution)).toBe(false);
    });

    it('should return false for negative width', () => {
      const invalidResolution: DeviceResolution = { width: -1080, height: 2400 };
      expect(isValidResolution(invalidResolution)).toBe(false);
    });

    it('should return false for negative height', () => {
      const invalidResolution: DeviceResolution = { width: 1080, height: -2400 };
      expect(isValidResolution(invalidResolution)).toBe(false);
    });
  });

  describe('INSTAGRAM_COORDINATES', () => {
    it('should have all required coordinate keys', () => {
      expect(INSTAGRAM_COORDINATES).toHaveProperty('createButton');
      expect(INSTAGRAM_COORDINATES).toHaveProperty('postOption');
      expect(INSTAGRAM_COORDINATES).toHaveProperty('mediaSelect');
      expect(INSTAGRAM_COORDINATES).toHaveProperty('nextButton');
      expect(INSTAGRAM_COORDINATES).toHaveProperty('captionArea');
      expect(INSTAGRAM_COORDINATES).toHaveProperty('shareButton');
    });

    it('should have valid coordinate values', () => {
      Object.values(INSTAGRAM_COORDINATES).forEach(coord => {
        expect(coord.x).toBeGreaterThan(0);
        expect(coord.y).toBeGreaterThan(0);
        expect(coord.x).toBeLessThanOrEqual(1080);
        expect(coord.y).toBeLessThanOrEqual(2400);
      });
    });
  });
});
