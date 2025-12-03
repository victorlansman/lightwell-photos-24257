# People Page Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve /people page load time with pagination, skeleton loading states, and thumbnail caching/prefetching.

**Architecture:**
- Add limit/offset pagination to people and clusters API calls (separate Load More buttons)
- Use `useInfiniteQuery` pattern for pagination state management (aligns with app patterns)
- Convert useFaceDerivativeUrl to React Query for caching + prefetching
- Show skeleton state consistently (no silhouette icon flash)

**Tech Stack:** React, React Query (useInfiniteQuery), TypeScript

**Backend Reference:** See `/docs/frontend-integration-guide.md` in backend repo for API details.

**Note on Pagination Pattern:** Backend uses offset/limit (not cursor). We use `useInfiniteQuery` with offset calculation for cleaner state management. `hasMore` is computed client-side: `items.length < limit` means no more pages.

**Note on Clusters Summary Mode:** Use `?summary=true` for /people page - returns `photo_count` directly and omits `faces[]` array (~100KB → <1KB response size).

---

## Task 1: Add Pagination to People API Client

**Files:**
- Modify: `src/lib/azureApiClient.ts:680-683`

**Step 1: Add pagination params to getPeople**

In `src/lib/azureApiClient.ts`, update the `getPeople` method:

```typescript
/**
 * List all people in a collection with optional pagination.
 * Returns people sorted by photo_count desc, then name asc.
 *
 * @param collectionId - Collection UUID
 * @param options - Pagination: limit (1-1000), offset (>=0)
 */
async getPeople(
  collectionId: string,
  options?: { limit?: number; offset?: number }
): Promise<PersonResponse[]> {
  const params = new URLSearchParams({ collection_id: collectionId });
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  return this.request(`/v1/people?${params.toString()}`);
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to getPeople

**Step 3: Commit**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add pagination params to getPeople API"
```

---

## Task 2: Add Pagination and Summary Mode to Clusters API Client

**Files:**
- Modify: `src/lib/azureApiClient.ts:692-710`

**Step 1: Add pagination and summary params to getClusters**

In `src/lib/azureApiClient.ts`, update the `getClusters` method:

```typescript
/**
 * Get unnamed face clusters for a collection with optional pagination.
 *
 * @param collectionId - Collection UUID
 * @param options - Pagination: limit (1-500), offset (>=0), summary (omits faces array)
 * @returns Array of face clusters
 */
async getClusters(
  collectionId: string,
  options?: { limit?: number; offset?: number; summary?: boolean }
): Promise<FaceClusterResponse[]> {
  const params = new URLSearchParams({ collection_id: collectionId });
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.summary) params.append('summary', 'true');

  const response = await this.request<ClustersResponse>(
    `/api/faces/clusters?${params.toString()}`
  );

  // Transform response - faces may be null in summary mode
  return response.clusters.map(cluster => ({
    ...cluster,
    faces: cluster.faces?.map(face => ({
      ...face,
      bbox: {
        x: apiCoord(face.bbox.x),
        y: apiCoord(face.bbox.y),
        width: apiCoord(face.bbox.width),
        height: apiCoord(face.bbox.height),
      }
    })) ?? []
  }));
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to getClusters

**Step 3: Commit**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add pagination params to getClusters API"
```

---

## Task 3: Create usePaginatedPeople Hook with useInfiniteQuery

**Files:**
- Create: `src/hooks/usePaginatedPeople.ts`

**Step 1: Create new hook file**

Create `src/hooks/usePaginatedPeople.ts`:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { azureApi, PersonResponse } from '@/lib/azureApiClient';
import { PersonCluster } from '@/types/person';
import { useMemo } from 'react';

const PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 50;

/**
 * Hook to fetch named people with infinite pagination.
 * Uses useInfiniteQuery for consistent pattern with rest of app.
 */
export function usePaginatedPeople(collectionId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['people', 'paginated', collectionId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!collectionId) throw new Error('Collection ID required');

      // First page uses PAGE_SIZE, subsequent use LOAD_MORE_SIZE
      const limit = pageParam === 0 ? PAGE_SIZE : LOAD_MORE_SIZE;
      const offset = pageParam === 0 ? 0 : PAGE_SIZE + (pageParam - 1) * LOAD_MORE_SIZE;

      const people = await azureApi.getPeople(collectionId, { limit, offset });

      return {
        people,
        pageParam,
        // If we got fewer than requested, no more pages
        hasMore: people.length >= limit,
      };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.pageParam + 1;
    },
    initialPageParam: 0,
    enabled: !!collectionId,
  });

  // Flatten pages into single array of PersonCluster
  const people = useMemo(() => {
    if (!query.data) return [];

    return query.data.pages.flatMap(page =>
      page.people.map((person: PersonResponse): PersonCluster => ({
        id: person.id,
        name: person.name,
        representativeFaceId: person.representative_face_id,
        photoCount: person.photo_count,
        photos: [],
      }))
    );
  }, [query.data]);

  return {
    people,
    isLoading: query.isLoading,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/usePaginatedPeople.ts
git commit -m "feat: add usePaginatedPeople hook with useInfiniteQuery"
```

---

## Task 4: Create usePaginatedClusters Hook with useInfiniteQuery

**Files:**
- Create: `src/hooks/usePaginatedClusters.ts`

**Step 1: Create new hook file**

Create `src/hooks/usePaginatedClusters.ts`:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { azureApi } from '@/lib/azureApiClient';
import { PersonCluster } from '@/types/person';
import { useMemo } from 'react';

const PAGE_SIZE = 25;
const LOAD_MORE_SIZE = 50;

/**
 * Hook to fetch unnamed clusters with infinite pagination.
 * Uses summary=true to get photo_count directly (avoids loading full faces array).
 */
export function usePaginatedClusters(
  collectionId: string | undefined,
  options?: { enabled?: boolean }
) {
  const query = useInfiniteQuery({
    queryKey: ['clusters', 'paginated', collectionId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!collectionId) throw new Error('Collection ID required');

      // First page uses PAGE_SIZE, subsequent use LOAD_MORE_SIZE
      const limit = pageParam === 0 ? PAGE_SIZE : LOAD_MORE_SIZE;
      const offset = pageParam === 0 ? 0 : PAGE_SIZE + (pageParam - 1) * LOAD_MORE_SIZE;

      // Use summary=true to get photo_count directly, skip faces array (~100KB → <1KB)
      const clusters = await azureApi.getClusters(collectionId, { limit, offset, summary: true });

      return {
        clusters,
        pageParam,
        hasMore: clusters.length >= limit,
      };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.pageParam + 1;
    },
    initialPageParam: 0,
    enabled: (options?.enabled ?? true) && !!collectionId,
  });

  // Flatten pages and transform to PersonCluster format
  const clusters = useMemo(() => {
    if (!query.data) return [];

    return query.data.pages.flatMap(page =>
      page.clusters.map((cluster): PersonCluster => ({
        id: cluster.id,
        name: null,
        representativeFaceId: cluster.representative_face_id,
        // Use photo_count from summary response (unique photos, not face_count)
        photoCount: (cluster as any).photo_count ?? cluster.face_count ?? 0,
        photos: [],
      }))
    );
  }, [query.data]);

  return {
    clusters,
    isLoading: query.isLoading,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/usePaginatedClusters.ts
git commit -m "feat: add usePaginatedClusters hook with useInfiniteQuery"
```

---

## Task 5: Update useAllPeople to Use Paginated Hooks

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts`

**Step 1: Update imports and rewrite useAllPeople**

Add import at top of file:

```typescript
import { usePaginatedPeople } from './usePaginatedPeople';
import { usePaginatedClusters } from './usePaginatedClusters';
```

Replace the `useAllPeople` function (lines ~120-208):

```typescript
export interface UseAllPeopleResult {
  namedPeople: PersonCluster[];
  namedPeopleHasMore: boolean;
  loadMoreNamedPeople: () => void;
  isLoadingMoreNamed: boolean;

  clusters: PersonCluster[];
  clustersHasMore: boolean;
  loadMoreClusters: () => void;
  isLoadingMoreClusters: boolean;

  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch named people + unnamed clusters with separate pagination.
 * Uses useInfiniteQuery pattern for both.
 */
export function useAllPeople(
  collectionId: string | string[] | undefined,
  options?: { enabled?: boolean }
): UseAllPeopleResult {
  const normalizedCollectionId = Array.isArray(collectionId)
    ? collectionId[0]
    : collectionId;

  const {
    people: namedPeople,
    hasMore: namedPeopleHasMore,
    loadMore: loadMoreNamedPeople,
    isFetchingMore: isLoadingMoreNamed,
    isLoading: peopleLoading,
    error: peopleError,
    refetch: refetchPeople,
  } = usePaginatedPeople(normalizedCollectionId);

  const {
    clusters,
    hasMore: clustersHasMore,
    loadMore: loadMoreClusters,
    isFetchingMore: isLoadingMoreClusters,
    isLoading: clustersLoading,
    error: clustersError,
    refetch: refetchClusters,
  } = usePaginatedClusters(normalizedCollectionId, {
    enabled: options?.enabled ?? true,
  });

  const isLoading = peopleLoading || clustersLoading;
  const error = peopleError || clustersError || null;

  const refetch = useCallback(() => {
    refetchPeople();
    refetchClusters();
  }, [refetchPeople, refetchClusters]);

  return {
    namedPeople,
    namedPeopleHasMore,
    loadMoreNamedPeople,
    isLoadingMoreNamed,

    clusters,
    clustersHasMore,
    loadMoreClusters,
    isLoadingMoreClusters,

    isLoading,
    error,
    refetch,
  };
}
```

**Step 2: Remove old usePeople/useClusters imports if not used elsewhere**

Check if `usePeople` and `useClusters` are still needed. Keep for now as other components may use them.

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "feat: update useAllPeople to use paginated hooks"
```

---

## Task 6: Update PeopleGallery with Load More Buttons

**Files:**
- Modify: `src/components/PeopleGallery.tsx`

**Step 1: Update props interface and component**

Replace entire file:

```typescript
import { PersonCluster } from "@/types/person";
import { PersonClusterCard } from "./PersonClusterCard";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Users, Trash2, ChevronDown, Loader2 } from "lucide-react";

interface PeopleGalleryProps {
  namedPeople: PersonCluster[];
  namedPeopleHasMore: boolean;
  onLoadMoreNamed: () => void;
  isLoadingMoreNamed?: boolean;

  clusters: PersonCluster[];
  clustersHasMore: boolean;
  onLoadMoreClusters: () => void;
  isLoadingMoreClusters?: boolean;

  selectedClusters: Set<string>;
  isSelectionMode: boolean;
  onSelectCluster: (id: string) => void;
  onToggleSelectionMode: () => void;
  onMerge: (clusterIds: string[]) => void;
  onHide: (clusterIds: string[]) => void;
}

export function PeopleGallery({
  namedPeople,
  namedPeopleHasMore,
  onLoadMoreNamed,
  isLoadingMoreNamed = false,
  clusters,
  clustersHasMore,
  onLoadMoreClusters,
  isLoadingMoreClusters = false,
  selectedClusters,
  isSelectionMode,
  onSelectCluster,
  onToggleSelectionMode,
  onMerge,
  onHide,
}: PeopleGalleryProps) {
  const navigate = useNavigate();

  // Filter out people with 0 photos
  const visibleNamedPeople = namedPeople.filter(p => p.photoCount > 0);
  // Only show unnamed clusters with more than 1 photo
  const visibleClusters = clusters.filter(p => p.photoCount > 1);

  // Combine for selection operations
  const allPeople = [...visibleNamedPeople, ...visibleClusters];

  const handleMerge = () => {
    if (selectedClusters.size !== 2) {
      toast.error("Select exactly 2 people to merge");
      return;
    }

    const selectedIds = Array.from(selectedClusters);
    const selectedPeople = selectedIds.map(id => allPeople.find(p => p.id === id));
    const bothUnnamed = selectedPeople.every(p => p && p.name === null);

    if (bothUnnamed) {
      toast.error("Cannot merge two unnamed clusters. Name one first, then merge.");
      return;
    }

    onMerge(selectedIds);
  };

  const handleDelete = () => {
    if (selectedClusters.size === 0) {
      toast.error("Select at least 1 person to delete");
      return;
    }
    onHide(Array.from(selectedClusters));
  };

  return (
    <div className="space-y-8">
      {/* Header with Edit button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground mt-1">
            {visibleNamedPeople.length} named{namedPeopleHasMore ? '+' : ''}, {visibleClusters.length} unnamed{clustersHasMore ? '+' : ''}
          </p>
        </div>
        <Button
          variant={isSelectionMode ? "default" : "outline"}
          onClick={onToggleSelectionMode}
        >
          {isSelectionMode ? "Done" : "Select"}
        </Button>
      </div>

      {/* Selection actions */}
      {isSelectionMode && selectedClusters.size > 0 && (
        <div className="flex gap-2 p-4 bg-muted rounded-lg animate-fade-in">
          <Button onClick={handleMerge} disabled={selectedClusters.size !== 2}>
            Merge {selectedClusters.size === 2 ? '(2)' : `(select exactly 2)`}
          </Button>
          <div className="flex-1" />
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selectedClusters.size})
          </Button>
        </div>
      )}

      {/* Named People Section */}
      {(visibleNamedPeople.length > 0 || namedPeopleHasMore) && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Named People</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
            {visibleNamedPeople.map((person) => (
              <PersonClusterCard
                key={person.id}
                cluster={person}
                isSelected={selectedClusters.has(person.id)}
                isSelectionMode={isSelectionMode}
                onSelect={onSelectCluster}
                onClick={() => navigate(`/people/${person.id}`)}
              />
            ))}
          </div>
          {namedPeopleHasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMoreNamed}
                disabled={isLoadingMoreNamed}
              >
                {isLoadingMoreNamed ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Load More Named People
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Unnamed People Section */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold text-foreground">Unnamed People</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
          {/* Browse all photos cluster */}
          <div
            className="flex flex-col items-center gap-2 cursor-pointer group"
            onClick={() => navigate('/unknown')}
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-dashed border-primary/40 flex items-center justify-center transition-all duration-200 group-hover:shadow-elevation-hover group-hover:scale-[1.02]">
                <Users className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">Browse All Photos</div>
              <div className="text-sm text-muted-foreground">
                All untagged faces
              </div>
            </div>
          </div>

          {/* Unnamed person clusters */}
          {visibleClusters.map((cluster, index) => (
            <PersonClusterCard
              key={cluster.id}
              cluster={cluster}
              isSelected={selectedClusters.has(cluster.id)}
              isSelectionMode={isSelectionMode}
              onSelect={onSelectCluster}
              onClick={() => navigate(`/people/${cluster.id}`)}
              unnamedIndex={index + 1}
            />
          ))}
        </div>
        {clustersHasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={onLoadMoreClusters}
              disabled={isLoadingMoreClusters}
            >
              {isLoadingMoreClusters ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Load More Unnamed People
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PeopleGallery.tsx
git commit -m "feat: add Load More buttons with loading states"
```

---

## Task 7: Update People Page to Use New Props

**Files:**
- Modify: `src/pages/People.tsx`

**Step 1: Update People.tsx to use new useAllPeople structure**

Find the `useAllPeople` call (around line 61) and update:

```typescript
const {
  namedPeople,
  namedPeopleHasMore,
  loadMoreNamedPeople,
  isLoadingMoreNamed,
  clusters,
  clustersHasMore,
  loadMoreClusters,
  isLoadingMoreClusters,
  isLoading: peopleLoading,
  refetch: refetchPeople,
} = useAllPeople(firstCollectionId);
```

Update merge logic to use combined list (around line 105-106):

```typescript
// For merge operations, combine both lists
const allPeopleForMerge = [...namedPeople, ...clusters];

// In handleMerge function:
const person1 = allPeopleForMerge.find(p => p.id === clusterIds[0]);
const person2 = allPeopleForMerge.find(p => p.id === clusterIds[1]);
```

Update selectedPersons (around line 191):

```typescript
const selectedPersons = allPeopleForMerge.filter(p => selectedPersonsArray.includes(p.id));
```

Update PeopleGallery props (around line 200):

```tsx
<PeopleGallery
  namedPeople={namedPeople}
  namedPeopleHasMore={namedPeopleHasMore}
  onLoadMoreNamed={loadMoreNamedPeople}
  isLoadingMoreNamed={isLoadingMoreNamed}
  clusters={clusters}
  clustersHasMore={clustersHasMore}
  onLoadMoreClusters={loadMoreClusters}
  isLoadingMoreClusters={isLoadingMoreClusters}
  selectedClusters={selectedClusters}
  isSelectionMode={isSelectionMode}
  onSelectCluster={handleSelectCluster}
  onToggleSelectionMode={handleToggleSelectionMode}
  onMerge={handleMerge}
  onHide={handleHide}
/>
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/pages/People.tsx
git commit -m "feat: wire up paginated people gallery"
```

---

## Task 8: Convert useFaceDerivativeUrl to React Query

**Files:**
- Modify: `src/hooks/useFaceDerivativeUrl.ts`

**Step 1: Rewrite hook with React Query for caching**

Replace entire file:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { azureApi } from '@/lib/azureApiClient';
import { useCallback } from 'react';

/**
 * Hook to fetch face derivative URL with React Query caching.
 * First load may take 3-4s (on-the-fly generation), subsequent loads ~200ms (cached).
 * Returns object URL for use in img src.
 */
export function useFaceDerivativeUrl(faceId: string | null | undefined) {
  const { data: url, isLoading: loading, error } = useQuery({
    queryKey: ['face-derivative', faceId],
    queryFn: async () => {
      if (!faceId) return '';
      const blob = await azureApi.fetchFaceDerivative(faceId);
      return URL.createObjectURL(blob);
    },
    enabled: !!faceId,
    staleTime: 1000 * 60 * 30, // Consider fresh for 30 minutes
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    retry: 1, // Only retry once on failure
  });

  return {
    url: url ?? '',
    loading: loading && !!faceId,
    error: error as Error | null,
  };
}

/**
 * Hook to prefetch face derivatives before they're needed.
 * Useful for hover prefetch or prefetching next page.
 */
export function usePrefetchFaceDerivative() {
  const queryClient = useQueryClient();

  const prefetch = useCallback((faceId: string | null | undefined) => {
    if (!faceId) return;

    // Don't prefetch if already in cache
    const cached = queryClient.getQueryData(['face-derivative', faceId]);
    if (cached) return;

    queryClient.prefetchQuery({
      queryKey: ['face-derivative', faceId],
      queryFn: async () => {
        const blob = await azureApi.fetchFaceDerivative(faceId);
        return URL.createObjectURL(blob);
      },
      staleTime: 1000 * 60 * 30,
    });
  }, [queryClient]);

  return prefetch;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useFaceDerivativeUrl.ts
git commit -m "feat: convert face derivative to React Query with caching"
```

---

## Task 9: Update PersonThumbnail for Skeleton-Always

**Files:**
- Modify: `src/components/PersonThumbnail.tsx`

**Step 1: Show skeleton until loaded (no User icon flash)**

Replace entire file:

```typescript
import { cn } from "@/lib/utils";
import { useFaceDerivativeUrl } from "@/hooks/useFaceDerivativeUrl";

interface PersonThumbnailProps {
  faceId: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a person's face as a circular thumbnail.
 * Shows skeleton until image loads - no flash of placeholder icon.
 *
 * Note: First load may take 3-4s due to on-the-fly derivative generation.
 * Subsequent loads are fast (~200ms) due to caching.
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

  // Show skeleton consistently until we have a loaded image
  const showSkeleton = !faceId || loading || (!url && !error);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-muted flex-shrink-0 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {showSkeleton ? (
        <div className="w-full h-full bg-muted animate-pulse rounded-full" />
      ) : url ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        // Error state - show static muted background
        <div className="w-full h-full bg-muted rounded-full" />
      )}
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PersonThumbnail.tsx
git commit -m "feat: skeleton loading state without icon flash"
```

---

## Task 10: Increase Intersection Margin and Add Hover Prefetch

**Files:**
- Modify: `src/components/PersonClusterCard.tsx`

**Step 1: Update intersection margin and add hover prefetch**

Replace entire file:

```typescript
import { PersonCluster } from "@/types/person";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonThumbnail } from "./PersonThumbnail";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { usePrefetchFaceDerivative } from "@/hooks/useFaceDerivativeUrl";

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
  // Increased margin for earlier preloading (was 200px)
  const { ref, isVisible } = useIntersectionObserver({
    rootMargin: '400px',
    triggerOnce: true,
  });

  const prefetch = usePrefetchFaceDerivative();

  // Prefetch on hover for cards not yet in viewport
  const handleMouseEnter = () => {
    if (!isVisible && cluster.representativeFaceId) {
      prefetch(cluster.representativeFaceId);
    }
  };

  return (
    <div
      ref={ref}
      className="flex flex-col items-center gap-2 cursor-pointer group"
      onMouseEnter={handleMouseEnter}
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

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PersonClusterCard.tsx
git commit -m "feat: increase preload margin and add hover prefetch"
```

---

## Task 11: Final Integration Test

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run dev server**

Run: `npm run dev`

**Step 3: Manual test checklist**

- [ ] /people page loads with 25 named + 25 unnamed initially
- [ ] "Load More Named People" button shows if more exist
- [ ] "Load More Unnamed People" button shows if more exist
- [ ] Clicking Load More shows spinner, then adds 50 more items
- [ ] Thumbnails show skeleton (no silhouette icon) before loading
- [ ] Thumbnails start loading when ~400px from viewport
- [ ] Hovering not-yet-visible cards triggers prefetch
- [ ] Navigate away and back - thumbnails load instantly (cached)
- [ ] Merge/delete operations still work correctly

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: people page performance improvements

- Pagination: 25 initial, 50 on Load More (separate for named/unnamed)
- useInfiniteQuery pattern for pagination (aligns with app architecture)
- React Query caching for face thumbnails
- Skeleton loading state (no icon flash)
- Increased preload margin (400px)
- Hover prefetch for thumbnails"
```

---

## Summary

| Change | Files | Impact |
|--------|-------|--------|
| Paginated hooks (useInfiniteQuery) | New: usePaginatedPeople.ts, usePaginatedClusters.ts | Aligns with app patterns, cleaner state |
| Load More UI | PeopleGallery.tsx, People.tsx | User controls pagination, faster initial load |
| React Query for thumbnails | useFaceDerivativeUrl.ts | Caching (30min), prefetch support |
| Skeleton-always | PersonThumbnail.tsx | No icon flash, smoother UX |
| Preload margin 400px | PersonClusterCard.tsx | Earlier loading |
| Hover prefetch | PersonClusterCard.tsx | Load on user intent |

## Architecture Notes

- **Uses useInfiniteQuery** - same pattern as usePhotosWithClusters for photos
- **Offset pagination** - backend uses limit/offset (not cursor), but useInfiniteQuery handles state cleanly
- **hasMore computed client-side** - if `returned items < limit`, no more pages
- **Reusable components** - PersonThumbnail caching benefits all pages using it
