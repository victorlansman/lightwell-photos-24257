# WebP Derivatives API Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace runtime-resized JPEGs with pre-computed WebP derivatives for all images (photos + faces).

**Architecture:** Single unified pattern for image fetching. Photos use `/v1/photos/{id}/derivative/{version}/{size}`, faces use `/v1/faces/{id}/derivative/{version}/{size}`. No fallback logic, no CSS cropping, no legacy endpoints.

**Tech Stack:** React, TypeScript, TanStack Query, Azure API

---

## Task 1: Add Derivative Types and Methods to API Client

**Files:**
- Modify: `src/lib/azureApiClient.ts`

**Step 1: Add derivative type definitions**

Add after line 144 (after `YearEstimationUpdate` interface):

```typescript
// ==================== Derivative Types ====================

export type DerivativeVersion = 'default';  // Future: 'restored' | 'colorized'
export type PhotoDerivativeSize = 'thumb_400' | 'web_2048';
export type FaceDerivativeSize = 'thumb_384';

export interface DerivativeSpec {
  version: DerivativeVersion;
  size: PhotoDerivativeSize | FaceDerivativeSize;
}
```

**Step 2: Update Photo interface**

In the `Photo` interface (around line 90), add:

```typescript
  derivatives_ready: boolean;
```

**Step 3: Update PersonResponse interface**

Replace `thumbnail_url` and `thumbnail_bbox` in `PersonResponse` (around line 184):

```typescript
export interface PersonResponse {
  id: ServerId;
  name: string;
  collection_id: ServerId;
  representative_face_id: ServerId | null;  // CHANGED: was thumbnail_url + thumbnail_bbox
  photo_count: number;
}
```

**Step 4: Update FaceClusterResponse interface**

Replace `representative_thumbnail_url` in `FaceClusterResponse` (around line 201):

```typescript
export interface FaceClusterResponse {
  id: ServerId;
  collection_id: ServerId;
  face_count: number;
  confidence: number;
  representative_face_id: ServerId;  // CHANGED: was representative_thumbnail_url
  faces: ClusterFace[];
}
```

**Step 5: Add fetchPhotoDerivative method**

Add after `fetchPhoto` method (after line 481):

```typescript
  /**
   * Fetch photo derivative (WebP thumbnail or viewing size).
   * Use this for galleries and lightbox viewing.
   */
  async fetchPhotoDerivative(
    photoId: string,
    version: DerivativeVersion = 'default',
    size: PhotoDerivativeSize,
    options?: { abortSignal?: AbortSignal }
  ): Promise<Blob> {
    const endpoint = `/v1/photos/${photoId}/derivative/${version}/${size}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.blob();
  }

  /**
   * Fetch face derivative (pre-cropped WebP thumbnail).
   * Use this for person/cluster avatars.
   */
  async fetchFaceDerivative(
    faceId: string,
    version: DerivativeVersion = 'default',
    size: FaceDerivativeSize = 'thumb_384'
  ): Promise<Blob> {
    const endpoint = `/v1/faces/${faceId}/derivative/${version}/${size}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.blob();
  }
```

**Step 6: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -50`

Expected: Type errors in files that use old interfaces (this is expected, we'll fix them next)

**Step 7: Commit**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add derivative types and fetch methods to API client"
```

---

## Task 2: Update PersonCluster Type

**Files:**
- Modify: `src/types/person.ts`

**Step 1: Simplify PersonCluster interface**

Replace entire file:

```typescript
export interface PersonCluster {
  id: string;
  name: string | null;
  representativeFaceId: string | null;  // CHANGED: was thumbnailPath + thumbnailBbox
  photoCount: number;
  photos: string[];
}
```

**Step 2: Commit**

```bash
git add src/types/person.ts
git commit -m "feat: simplify PersonCluster to use representativeFaceId"
```

---

## Task 3: Update usePeople Hook

**Files:**
- Modify: `src/hooks/usePeople.ts`

**Step 1: Simplify transformation logic**

Replace entire file:

```typescript
import { useQuery } from '@tanstack/react-query';
import { azureApi, PersonResponse } from '@/lib/azureApiClient';
import { PersonCluster } from '@/types/person';

/**
 * Hook to fetch all people in a collection.
 * Returns people sorted by photo_count desc, then name asc.
 */
export function usePeople(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId, 'people'],
    queryFn: async () => {
      if (!collectionId) throw new Error('Collection ID required');

      const people = await azureApi.getPeople(collectionId);

      return people.map((person: PersonResponse): PersonCluster => ({
        id: person.id,
        name: person.name,
        representativeFaceId: person.representative_face_id,
        photoCount: person.photo_count,
        photos: [],
      }));
    },
    enabled: !!collectionId,
  });
}
```

**Step 2: Commit**

```bash
git add src/hooks/usePeople.ts
git commit -m "feat: update usePeople to use representative_face_id"
```

---

## Task 4: Create useFaceDerivativeUrl Hook

**Files:**
- Create: `src/hooks/useFaceDerivativeUrl.ts`

**Step 1: Create the hook**

```typescript
import { useState, useEffect } from 'react';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Hook to fetch face derivative URL.
 * Returns object URL for use in img src.
 */
export function useFaceDerivativeUrl(faceId: string | null | undefined) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!faceId) {
      setLoading(false);
      setUrl('');
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      try {
        setLoading(true);
        setError(null);

        const blob = await azureApi.fetchFaceDerivative(faceId);
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('[useFaceDerivativeUrl] Failed:', err);
        setError(err instanceof Error ? err : new Error('Failed to load face'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [faceId]);

  return { url, loading, error };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useFaceDerivativeUrl.ts
git commit -m "feat: add useFaceDerivativeUrl hook for face derivatives"
```

---

## Task 5: Update usePhotoUrl Hook for Photo Derivatives

**Files:**
- Modify: `src/hooks/usePhotoUrl.ts`

**Step 1: Replace with derivative-based implementation**

Replace entire file:

```typescript
import { useState, useEffect } from 'react';
import { azureApi, PhotoDerivativeSize } from '@/lib/azureApiClient';

/**
 * Hook to get authenticated photo derivative URL.
 * Creates object URL from blob for use in img src.
 *
 * @param photoId - Photo UUID
 * @param options.size - 'thumb_400' for grids, 'web_2048' for lightbox
 * @param options.abortSignal - AbortSignal to cancel fetch
 */
export function usePhotoUrl(
  photoId: string,
  options?: {
    size?: PhotoDerivativeSize;
    abortSignal?: AbortSignal;
  }
) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const size = options?.size ?? 'thumb_400';
  const abortSignal = options?.abortSignal;

  useEffect(() => {
    if (!photoId || !photoId.trim()) {
      setLoading(false);
      setUrl('');
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      try {
        if (cancelled) return;
        setLoading(true);
        setError(null);

        const blob = await azureApi.fetchPhotoDerivative(photoId, 'default', size, { abortSignal });
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('[usePhotoUrl] Failed:', err);
        setError(err instanceof Error ? err : new Error('Failed to load image'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, size, abortSignal]);

  return { url, loading, error };
}
```

**Step 2: Commit**

```bash
git add src/hooks/usePhotoUrl.ts
git commit -m "feat: update usePhotoUrl to use derivative endpoint"
```

---

## Task 6: Update PhotoCard Component

**Files:**
- Modify: `src/components/PhotoCard.tsx`

**Step 1: Update usePhotoUrl call**

Change line 20-24 from:

```typescript
  const { url: photoUrl, loading } = usePhotoUrl(photo.id, {
    thumbnail: true,
    abortSignal: thumbnailAbort.signal,
    priority: 'low',
  });
```

To:

```typescript
  const { url: photoUrl, loading } = usePhotoUrl(photo.id, {
    size: 'thumb_400',
    abortSignal: thumbnailAbort.signal,
  });
```

**Step 2: Commit**

```bash
git add src/components/PhotoCard.tsx
git commit -m "feat: update PhotoCard to use derivative API"
```

---

## Task 7: Update Lightbox Component

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Step 1: Update usePhotoUrl call**

Find the usePhotoUrl call (around line 110):

```typescript
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(photo?.id || '', {
    thumbnail: false,
    priority: 'high',
  });
```

Change to:

```typescript
  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(photo?.id || '', {
    size: 'web_2048',
  });
```

**Step 2: Verify download still uses original endpoint**

Search for `fetchPhoto` in the file - download functionality should still call `azureApi.fetchPhoto()` for the original file. This is correct and should NOT change.

**Step 3: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: update Lightbox to use web_2048 derivative"
```

---

## Task 8: Simplify PersonThumbnail Component

**Files:**
- Modify: `src/components/PersonThumbnail.tsx`

**Step 1: Replace with simplified version**

Face derivatives are pre-cropped, so no bbox handling needed:

```typescript
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { useFaceDerivativeUrl } from "@/hooks/useFaceDerivativeUrl";

interface PersonThumbnailProps {
  faceId: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a person's face as a circular thumbnail.
 * Uses pre-cropped face derivative from backend.
 */
export function PersonThumbnail({
  faceId,
  size = "md",
  className,
}: PersonThumbnailProps) {
  const { url, loading, error } = useFaceDerivativeUrl(faceId);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const showPlaceholder = !faceId || error || (!loading && !url);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-muted flex-shrink-0 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {loading ? (
        <div className="w-full h-full bg-muted animate-pulse rounded-full" />
      ) : showPlaceholder ? (
        <User className={cn(iconSizes[size], "text-muted-foreground")} />
      ) : (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PersonThumbnail.tsx
git commit -m "feat: simplify PersonThumbnail to use face derivative"
```

---

## Task 9: Update PersonClusterCard Component

**Files:**
- Modify: `src/components/PersonClusterCard.tsx`

**Step 1: Simplify to use representativeFaceId**

Replace entire file:

```typescript
import { PersonCluster } from "@/types/person";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonThumbnail } from "./PersonThumbnail";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface PersonClusterCardProps {
  cluster: PersonCluster;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
  unnamedIndex?: number;
}

export function PersonClusterCard({
  cluster,
  isSelected,
  isSelectionMode,
  onSelect,
  onClick,
  unnamedIndex,
}: PersonClusterCardProps) {
  const { ref, isVisible } = useIntersectionObserver({
    rootMargin: '200px',
    triggerOnce: true,
  });

  return (
    <div
      ref={ref}
      className="flex flex-col items-center gap-2 cursor-pointer group"
      onClick={() => {
        if (isSelectionMode) {
          onSelect(cluster.id);
        } else {
          onClick();
        }
      }}
    >
      <div className="relative">
        <PersonThumbnail
          faceId={isVisible ? cluster.representativeFaceId : null}
          size="md"
          className={cn(
            "transition-all duration-200",
            isSelected && "ring-4 ring-primary",
            "group-hover:shadow-elevation-hover group-hover:scale-[1.02]"
          )}
        />

        {isSelectionMode && (
          <div
            className={cn(
              "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
              isSelected
                ? "bg-primary border-primary"
                : "bg-card/80 border-card backdrop-blur-sm"
            )}
          >
            {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
          </div>
        )}
      </div>

      <div className="text-center">
        <div className="font-medium text-foreground">
          {cluster.name || (unnamedIndex ? `Unnamed person ${unnamedIndex}` : "Name?")}
        </div>
        <div className="text-sm text-muted-foreground">
          {cluster.photoCount} {cluster.photoCount === 1 ? "photo" : "photos"}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PersonClusterCard.tsx
git commit -m "feat: simplify PersonClusterCard to use representativeFaceId"
```

---

## Task 10: Update useAllPeople Hook

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts`

**Step 1: Update cluster transformation**

Find the `useAllPeople` function (around line 160). Update the `allPeople` useMemo (around line 192-224):

```typescript
  const allPeople = useMemo(() => {
    const peopleList: PersonCluster[] = [
      // Named people
      ...namedPeople.map(p => ({
        id: p.id,
        name: p.name,
        representativeFaceId: p.representativeFaceId,
        photoCount: p.photoCount,
        photos: [],
      })),
      // Unnamed clusters
      ...clusterData.map(cluster => {
        const photoIds = Array.from(new Set(cluster.faces.map(f => f.photo_id)));

        return {
          id: cluster.id,
          name: null,
          representativeFaceId: cluster.representative_face_id,
          photoCount: photoIds.length,
          photos: photoIds,
        };
      })
    ];

    return peopleList;
  }, [namedPeople, clusterData]);
```

**Step 2: Remove extractPhotoId helper function**

Delete lines 17-30 (the `extractPhotoId` function) - no longer needed.

**Step 3: Commit**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "feat: update useAllPeople to use representativeFaceId"
```

---

## Task 11: Delete Dead Code

**Files:**
- Delete: `src/lib/thumbnailService.ts`
- Delete: `supabase/functions/generate-thumbnail/` (entire directory)

**Step 1: Search for thumbnailService imports**

Run: `grep -r "thumbnailService" src/`

If any files import it, remove those imports.

**Step 2: Delete the files**

```bash
rm src/lib/thumbnailService.ts
rm -rf supabase/functions/generate-thumbnail/
```

**Step 3: Search for fetchFaceThumbnail usage**

Run: `grep -r "fetchFaceThumbnail" src/`

This method in azureApiClient.ts is now dead code. Remove it (lines 487-502).

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead thumbnail generation code"
```

---

## Task 12: Update Remaining Components Using PersonThumbnail

**Files:**
- Search and update any component passing `photoUrl` and `bbox` to PersonThumbnail

**Step 1: Find all PersonThumbnail usages**

Run: `grep -r "PersonThumbnail" src/ --include="*.tsx"`

**Step 2: Update each usage**

Each usage should change from:
```tsx
<PersonThumbnail photoUrl={url} bbox={bbox} />
```

To:
```tsx
<PersonThumbnail faceId={representativeFaceId} />
```

Common locations:
- Person album headers
- Face tagging UI
- Cluster merge dialogs

**Step 3: Commit after each file**

```bash
git add [file]
git commit -m "feat: update [component] to use faceId prop"
```

---

## Task 13: Verify Build and Test

**Step 1: Run TypeScript compiler**

```bash
npm run build
```

Expected: No errors

**Step 2: Run the app locally**

```bash
npm run dev
```

**Step 3: Manual testing checklist**

- [ ] Photo grid loads with WebP thumbnails
- [ ] Lightbox shows web_2048 derivative
- [ ] Download button still downloads original
- [ ] Person avatars show pre-cropped faces
- [ ] Cluster cards show representative faces
- [ ] People view loads all person/cluster thumbnails

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete WebP derivatives migration"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| `/v1/photos/{id}/image?thumbnail=true` | `/v1/photos/{id}/derivative/default/thumb_400` |
| `/v1/photos/{id}/image?thumbnail=false` | `/v1/photos/{id}/derivative/default/web_2048` |
| `/api/faces/{id}/thumbnail` | `/v1/faces/{id}/derivative/default/thumb_384` |
| CSS bbox cropping in PersonThumbnail | Pre-cropped face derivative |
| `thumbnail_url` + `thumbnail_bbox` | `representative_face_id` |
| `representative_thumbnail_url` | `representative_face_id` |
| Supabase edge function for thumbnails | Deleted (backend handles) |

## Files Changed

- `src/lib/azureApiClient.ts` - Add derivative types and methods
- `src/types/person.ts` - Simplify PersonCluster
- `src/hooks/usePhotoUrl.ts` - Use derivative endpoint
- `src/hooks/useFaceDerivativeUrl.ts` - New hook for faces
- `src/hooks/usePeople.ts` - Use representative_face_id
- `src/hooks/useAlbumPhotos.ts` - Use representative_face_id
- `src/components/PhotoCard.tsx` - Use thumb_400
- `src/components/Lightbox.tsx` - Use web_2048
- `src/components/PersonThumbnail.tsx` - Simplified, uses faceId
- `src/components/PersonClusterCard.tsx` - Simplified

## Files Deleted

- `src/lib/thumbnailService.ts`
- `supabase/functions/generate-thumbnail/`
