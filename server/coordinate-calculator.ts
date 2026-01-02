/**
 * Coordinate Calculator for Dynamic Device Resolution
 * 
 * This module provides functions to calculate tap coordinates dynamically
 * based on device resolution, ensuring compatibility across different screen sizes.
 */

/**
 * Base resolution (reference device)
 * Most Android devices use 1080x2400 or similar aspect ratios
 */
const BASE_RESOLUTION = {
  width: 1080,
  height: 2400,
};

/**
 * Coordinate definition for a tap point
 */
export interface TapCoordinate {
  x: number;
  y: number;
}

/**
 * Device resolution
 */
export interface DeviceResolution {
  width: number;
  height: number;
}

/**
 * Calculate scaled tap coordinates based on device resolution
 * 
 * @param baseX - X coordinate on base resolution (1080x2400)
 * @param baseY - Y coordinate on base resolution (1080x2400)
 * @param deviceResolution - Actual device resolution
 * @returns Scaled tap coordinates for the target device
 * 
 * @example
 * ```ts
 * const coords = calculateTapCoordinates(540, 1850, { width: 1440, height: 3200 });
 * // Returns: { x: 720, y: 2467 }
 * ```
 */
export function calculateTapCoordinates(
  baseX: number,
  baseY: number,
  deviceResolution: DeviceResolution
): TapCoordinate {
  const scaleX = deviceResolution.width / BASE_RESOLUTION.width;
  const scaleY = deviceResolution.height / BASE_RESOLUTION.height;

  return {
    x: Math.round(baseX * scaleX),
    y: Math.round(baseY * scaleY),
  };
}

/**
 * Calculate multiple tap coordinates at once
 * 
 * @param baseCoordinates - Array of base coordinates
 * @param deviceResolution - Actual device resolution
 * @returns Array of scaled tap coordinates
 * 
 * @example
 * ```ts
 * const coords = calculateMultipleTapCoordinates(
 *   [{ x: 540, y: 1850 }, { x: 980, y: 100 }],
 *   { width: 1440, height: 3200 }
 * );
 * ```
 */
export function calculateMultipleTapCoordinates(
  baseCoordinates: TapCoordinate[],
  deviceResolution: DeviceResolution
): TapCoordinate[] {
  return baseCoordinates.map(coord =>
    calculateTapCoordinates(coord.x, coord.y, deviceResolution)
  );
}

/**
 * Instagram posting coordinates (base resolution: 1080x2400)
 * These coordinates are for the standard Instagram app UI
 */
export const INSTAGRAM_COORDINATES = {
  // Create button (bottom center, + icon)
  createButton: { x: 540, y: 1850 },
  
  // Post option in create menu
  postOption: { x: 540, y: 1700 },
  
  // Media selection (first item in gallery, top-left)
  mediaSelect: { x: 150, y: 600 },
  
  // Next button (top-right)
  nextButton: { x: 980, y: 100 },
  
  // Caption input area (top area after media selection)
  captionArea: { x: 540, y: 300 },
  
  // Share button (top-right, same as Next button)
  shareButton: { x: 980, y: 100 },
};

/**
 * Get scaled Instagram coordinates for a specific device
 * 
 * @param deviceResolution - Actual device resolution
 * @returns Scaled Instagram coordinates
 * 
 * @example
 * ```ts
 * const coords = getInstagramCoordinates({ width: 1440, height: 3200 });
 * // Use coords.createButton, coords.postOption, etc.
 * ```
 */
export function getInstagramCoordinates(deviceResolution: DeviceResolution) {
  return {
    createButton: calculateTapCoordinates(
      INSTAGRAM_COORDINATES.createButton.x,
      INSTAGRAM_COORDINATES.createButton.y,
      deviceResolution
    ),
    postOption: calculateTapCoordinates(
      INSTAGRAM_COORDINATES.postOption.x,
      INSTAGRAM_COORDINATES.postOption.y,
      deviceResolution
    ),
    mediaSelect: calculateTapCoordinates(
      INSTAGRAM_COORDINATES.mediaSelect.x,
      INSTAGRAM_COORDINATES.mediaSelect.y,
      deviceResolution
    ),
    nextButton: calculateTapCoordinates(
      INSTAGRAM_COORDINATES.nextButton.x,
      INSTAGRAM_COORDINATES.nextButton.y,
      deviceResolution
    ),
    captionArea: calculateTapCoordinates(
      INSTAGRAM_COORDINATES.captionArea.x,
      INSTAGRAM_COORDINATES.captionArea.y,
      deviceResolution
    ),
    shareButton: calculateTapCoordinates(
      INSTAGRAM_COORDINATES.shareButton.x,
      INSTAGRAM_COORDINATES.shareButton.y,
      deviceResolution
    ),
  };
}

/**
 * Validate device resolution
 * 
 * @param resolution - Device resolution to validate
 * @returns True if resolution is valid
 */
export function isValidResolution(resolution: DeviceResolution | null): resolution is DeviceResolution {
  return (
    resolution !== null &&
    typeof resolution.width === 'number' &&
    typeof resolution.height === 'number' &&
    resolution.width > 0 &&
    resolution.height > 0
  );
}
