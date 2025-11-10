# API Boundary Refactor - Coordinate System & ID Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish clear architectural boundaries between frontend and backend with type-safe coordinate conversion and explicit ID management to eliminate systematic bugs in face tagging and bounding box rendering.

**Architecture:** Create a strongly-typed API layer that enforces coordinate system conversions (0-100 UI ↔ 0-1 backend) at the boundary, eliminates UUID confusion by making backend the sole ID authority, and sequences async operations explicitly. Components use only UI types, API client handles all transformations.

**Tech Stack:** TypeScript, React, Vitest/Jest, FastAPI (Python), pytest

**Cost Impact:** ✅ Zero - pure refactor of existing functionality

**Security Impact:** ⚪ Neutral - no security changes

---

## Root Causes Being Fixed

**Issue 1: Coordinate System Confusion**
- Backend uses 0-1 normalized coordinates (standard for CV/ML)
- Frontend historically used 0-100 percentage coordinates (UI convention)
- Conversions scattered across components → inconsistent, buggy
- Result: Bounding boxes render in top-left corner unpredictably

**Issue 2: UUID Generation Conflict**
- Frontend generates placeholder UUIDs for optimistic UI
- Backend ignores them, generates its own
- Frontend uses stale placeholder IDs → 404 errors
- Result: "Create person → tag face" flow broken

**Issue 3: Async Sequencing Unclear**
- Person must exist before face tagging
- React Query mutations not properly sequenced
- Result: Race conditions, infinite re-renders

---

## Prerequisites

### Task 0.1: Clean Up Uncommitted Changes

**Context:** Frontend has uncommitted changes attempting to fix these issues. We'll save them as a reference, then start clean.

**Files:**
- Check: `src/components/Lightbox.tsx`
- Check: `src/pages/CollectionDetail.tsx`
- Check: `src/pages/Index.tsx`

**Step 1: Review uncommitted changes**

```bash
cd /Users/victor.lansman/Documents/Code/lightwell-photos-24257
git diff > docs/uncommitted-changes-reference.patch
```

**Step 2: Stash or commit current state**

Option A (recommended): Commit current state as WIP
```bash
git add -A
git commit -m "WIP: save current state before refactor

Includes partial fixes for:
- handleUpdatePeople returning Promise<string>
- Bbox coordinate conversion in CollectionDetail
- Async/await for person creation

Will be superseded by systematic refactor"
```

Option B: Stash changes
```bash
git stash save "WIP before refactor"
```

**Step 3: Verify clean state**

```bash
git status
```

Expected: "nothing to commit, working tree clean" OR "On branch frontend-azure-integration... clean except for WIP commit"

---

## Phase 1: Type System Foundation

**Goal:** Make coordinate mixing and ID confusion *compile-time errors*, not runtime bugs.

### Task 1.1: Create Coordinate Type System

**Files:**
- Create: `src/types/coordinates.ts`

**Step 1: Define coordinate types**

Create: `src/types/coordinates.ts`
```typescript
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
```

**Step 2: Create coordinate test file**

Create: `src/types/coordinates.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import {
  uiCoord,
  apiCoord,
  uiToApi,
  apiToUi,
  uiBboxToApi,
  apiBboxToUi,
  createUiBbox,
  type UiCoordinate,
  type ApiCoordinate,
} from './coordinates';

describe('Coordinate System', () => {
  describe('uiToApi conversion', () => {
    it('converts 0% to 0.0', () => {
      const ui = uiCoord(0);
      const api = uiToApi(ui);
      expect(api as number).toBe(0.0);
    });

    it('converts 50% to 0.5', () => {
      const ui = uiCoord(50);
      const api = uiToApi(ui);
      expect(api as number).toBe(0.5);
    });

    it('converts 100% to 1.0', () => {
      const ui = uiCoord(100);
      const api = uiToApi(ui);
      expect(api as number).toBe(1.0);
    });

    it('converts 25.5% to 0.255', () => {
      const ui = uiCoord(25.5);
      const api = uiToApi(ui);
      expect(api as number).toBeCloseTo(0.255, 3);
    });
  });

  describe('apiToUi conversion', () => {
    it('converts 0.0 to 0%', () => {
      const api = apiCoord(0.0);
      const ui = apiToUi(api);
      expect(ui as number).toBe(0);
    });

    it('converts 0.5 to 50%', () => {
      const api = apiCoord(0.5);
      const ui = apiToUi(api);
      expect(ui as number).toBe(50);
    });

    it('converts 1.0 to 100%', () => {
      const api = apiCoord(1.0);
      const ui = apiToUi(api);
      expect(ui as number).toBe(100);
    });
  });

  describe('bbox conversion', () => {
    it('converts UI bbox to API bbox', () => {
      const uiBbox = createUiBbox(10, 20, 30, 40);
      const apiBbox = uiBboxToApi(uiBbox);

      expect(apiBbox.x as number).toBeCloseTo(0.1, 3);
      expect(apiBbox.y as number).toBeCloseTo(0.2, 3);
      expect(apiBbox.width as number).toBeCloseTo(0.3, 3);
      expect(apiBbox.height as number).toBeCloseTo(0.4, 3);
    });

    it('converts API bbox to UI bbox', () => {
      const apiBbox = {
        x: apiCoord(0.1),
        y: apiCoord(0.2),
        width: apiCoord(0.3),
        height: apiCoord(0.4),
      };
      const uiBbox = apiBboxToUi(apiBbox);

      expect(uiBbox.x as number).toBeCloseTo(10, 1);
      expect(uiBbox.y as number).toBeCloseTo(20, 1);
      expect(uiBbox.width as number).toBeCloseTo(30, 1);
      expect(uiBbox.height as number).toBeCloseTo(40, 1);
    });

    it('round-trips without loss', () => {
      const original = createUiBbox(25.5, 33.3, 12.8, 19.2);
      const converted = apiBboxToUi(uiBboxToApi(original));

      expect(converted.x as number).toBeCloseTo(original.x as number, 1);
      expect(converted.y as number).toBeCloseTo(original.y as number, 1);
      expect(converted.width as number).toBeCloseTo(original.width as number, 1);
      expect(converted.height as number).toBeCloseTo(original.height as number, 1);
    });
  });

  describe('validation', () => {
    it('throws on API coordinate > 1', () => {
      expect(() => apiCoord(1.5)).toThrow('outside valid range');
    });

    it('throws on API coordinate < 0', () => {
      expect(() => apiCoord(-0.1)).toThrow('outside valid range');
    });

    it('warns on UI coordinate > 100', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      uiCoord(150);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('outside expected range')
      );
      consoleSpy.mockRestore();
    });
  });
});
```

**Step 3: Run coordinate tests**

```bash
cd /Users/victor.lansman/Documents/Code/lightwell-photos-24257
npm test src/types/coordinates.test.ts
```

Expected: All tests PASS (may need to set up vitest if not configured)

If vitest not configured:
```bash
npm install -D vitest
# Add to package.json scripts: "test": "vitest"
```

**Step 4: Commit type system**

```bash
git add src/types/coordinates.ts src/types/coordinates.test.ts
git commit -m "feat: add type-safe coordinate system

- Branded types prevent mixing UI (0-100) and API (0-1) coordinates
- Conversion functions enforce boundaries
- Runtime validation catches out-of-range values
- Comprehensive test coverage

Fixes root cause: coordinate system confusion"
```

---

### Task 1.2: Create ID Type System

**Files:**
- Create: `src/types/identifiers.ts`

**Step 1: Define ID types**

Create: `src/types/identifiers.ts`
```typescript
/**
 * ID type system to prevent UUID confusion.
 *
 * ARCHITECTURE DECISION:
 * - Backend is the SOLE authority for server IDs
 * - Frontend NEVER generates UUIDs for server entities
 * - New entities use null until server responds
 * - No optimistic local IDs (simpler, prevents bugs)
 */

/**
 * Server-generated entity ID (UUID from backend)
 * Never generated by frontend
 */
export type ServerId = string;

/**
 * Person entity with server ID
 */
export interface Person {
  id: ServerId;
  name: string;
  collection_id: ServerId;
}

/**
 * Face tag for a photo
 * person_id is null for unknown/untagged faces
 */
export interface FaceTag {
  person_id: ServerId | null;
  bbox: UiBoundingBox; // Uses UI coordinate type
}

/**
 * Check if a value is a valid non-null server ID
 */
export function isValidServerId(id: unknown): id is ServerId {
  return typeof id === 'string' && id.length > 0;
}

/**
 * Validate server ID or throw
 */
export function requireServerId(id: unknown, context: string): ServerId {
  if (!isValidServerId(id)) {
    throw new Error(`Invalid server ID in ${context}: ${id}`);
  }
  return id;
}
```

**Step 2: Update types to use new ID system**

Modify: `src/types/photo.ts`
```typescript
import { ServerId } from './identifiers';
import { UiBoundingBox } from './coordinates';

export interface FaceDetection {
  personId: ServerId | null;  // Changed from string | null
  personName: string | null;
  boundingBox: UiBoundingBox;  // Will use typed coords
}

export interface Photo {
  id: ServerId;  // Changed from string
  // ... rest of fields
  people: Array<{
    id: ServerId;  // Changed from string
    name: string;
    face_bbox: UiBoundingBox | null;  // Will use typed coords
  }>;
  // ... rest of fields
}
```

**Step 3: Commit ID types**

```bash
git add src/types/identifiers.ts src/types/photo.ts
git commit -m "feat: add type-safe ID system

- ServerId type for backend-generated UUIDs
- Frontend never generates server entity IDs
- Null until server responds (no optimistic IDs)

Fixes root cause: UUID generation conflict"
```

---

## Phase 2: API Client Refactor

**Goal:** Centralize all coordinate conversion and ID handling in API client. Components never see API coordinates or handle conversions.

### Task 2.1: Refactor API Client Types

**Files:**
- Modify: `src/lib/azureApiClient.ts`

**Step 1: Update API client to use new types**

Modify: `src/lib/azureApiClient.ts`

Replace imports:
```typescript
import {
  ServerId,
  Person,
  FaceTag
} from '@/types/identifiers';
import {
  UiBoundingBox,
  ApiBoundingBox,
  uiBboxToApi,
  apiBboxToUi,
  createUiBbox,
  apiCoord,
} from '@/types/coordinates';
```

Replace `FaceBoundingBox` interface with:
```typescript
// Remove old FaceBoundingBox interface, use UiBoundingBox instead
```

Update `Photo` interface:
```typescript
export interface Photo {
  id: ServerId;  // Changed from string
  path: string;
  thumbnail_url: string | null;
  created_at: string;
  title: string | null;
  description: string | null;

  // Year estimation
  display_year: number | null;
  estimated_year: number | null;
  estimated_year_min: number | null;
  estimated_year_max: number | null;
  user_corrected_year: number | null;

  // Filtering
  tags: string[];
  people: Array<{
    id: ServerId;  // Changed from string
    name: string;
    face_bbox: UiBoundingBox | null;  // Changed to use typed coords
  }>;
  is_favorite: boolean;

  width: number | null;
  height: number | null;
  rotation: number;
}
```

**Step 2: Update face tagging types**

Replace in `src/lib/azureApiClient.ts`:
```typescript
// Remove old FaceTag interface, import from types instead

export interface UpdateFacesRequest {
  faces: FaceTag[];  // Uses imported type
}

export interface FaceTagResponse {
  id: ServerId;  // Changed from string
  person_id: ServerId | null;  // Changed from string | null
  bbox: UiBoundingBox;  // Uses UI coordinates
}

export interface UpdateFacesResponse {
  photo_id: ServerId;  // Changed from string
  faces: FaceTagResponse[];
}
```

**Step 3: Update person types**

Replace in `src/lib/azureApiClient.ts`:
```typescript
export interface CreatePersonRequest {
  name: string;
  collection_id: ServerId;  // Changed from string
}

export interface UpdatePersonRequest {
  name: string;
}

export interface PersonResponse {
  id: ServerId;  // Changed from string
  name: string;
  collection_id: ServerId;  // Changed from string
  thumbnail_url: string | null;
}
```

**Step 4: Commit type updates**

```bash
git add src/lib/azureApiClient.ts
git commit -m "refactor: update API client to use typed IDs and coordinates

- Replace string IDs with ServerId type
- Replace raw number coords with UiBoundingBox type
- Preparation for coordinate conversion refactor"
```

---

### Task 2.2: Fix API Client Coordinate Conversion

**Files:**
- Modify: `src/lib/azureApiClient.ts` (updatePhotoFaces method)

**Step 1: Update getCollectionPhotos to convert coordinates**

Modify: `src/lib/azureApiClient.ts` - `getCollectionPhotos` method

Replace the method (around line 194-211):
```typescript
async getCollectionPhotos(
  collectionId: string,
  filters?: PhotoFilters
): Promise<Photo[]> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.person_id) params.append('person_id', filters.person_id);
    if (filters.year_min) params.append('year_min', filters.year_min.toString());
    if (filters.year_max) params.append('year_max', filters.year_max.toString());
    if (filters.tags) params.append('tags', filters.tags);
    if (filters.favorite !== undefined) params.append('favorite', filters.favorite.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.cursor) params.append('cursor', filters.cursor);
  }

  const query = params.toString();
  const endpoint = `/v1/collections/${collectionId}/photos${query ? `?${query}` : ''}`;

  const photos = await this.request<Photo[]>(endpoint);

  // COORDINATE CONVERSION: API (0-1) → UI (0-100)
  // Backend returns 0-1 normalized, transform to UI coordinates
  return photos.map(photo => ({
    ...photo,
    people: photo.people.map(person => ({
      ...person,
      face_bbox: person.face_bbox
        ? apiBboxToUi({
            x: apiCoord(person.face_bbox.x as any),
            y: apiCoord(person.face_bbox.y as any),
            width: apiCoord(person.face_bbox.width as any),
            height: apiCoord(person.face_bbox.height as any),
          })
        : null,
    })),
  }));
}
```

**Step 2: Update updatePhotoFaces to convert coordinates**

Modify: `src/lib/azureApiClient.ts` - `updatePhotoFaces` method

Replace the method (around line 298-317):
```typescript
async updatePhotoFaces(
  photoId: ServerId,
  faces: FaceTag[]
): Promise<UpdateFacesResponse> {
  // COORDINATE CONVERSION: UI (0-100) → API (0-1)
  // Components use UI coords, backend expects 0-1 normalized
  const normalizedFaces = faces.map(face => ({
    person_id: face.person_id,
    bbox: uiBboxToApi(face.bbox),
  }));

  const response = await this.request<any>(`/v1/photos/${photoId}/faces`, {
    method: 'POST',
    body: JSON.stringify({ faces: normalizedFaces }),
  });

  // COORDINATE CONVERSION: API (0-1) → UI (0-100)
  // Transform response back to UI coordinates
  return {
    photo_id: response.photo_id,
    faces: response.faces.map((face: any) => ({
      id: face.id,
      person_id: face.person_id,
      bbox: apiBboxToUi({
        x: apiCoord(face.bbox.x),
        y: apiCoord(face.bbox.y),
        width: apiCoord(face.bbox.width),
        height: apiCoord(face.bbox.height),
      }),
    })),
  };
}
```

**Step 3: Commit coordinate conversion**

```bash
git add src/lib/azureApiClient.ts
git commit -m "fix: centralize coordinate conversion in API client

- Convert API coords (0-1) to UI coords (0-100) in getCollectionPhotos
- Convert UI coords (0-100) to API coords (0-1) in updatePhotoFaces
- All coordinate conversion now happens at API boundary
- Components never see 0-1 coordinates

Fixes: bounding boxes rendering in top-left corner"
```

---

### Task 2.3: Add Person Creation Helper

**Files:**
- Modify: `src/lib/azureApiClient.ts`

**Step 1: Add createPersonAndReturnId method**

Add to `src/lib/azureApiClient.ts` (in the People Management section, after updatePerson):

```typescript
/**
 * Create person and return server-generated ID.
 *
 * ARCHITECTURE: Backend is sole authority for IDs.
 * This helper makes the pattern explicit: create → get server ID → use it.
 *
 * @returns Server-generated person ID (for immediate use in face tagging)
 */
async createPersonAndReturnId(
  name: string,
  collectionId: ServerId
): Promise<ServerId> {
  const response = await this.createPerson({
    name,
    collection_id: collectionId,
  });

  return response.id;
}

/**
 * Create person, tag face, update photo in single operation.
 *
 * ARCHITECTURE: Sequences async operations explicitly.
 * Eliminates race conditions by forcing order:
 * 1. Create person (if new)
 * 2. Wait for server ID
 * 3. Tag face with server ID
 * 4. Return result
 *
 * @param photoId - Photo to tag
 * @param personName - Person name (creates new if doesn't exist)
 * @param bbox - Face bounding box in UI coordinates (0-100)
 * @param collectionId - Collection ID (for person creation)
 * @param existingPersonId - If provided, uses existing person instead of creating
 */
async tagFaceWithPerson(params: {
  photoId: ServerId;
  personName: string;
  bbox: UiBoundingBox;
  collectionId: ServerId;
  existingPersonId?: ServerId;
}): Promise<{
  personId: ServerId;
  updatedFaces: FaceTagResponse[];
}> {
  // Step 1: Get or create person
  const personId = params.existingPersonId
    || await this.createPersonAndReturnId(params.personName, params.collectionId);

  // Step 2: Update faces with server ID
  const faceTag: FaceTag = {
    person_id: personId,
    bbox: params.bbox,
  };

  const response = await this.updatePhotoFaces(params.photoId, [faceTag]);

  // Step 3: Return server ID and updated faces
  return {
    personId,
    updatedFaces: response.faces,
  };
}
```

**Step 2: Add integration test for helper**

Create: `src/lib/azureApiClient.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AzureApiClient } from './azureApiClient';
import { createUiBbox } from '@/types/coordinates';

// Mock fetch globally
global.fetch = vi.fn();

describe('AzureApiClient', () => {
  let client: AzureApiClient;

  beforeEach(() => {
    client = new AzureApiClient('http://test.api');
    client.setToken('test-token');
    vi.clearAllMocks();
  });

  describe('tagFaceWithPerson', () => {
    it('creates person and tags face in sequence', async () => {
      // Mock POST /v1/people response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'server-person-id-123',
          name: 'John Doe',
          collection_id: 'coll-456',
        }),
      });

      // Mock POST /v1/photos/{id}/faces response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          photo_id: 'photo-789',
          faces: [{
            id: 'face-abc',
            person_id: 'server-person-id-123',
            bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          }],
        }),
      });

      const result = await client.tagFaceWithPerson({
        photoId: 'photo-789',
        personName: 'John Doe',
        bbox: createUiBbox(10, 20, 30, 40),
        collectionId: 'coll-456',
      });

      // Verify person creation called first
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'http://test.api/v1/people',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'John Doe',
            collection_id: 'coll-456',
          }),
        })
      );

      // Verify face tagging called second with SERVER ID
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://test.api/v1/photos/photo-789/faces',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('server-person-id-123'),
        })
      );

      // Verify coordinates converted to 0-1 in request
      const secondCall = (global.fetch as any).mock.calls[1];
      const requestBody = JSON.parse(secondCall[1].body);
      expect(requestBody.faces[0].bbox.x).toBeCloseTo(0.1, 3);
      expect(requestBody.faces[0].bbox.y).toBeCloseTo(0.2, 3);

      // Verify result
      expect(result.personId).toBe('server-person-id-123');
      expect(result.updatedFaces).toHaveLength(1);

      // Verify coordinates converted back to 0-100 in response
      expect(result.updatedFaces[0].bbox.x as number).toBeCloseTo(10, 1);
      expect(result.updatedFaces[0].bbox.y as number).toBeCloseTo(20, 1);
    });

    it('uses existing person ID if provided', async () => {
      // Mock only face tagging (no person creation)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          photo_id: 'photo-789',
          faces: [{
            id: 'face-abc',
            person_id: 'existing-person-id',
            bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
          }],
        }),
      });

      await client.tagFaceWithPerson({
        photoId: 'photo-789',
        personName: 'Jane Doe',
        bbox: createUiBbox(50, 50, 10, 10),
        collectionId: 'coll-456',
        existingPersonId: 'existing-person-id',
      });

      // Should only call face tagging, NOT person creation
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/faces'),
        expect.anything()
      );
    });
  });
});
```

**Step 3: Run API client tests**

```bash
npm test src/lib/azureApiClient.test.ts
```

Expected: All tests PASS

**Step 4: Commit helper method**

```bash
git add src/lib/azureApiClient.ts src/lib/azureApiClient.test.ts
git commit -m "feat: add tagFaceWithPerson helper to sequence operations

- Explicitly sequences: create person → get ID → tag face
- Eliminates race conditions and UUID confusion
- Single method for common workflow
- Comprehensive integration tests

Fixes: person creation → face tagging flow"
```

---

## Phase 3: Component Cleanup

**Goal:** Remove all coordinate conversion and ID generation from components. Use API client helpers exclusively.

### Task 3.1: Simplify Lightbox Component

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Step 1: Update Lightbox prop types**

Modify: `src/components/Lightbox.tsx`

Update imports:
```typescript
import { ServerId } from '@/types/identifiers';
import { UiBoundingBox, createUiBbox } from '@/types/coordinates';
import { azureApi } from '@/lib/azureApiClient';
```

Update props interface:
```typescript
interface LightboxProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFavorite?: (photoId: ServerId) => void;
  onUpdateFaces?: (photoId: ServerId) => Promise<void>;  // Simplified
  onPersonCreated?: (personId: ServerId, name: string) => void;  // New callback
  allPeople?: PersonCluster[];
  collectionId: ServerId;  // Required for person creation
}
```

**Step 2: Simplify handleNamePerson**

Replace handleNamePerson method:
```typescript
const handleNamePerson = async () => {
  if (!personToName || !newPersonName.trim() || !photo) return;

  try {
    setIsSaving(true);

    // Use API helper - handles sequencing automatically
    const result = await azureApi.tagFaceWithPerson({
      photoId: photo.id,
      personName: newPersonName.trim(),
      bbox: personToName.boundingBox,  // Already in UI coords (0-100)
      collectionId: collectionId,
    });

    // Update local state with server ID
    setFaces(prevFaces =>
      prevFaces.map(f =>
        f === personToName
          ? { ...f, personId: result.personId, personName: newPersonName.trim() }
          : f
      )
    );

    // Notify parent of new person (for people list refresh)
    onPersonCreated?.(result.personId, newPersonName.trim());

    // Refresh photo to get updated faces from server
    if (onUpdateFaces) {
      await onUpdateFaces(photo.id);
    }

    toast.success(`Created ${newPersonName.trim()}`);
    setShowNamingDialog(false);
    setNewPersonName('');
    setPersonToName(null);
  } catch (error) {
    console.error('Failed to create person:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to create person');
  } finally {
    setIsSaving(false);
  }
};
```

**Step 3: Simplify handleSelectPerson**

Replace handleSelectPerson method:
```typescript
const handleSelectPerson = async (personId: ServerId, personName: string | null) => {
  if (!editingFace || !photo) return;

  const targetPerson = allPeople?.find(p => p.id === personId);

  // If target person is unnamed, trigger naming dialog
  if (targetPerson && targetPerson.name === null) {
    setPersonToName({ ...editingFace, personId, personName });
    setShowNamingDialog(true);
    setEditingFace(null);
    return;
  }

  try {
    setIsSaving(true);

    // Use API helper with existing person ID
    const result = await azureApi.tagFaceWithPerson({
      photoId: photo.id,
      personName: personName || 'Unknown',
      bbox: editingFace.boundingBox,  // Already in UI coords
      collectionId: collectionId,
      existingPersonId: personId,  // Use existing person
    });

    // Update local state
    setFaces(prevFaces =>
      prevFaces.map(f =>
        f === editingFace
          ? { ...f, personId: result.personId, personName }
          : f
      )
    );

    // Refresh photo
    if (onUpdateFaces) {
      await onUpdateFaces(photo.id);
    }

    toast.success(`Reassigned to ${personName || 'Unknown'}`);
    setEditingFace(null);
  } catch (error) {
    console.error('Failed to reassign person:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to reassign');
  } finally {
    setIsSaving(false);
  }
};
```

**Step 4: Remove coordinate conversions**

Search Lightbox.tsx for any remaining coordinate conversions:
- Remove any `* 100` or `/ 100` operations
- Ensure all bbox usage is `UiBoundingBox` type
- Remove any `crypto.randomUUID()` calls for persons

**Step 5: Commit Lightbox cleanup**

```bash
git add src/components/Lightbox.tsx
git commit -m "refactor: simplify Lightbox to use API helpers

- Remove manual UUID generation
- Remove coordinate conversions (handled by API client)
- Use tagFaceWithPerson helper for sequenced operations
- Add collectionId prop (required for person creation)
- Add onPersonCreated callback (for UI refresh)

Components now use clean, high-level API"
```

---

### Task 3.2: Simplify CollectionDetail Page

**Files:**
- Modify: `src/pages/CollectionDetail.tsx`

**Step 1: Remove coordinate conversions from photo mapping**

Modify: `src/pages/CollectionDetail.tsx`

Find the `convertToPhotoType` function (around line 60-100) and remove coordinate conversion:

```typescript
const convertToPhotoType = (azurePhoto: AzurePhoto): Photo => {
  // Convert people array to faces
  const faces: FaceDetection[] = azurePhoto.people.map(person => ({
    personId: person.id,
    personName: person.name,
    // Coordinates already in UI format (0-100) from API client
    boundingBox: person.face_bbox || createUiBbox(0, 0, 10, 10),
  }));

  return {
    id: azurePhoto.id,
    filename: azurePhoto.path.split('/').pop() || azurePhoto.path,
    path: azurePhoto.path,
    thumbnail_url: azurePhoto.thumbnail_url,
    original_filename: azurePhoto.path.split('/').pop() || null,
    created_at: azurePhoto.created_at,
    is_favorite: azurePhoto.is_favorite,
    title: azurePhoto.title,
    description: azurePhoto.description,
    width: azurePhoto.width,
    height: azurePhoto.height,
    rotation: azurePhoto.rotation,
    estimated_year: azurePhoto.estimated_year,
    user_corrected_year: azurePhoto.user_corrected_year,
    tags: azurePhoto.tags,
    people: azurePhoto.people,
    faces,
    taken_at: null,
  };
};
```

**Step 2: Remove handleUpdatePeople method entirely**

Delete the `handleUpdatePeople` method - no longer needed with API helper.

**Step 3: Add handlePersonCreated callback**

Add new callback:
```typescript
const handlePersonCreated = (personId: ServerId, name: string) => {
  // Refresh photos to get updated people list
  // React Query will handle deduplication
  queryClient.invalidateQueries(['collection-photos', id]);
};
```

**Step 4: Update Lightbox props**

Update Lightbox component usage:
```typescript
<Lightbox
  photo={lightboxPhoto}
  isOpen={!!lightboxPhoto}
  onClose={() => setLightboxPhoto(null)}
  onPrevious={handlePreviousPhoto}
  onNext={handleNextPhoto}
  onToggleFavorite={handleToggleFavorite}
  onUpdateFaces={handleUpdateFaces}
  onPersonCreated={handlePersonCreated}  // New
  allPeople={allPeople}
  collectionId={id!}  // Pass collection ID
/>
```

**Step 5: Commit CollectionDetail cleanup**

```bash
git add src/pages/CollectionDetail.tsx
git commit -m "refactor: remove coordinate conversion from CollectionDetail

- API client now returns photos with UI coordinates
- Remove handleUpdatePeople (use API helper in Lightbox)
- Add handlePersonCreated callback
- Pass collectionId to Lightbox

All coordinate handling now in API client"
```

---

### Task 3.3: Simplify Index Page

**Files:**
- Modify: `src/pages/Index.tsx`

**Step 1: Remove coordinate conversion from photo mapping**

Modify: `src/pages/Index.tsx`

Similar to CollectionDetail, find photo conversion (around line 60) and remove coordinate conversion:

```typescript
const photos: Photo[] = recentPhotos.map(photo => ({
  // ... existing fields
  faces: photo.people.map(person => ({
    personId: person.id,
    personName: person.name,
    // Coordinates already in UI format from API client
    boundingBox: person.face_bbox || createUiBbox(0, 0, 10, 10),
  })),
  // ... rest of mapping
}));
```

**Step 2: Remove handleUpdatePeople method**

Delete the entire `handleUpdatePeople` method.

**Step 3: Update Lightbox usage**

Similar to CollectionDetail, update Lightbox props.

**Step 4: Commit Index cleanup**

```bash
git add src/pages/Index.tsx
git commit -m "refactor: remove coordinate conversion from Index page

- Use API client's coordinate-converted photos
- Remove handleUpdatePeople
- Consistent with CollectionDetail pattern"
```

---

## Phase 4: Testing Infrastructure

**Goal:** Add integration tests to prevent regression of these issues.

### Task 4.1: Add E2E Test for Person Tagging Flow

**Files:**
- Create: `e2e/person-tagging.spec.ts` (if using Playwright)
- Or: `cypress/e2e/person-tagging.cy.ts` (if using Cypress)

**Step 1: Create E2E test**

Create: `e2e/person-tagging.spec.ts` (Playwright example)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Person Tagging Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to collection with photos
    await page.goto('/login');
    // ... login steps
    await page.goto('/collections/test-collection-id');
  });

  test('create person and tag face shows bbox correctly', async ({ page }) => {
    // Open photo lightbox
    await page.click('[data-testid="photo-card"]:first-child');

    // Wait for photo to load
    await expect(page.locator('[data-testid="lightbox-image"]')).toBeVisible();

    // Enter face tagging mode
    await page.click('[data-testid="tag-faces-button"]');

    // Draw bounding box (simulated - actual implementation depends on UI)
    const image = page.locator('[data-testid="lightbox-image"]');
    const box = await image.boundingBox();
    await page.mouse.move(box!.x + 100, box!.y + 100);
    await page.mouse.down();
    await page.mouse.move(box!.x + 200, box!.y + 200);
    await page.mouse.up();

    // Enter person name
    await page.fill('[data-testid="person-name-input"]', 'John Doe');
    await page.click('[data-testid="save-person-button"]');

    // Wait for API calls
    await page.waitForResponse(resp =>
      resp.url().includes('/v1/people') && resp.status() === 201
    );
    await page.waitForResponse(resp =>
      resp.url().includes('/faces') && resp.status() === 200
    );

    // Verify bbox rendered correctly (NOT in top-left corner)
    const bbox = page.locator('[data-testid="face-bbox"]:first-child');
    await expect(bbox).toBeVisible();

    const bboxPosition = await bbox.boundingBox();
    // Should NOT be at (0, 0) or (0-10%, 0-10%)
    expect(bboxPosition!.x).toBeGreaterThan(box!.x + 50);
    expect(bboxPosition!.y).toBeGreaterThan(box!.y + 50);

    // Verify person appears in people list
    await page.click('[data-testid="people-tab"]');
    await expect(page.locator('text=John Doe')).toBeVisible();
  });

  test('reassign face to existing person', async ({ page }) => {
    // Assumes "Jane Doe" already exists in collection

    // Open photo, tag face mode
    await page.click('[data-testid="photo-card"]:first-child');
    await page.click('[data-testid="tag-faces-button"]');

    // Draw bbox
    // ... (similar to above)

    // Select existing person
    await page.click('[data-testid="select-existing-person"]');
    await page.click('text=Jane Doe');

    // Wait for face tagging API
    await page.waitForResponse(resp =>
      resp.url().includes('/faces') && resp.status() === 200
    );

    // Should NOT call person creation API
    const personCreationCall = page.waitForResponse(
      resp => resp.url().includes('/v1/people'),
      { timeout: 1000 }
    ).catch(() => null);

    expect(await personCreationCall).toBeNull();

    // Verify bbox positioned correctly
    const bbox = page.locator('[data-testid="face-bbox"]:first-child');
    await expect(bbox).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

```bash
npx playwright test e2e/person-tagging.spec.ts
```

Expected: Tests PASS (may need backend running on localhost:8000)

**Step 3: Commit E2E tests**

```bash
git add e2e/person-tagging.spec.ts
git commit -m "test: add E2E tests for person tagging flow

- Test create person → tag face → bbox renders correctly
- Test reassign face to existing person
- Prevent regression of coordinate and ID bugs"
```

---

### Task 4.2: Add Backend Integration Tests

**Files:**
- Check: `backend/tests/routers/test_photos_v2.py`
- Check: `backend/tests/routers/test_people.py`

**Step 1: Verify backend tests for coordinate validation**

Check if `backend/tests/routers/test_photos_v2.py` exists and has tests for:
- POST /v1/photos/{id}/faces accepts 0-1 coordinates
- POST /v1/photos/{id}/faces rejects coordinates outside 0-1
- POST /v1/photos/{id}/faces validates person_id exists

If missing, add:

```python
def test_update_faces_validates_coordinates(test_db, auth_headers, sample_photo):
    """Test that bbox coordinates must be in [0, 1] range"""
    # Invalid: x > 1
    response = client.post(
        f"/v1/photos/{sample_photo.id}/faces",
        headers=auth_headers,
        json={
            "faces": [{
                "person_id": None,
                "bbox": {"x": 1.5, "y": 0.5, "width": 0.1, "height": 0.1}
            }]
        }
    )
    assert response.status_code == 422  # Validation error

    # Invalid: negative coordinate
    response = client.post(
        f"/v1/photos/{sample_photo.id}/faces",
        headers=auth_headers,
        json={
            "faces": [{
                "person_id": None,
                "bbox": {"x": -0.1, "y": 0.5, "width": 0.1, "height": 0.1}
            }]
        }
    )
    assert response.status_code == 422

def test_update_faces_validates_person_exists(test_db, auth_headers, sample_photo):
    """Test that person_id must exist if provided"""
    fake_person_id = str(uuid.uuid4())

    response = client.post(
        f"/v1/photos/{sample_photo.id}/faces",
        headers=auth_headers,
        json={
            "faces": [{
                "person_id": fake_person_id,
                "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4}
            }]
        }
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
```

**Step 2: Run backend tests**

```bash
cd /Users/victor.lansman/Documents/Code/image-annotation-tool/backend
pytest tests/routers/test_photos_v2.py -v
pytest tests/routers/test_people.py -v
```

Expected: All tests PASS

**Step 3: Commit backend test improvements**

```bash
cd /Users/victor.lansman/Documents/Code/image-annotation-tool/backend
git add tests/routers/test_photos_v2.py
git commit -m "test: add coordinate validation tests

- Verify bbox coordinates must be in [0, 1] range
- Verify person_id validation on face tagging
- Prevent regression of coordinate system bugs"
```

---

## Phase 5: Documentation & Verification

### Task 5.1: Document Architecture Decisions

**Files:**
- Create: `docs/architecture/adr-001-coordinate-system.md`
- Create: `docs/architecture/adr-002-id-generation.md`

**Step 1: Document coordinate system ADR**

Create: `docs/architecture/adr-001-coordinate-system.md`
```markdown
# ADR-001: Coordinate System for Face Bounding Boxes

**Status:** Accepted
**Date:** 2025-01-11
**Context:** Face bounding boxes were rendering incorrectly due to inconsistent coordinate systems.

## Decision

Frontend uses 0-100 percentage coordinates, backend uses 0-1 normalized coordinates.

**Conversion happens ONLY at API client boundary:**
- `azureApiClient.ts` converts 0-100 → 0-1 when sending to backend
- `azureApiClient.ts` converts 0-1 → 0-100 when receiving from backend
- Components NEVER see 0-1 coordinates
- Components NEVER perform conversions

**Type system enforces this:**
- `UiCoordinate` branded type for frontend (0-100)
- `ApiCoordinate` branded type for API layer (0-1)
- TypeScript prevents mixing via branded types

## Rationale

**Why different systems?**
- Backend (0-1): Standard in ML/CV libraries, matches Azure Face API
- Frontend (0-100): Natural for CSS percentages, intuitive for UI developers

**Why boundary conversion?**
- Single point of conversion = no missed conversions
- Type safety prevents accidental mixing
- Easy to test and verify

## Consequences

**Positive:**
- Impossible to mix coordinate systems (compile error)
- All conversion logic centralized and tested
- Components simpler (no conversion logic)

**Negative:**
- Additional types to learn
- Need to cast when using typed coordinates as numbers

## Implementation

See: `src/types/coordinates.ts`, `src/lib/azureApiClient.ts`
```

**Step 2: Document ID generation ADR**

Create: `docs/architecture/adr-002-id-generation.md`
```markdown
# ADR-002: ID Generation Authority

**Status:** Accepted
**Date:** 2025-01-11
**Context:** Frontend generated placeholder UUIDs that backend ignored, causing 404 errors.

## Decision

Backend is the SOLE authority for entity IDs.

**Frontend NEVER generates server entity IDs:**
- No `crypto.randomUUID()` for Person, Photo, Collection, etc.
- New entities use `null` ID until server responds
- No optimistic local IDs

**Async operations are sequenced explicitly:**
- Create person → await server ID → use for face tagging
- Helper methods enforce correct sequence
- Components use high-level helpers, not direct API calls

## Rationale

**Why backend authority?**
- Backend owns the database
- Backend enforces uniqueness constraints
- Backend may use non-UUID ID formats in future
- Avoids frontend/backend ID sync issues

**Why no optimistic IDs?**
- Simpler to reason about
- No mapping logic needed (temp → server ID)
- Clearer when operations fail
- Worth the slight UX delay (100-200ms network call)

## Consequences

**Positive:**
- No UUID confusion or stale ID bugs
- Clear ownership and error handling
- Simpler component logic

**Negative:**
- Cannot show entity in UI until server responds
- Small delay in optimistic UI updates

**Mitigation:**
- Show loading states during creation
- Use helper methods that sequence operations

## Implementation

See: `src/types/identifiers.ts`, `src/lib/azureApiClient.ts` (tagFaceWithPerson)
```

**Step 3: Commit ADRs**

```bash
git add docs/architecture/
git commit -m "docs: add ADRs for coordinate system and ID generation

- ADR-001: Coordinate system conversion at API boundary
- ADR-002: Backend as sole authority for entity IDs

Prevents future regressions by documenting decisions"
```

---

### Task 5.2: Update README with Testing Instructions

**Files:**
- Modify: `README.md`

**Step 1: Add testing section**

Add to `README.md`:
```markdown
## Testing

### Unit Tests

Run frontend unit tests:
```bash
npm test
```

Key test files:
- `src/types/coordinates.test.ts` - Coordinate conversion
- `src/lib/azureApiClient.test.ts` - API client integration

### Backend Tests

Run backend tests:
```bash
cd backend
pytest -v
```

### E2E Tests

Run end-to-end tests:
```bash
# Start backend on localhost:8000
cd backend
uvicorn src.backend.main:app --reload

# Start frontend on localhost:8080
npm run dev

# Run E2E tests
npx playwright test
```

### Manual Testing Checklist

**Person Tagging Flow:**
1. Login and open collection with photos
2. Click photo to open lightbox
3. Click "Tag Faces" button
4. Draw bounding box on face (drag to create box)
5. Enter person name "Test Person"
6. Save
7. **Verify:**
   - Bbox renders at correct position (NOT top-left corner)
   - Person appears in people list
   - Refreshing page shows bbox still correct
   - Network tab shows: POST /v1/people → POST /v1/photos/{id}/faces

**Reassign Face:**
1. Open photo with tagged face
2. Click on existing face bbox
3. Select different person from list
4. **Verify:**
   - Bbox repositioned/person changed
   - No 404 errors in console
   - Network tab shows: POST /v1/photos/{id}/faces (NOT person creation)
```

**Step 2: Commit README**

```bash
git add README.md
git commit -m "docs: add comprehensive testing instructions

- Unit test commands
- E2E test setup
- Manual testing checklist for person tagging
- Verification steps to prevent regressions"
```

---

### Task 5.3: Final Verification

**Files:**
- None (manual testing)

**Step 1: Run all automated tests**

```bash
# Frontend unit tests
npm test

# Backend tests
cd /Users/victor.lansman/Documents/Code/image-annotation-tool/backend
pytest -v

# E2E tests (requires services running)
cd /Users/victor.lansman/Documents/Code/lightwell-photos-24257
npx playwright test
```

Expected: All tests PASS

**Step 2: Manual smoke test**

Follow the manual testing checklist from README:
1. Create new person via face tagging
2. Verify bbox renders correctly (not top-left)
3. Tag another face with existing person
4. Verify no 404 errors
5. Refresh page, verify bbox still correct

**Step 3: Check for any remaining issues**

Search codebase for anti-patterns:
```bash
# Should return NO results (or only in test files):
cd /Users/victor.lansman/Documents/Code/lightwell-photos-24257

# No coordinate conversions outside API client
git grep "* 100" src/ --exclude="*.test.ts" --exclude-dir=lib

git grep "/ 100" src/ --exclude="*.test.ts" --exclude-dir=lib

# No crypto.randomUUID for persons
git grep "crypto.randomUUID" src/ --exclude="*.test.ts"
```

**Step 4: Create verification summary**

Create: `docs/refactor-verification.md`
```markdown
# API Boundary Refactor - Verification Summary

**Date:** 2025-01-11

## Tests Run

✅ Frontend unit tests: PASS
✅ Backend integration tests: PASS
✅ E2E person tagging test: PASS
✅ Manual smoke test: PASS

## Issues Fixed

✅ Bounding boxes render at correct position (not top-left)
✅ Person creation → face tagging flow works
✅ No 404 errors on person IDs
✅ Coordinate conversions centralized in API client
✅ ID generation authority clear (backend only)

## Code Quality

✅ No coordinate conversions in components
✅ No UUID generation for server entities in components
✅ Type system prevents mixing coordinate systems
✅ All conversions tested

## Documentation

✅ ADR-001: Coordinate system
✅ ADR-002: ID generation
✅ README testing instructions
✅ Code comments at boundaries

## Remaining Work

None - refactor complete.

## Monitoring

Watch for:
- Any new coordinate conversion bugs (check logs for validation errors)
- Race conditions in person creation (should be eliminated)
- Performance of bbox rendering (caching may be needed later)
```

**Step 5: Final commit**

```bash
git add docs/refactor-verification.md
git commit -m "docs: add refactor verification summary

All tests passing, issues fixed, ready for production"
```

---

## Completion Checklist

**Phase 0: Prerequisites**
- [ ] Uncommitted changes saved as reference
- [ ] Clean working tree on frontend-azure-integration branch

**Phase 1: Type System**
- [ ] Coordinate types created (UiCoordinate, ApiCoordinate)
- [ ] Coordinate conversion functions tested
- [ ] ID types created (ServerId)
- [ ] Type system committed

**Phase 2: API Client**
- [ ] API client updated to use typed coordinates and IDs
- [ ] Coordinate conversion centralized in API client
- [ ] Person creation helper added (tagFaceWithPerson)
- [ ] API client integration tests pass

**Phase 3: Components**
- [ ] Lightbox simplified (no conversions, no UUID gen)
- [ ] CollectionDetail simplified
- [ ] Index page simplified
- [ ] All coordinate conversions removed from components

**Phase 4: Testing**
- [ ] E2E test for person tagging flow
- [ ] Backend validation tests added
- [ ] All tests passing

**Phase 5: Documentation**
- [ ] ADR-001 (coordinates) documented
- [ ] ADR-002 (IDs) documented
- [ ] README testing section added
- [ ] Verification summary created

**Final Verification**
- [ ] All automated tests pass
- [ ] Manual smoke test successful
- [ ] No anti-patterns in codebase
- [ ] Ready for production

---

## Summary

**What This Refactor Fixes:**

1. ✅ **Bounding boxes in top-left corner** - Coordinate conversion now centralized at API boundary, type system prevents mixing
2. ✅ **Person creation → 404 errors** - Backend is ID authority, operations explicitly sequenced
3. ✅ **Race conditions in async operations** - Helper methods enforce correct sequence

**Architecture After This Refactor:**

- **Type Safety:** Branded types prevent coordinate/ID mixing at compile time
- **Clear Boundaries:** API client is sole conversion point
- **Explicit Sequencing:** Helper methods make async dependencies clear
- **Comprehensive Tests:** Unit, integration, and E2E tests prevent regressions

**Estimated Time:** 6-8 hours for complete refactor + testing

**Dependencies:**
- Frontend: TypeScript, Vitest (or Jest), Playwright (or Cypress)
- Backend: pytest, running on localhost:8000

**Follow-up:** After merge, monitor production for:
- Coordinate validation errors (should be zero)
- Person creation latency (may want caching later)
- Bbox rendering performance (may want image caching)

---

## Unresolved Questions

1. **Testing framework:** Does frontend use Vitest, Jest, or other? (Plan assumes Vitest)
2. **E2E framework:** Playwright, Cypress, or other? (Plan assumes Playwright)
3. **Deployment:** Should we merge to main immediately or additional review needed?
4. **Performance:** Bbox rendering acceptable or need thumbnail caching?
