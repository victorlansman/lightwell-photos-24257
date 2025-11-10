/**
 * Coordinate system types for face bounding boxes.
 *
 * ARCHITECTURE DECISION:
 * - UI Layer uses UiCoordinate (0-100 percentage, natural for CSS)
 * - API Layer uses ApiCoordinate (0-1 normalized, CV/ML standard)
 * - Conversion happens ONLY in API client boundary
 * - Type system prevents mixing via branded types
 */

// Branded type pattern: prevents accidental mixing
type Brand<K, T> = K & { __brand: T };

/**
 * UI coordinate: 0-100 percentage
 * Example: { x: 50, y: 25, width: 10, height: 15 }
 * Used by: All React components, user interactions
 */
export type UiCoordinate = Brand<number, 'UiCoordinate'>;

/**
 * API coordinate: 0-1 normalized
 * Example: { x: 0.5, y: 0.25, width: 0.1, height: 0.15 }
 * Used by: API client when sending/receiving from backend
 */
export type ApiCoordinate = Brand<number, 'ApiCoordinate'>;

/**
 * UI bounding box (0-100 coordinates)
 */
export interface UiBoundingBox {
  x: UiCoordinate;
  y: UiCoordinate;
  width: UiCoordinate;
  height: UiCoordinate;
}

/**
 * API bounding box (0-1 coordinates)
 */
export interface ApiBoundingBox {
  x: ApiCoordinate;
  y: ApiCoordinate;
  width: ApiCoordinate;
  height: ApiCoordinate;
}

/**
 * Create UI coordinate from raw number (use for user input, CSS)
 */
export function uiCoord(value: number): UiCoordinate {
  if (value < 0 || value > 100) {
    console.warn(`UI coordinate ${value} outside expected range [0, 100]`);
  }
  return value as UiCoordinate;
}

/**
 * Create API coordinate from raw number (use when receiving from backend)
 */
export function apiCoord(value: number): ApiCoordinate {
  if (value < 0 || value > 1) {
    throw new Error(`API coordinate ${value} outside valid range [0, 1]`);
  }
  return value as ApiCoordinate;
}

/**
 * Convert UI coordinate to API coordinate
 */
export function uiToApi(ui: UiCoordinate): ApiCoordinate {
  return apiCoord((ui as number) / 100);
}

/**
 * Convert API coordinate to UI coordinate
 */
export function apiToUi(api: ApiCoordinate): UiCoordinate {
  return uiCoord((api as number) * 100);
}

/**
 * Convert UI bounding box to API format
 */
export function uiBboxToApi(bbox: UiBoundingBox): ApiBoundingBox {
  return {
    x: uiToApi(bbox.x),
    y: uiToApi(bbox.y),
    width: uiToApi(bbox.width),
    height: uiToApi(bbox.height),
  };
}

/**
 * Convert API bounding box to UI format
 */
export function apiBboxToUi(bbox: ApiBoundingBox): UiBoundingBox {
  return {
    x: apiToUi(bbox.x),
    y: apiToUi(bbox.y),
    width: apiToUi(bbox.width),
    height: apiToUi(bbox.height),
  };
}

/**
 * Create UI bbox from raw numbers (for user interactions)
 */
export function createUiBbox(x: number, y: number, width: number, height: number): UiBoundingBox {
  return {
    x: uiCoord(x),
    y: uiCoord(y),
    width: uiCoord(width),
    height: uiCoord(height),
  };
}
