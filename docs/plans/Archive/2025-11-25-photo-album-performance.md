# Photo Album Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate blocking queries when viewing filtered photo sets (person albums, year filters) by embedding face data in photo responses and loading metadata on-demand.

**Architecture:** Backend includes cluster_id in photo face data. Frontend removes bulk cluster fetching, loads only metadata for filtered photos. Lightbox opens immediately without waiting for ALL clusters/people to load.

**Tech Stack:** FastAPI backend, React frontend, TanStack Query, TypeScript

---

## Prerequisites

**Verify backend changes are deployed:**
1. Photos API includes `cluster_id` in face data: `/v1/collections/{id}/photos`
2. Clusters API supports `ids` query param: `/api/faces/clusters?ids=abc,def`
3. Photos API supports `cluster_ids` filter: `/v1/collections/{id}/photos?cluster_ids=abc`

**If backend not ready:** Coordinate deployment before starting frontend work.

---

## Task 1: Update Frontend Types for cluster_id

**Files:**
- Modify: `src/lib/azureApiClient.ts:108-112`
- Modify: `src/types/photo.ts:14-18`

**Step 1: Add cluster_id to Photo.people type**

In `src/lib/azureApiClient.ts`, update PhotoPersonInfo:

```typescript
// Line 108-112
people: Array<{
  id: ServerId;
  name: string;
  face_bbox: UiBoundingBox | null;
  cluster_id: ServerId | null;  // ADD THIS
}>;
```

**Step 2: Update FaceDetection type**

In `src/types/photo.ts`, add cluster_id:

```typescript
// Around line 14-18
export interface FaceDetection {
  personId: string | null;
  personName: string | null;
  boundingBox: UiBoundingBox;
  clusterId?: string | null;  // ADD THIS
}
```

**Step 3: Commit type changes**

```bash
git add src/lib/azureApiClient.ts src/types/photo.ts
git commit -m "feat: add cluster_id to face types"
```

---

## Task 2: Transform cluster_id in API Client

**Files:**
- Modify: `src/lib/azureApiClient.ts:372-385`

**Step 1: Include cluster_id in photo response transformation**

In `azureApiClient.ts`, update `getCollectionPhotosPaginated`:

```typescript
// Line 372-385 - Replace existing coordinate conversion block
const convertedPhotos = photos.map(photo => ({
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
    cluster_id: person.cluster_id,  // ADD THIS - preserve from backend
  })),
}));
```

**Step 2: Commit API client changes**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: preserve cluster_id in photo transformation"
```

---

## Task 3: Add Cluster Metadata Query Helper

**Files:**
- Modify: `src/lib/azureApiClient.ts:645-664`

**Step 1: Add getClustersByIds method**

In `azureApiClient.ts`, add new method after `getClusters`:

```typescript
// After line 664, add:

/**
 * Get specific clusters by IDs (for cluster album metadata).
 * More efficient than fetching all clusters when you only need 1-3.
 *
 * @param collectionId - Collection to query
 * @param clusterIds - Array of cluster IDs to fetch
 * @returns Array of matching clusters
 */
async getClustersByIds(
  collectionId: string,
  clusterIds: string[]
): Promise<FaceClusterResponse[]> {
  if (clusterIds.length === 0) return [];

  const params = new URLSearchParams({
    collection_id: collectionId,
    ids: clusterIds.join(','),
  });

  const response = await this.request<ClustersResponse>(
    `/api/faces/clusters?${params.toString()}`
  );

  // Transform response (coordinate verification)
  return response.clusters.map(cluster => ({
    ...cluster,
    faces: cluster.faces.map(face => ({
      ...face,
      bbox: {
        x: apiCoord(face.bbox.x),
        y: apiCoord(face.bbox.y),
        width: apiCoord(face.bbox.width),
        height: apiCoord(face.bbox.height),
      }
    }))
  }));
}
```

**Step 2: Commit cluster metadata helper**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add getClustersByIds for targeted metadata"
```

---

## Task 4: Refactor usePhotosWithClusters Hook

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts:51-175`

**Step 1: Remove cluster fetching from usePhotosWithClusters**

In `useAlbumPhotos.ts`, replace entire hook (lines 51-175):

```typescript
export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  const normalizedCollectionId = Array.isArray(collectionId) ? collectionId[0] : collectionId;

  // Fetch photos with infinite pagination
  const {
    data: photosData,
    isLoading: photosLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: photosError,
    refetch: refetchPhotos,
  } = useInfiniteQuery({
    queryKey: ['photos', normalizedCollectionId, filters],
    queryFn: async ({ pageParam }) => {
      if (!normalizedCollectionId) throw new Error('Collection ID required');

      const apiFilters = {
        ...(filters ? {
          year_min: filters.yearRange?.[0],
          year_max: filters.yearRange?.[1],
          person_id: filters.personIds?.[0],
          tags: filters.tags?.join(','),
          favorite: filters.favoriteOnly,
        } : {}),
        cursor: pageParam,
      };

      return azureApi.getCollectionPhotosPaginated(normalizedCollectionId, apiFilters);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.cursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!normalizedCollectionId,
  });

  const azurePhotos = photosData?.pages.flatMap(page => page.photos) ?? [];
  const totalCount = photosData?.pages[0]?.total;

  // Convert Azure photos to UI format - faces already embedded
  const allPhotos = useMemo(() => {
    return azurePhotos.map(azurePhoto => ({
      id: azurePhoto.id,
      collection_id: azurePhoto.collection_id,
      path: azurePhoto.path,
      thumbnail_url: azurePhoto.thumbnail_url,
      original_filename: azurePhoto.original_filename,
      created_at: azurePhoto.created_at,
      filename: azurePhoto.title || undefined,
      title: azurePhoto.title,
      description: azurePhoto.description,
      width: azurePhoto.width,
      height: azurePhoto.height,
      rotation: azurePhoto.rotation,
      estimated_year: azurePhoto.estimated_year,
      user_corrected_year: azurePhoto.user_corrected_year,
      is_favorite: azurePhoto.is_favorite,
      tags: azurePhoto.tags,
      people: azurePhoto.people,
      // Map people to faces with cluster_id preserved
      faces: azurePhoto.people
        .filter(person => person.face_bbox !== null)
        .map(person => ({
          personId: person.id,
          personName: person.name,
          boundingBox: person.face_bbox!,
          clusterId: person.cluster_id,  // Preserved from backend
        })),
      taken_at: null,
    } as Photo));
  }, [azurePhotos]);

  return {
    photos: allPhotos,
    allPhotos,
    isLoading: photosLoading,
    isLoadingMore: isFetchingNextPage,
    error: photosError,
    refetch: refetchPhotos,
    loadMore: () => fetchNextPage(),
    hasMore: hasNextPage ?? false,
    totalCount,
  };
}
```

**Step 2: Verify compilation**

```bash
npm run type-check
```

Expected: No TypeScript errors (cluster_id is optional, so this should work)

**Step 3: Commit hook refactor**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "refactor: remove bulk cluster fetch, use embedded faces"
```

---

## Task 5: Create useClusterMetadata Hook

**Files:**
- Create: `src/hooks/useClusterMetadata.ts`

**Step 1: Write hook for on-demand cluster metadata**

Create new file `src/hooks/useClusterMetadata.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { azureApi, FaceClusterResponse } from '@/lib/azureApiClient';

/**
 * Fetch metadata for specific clusters (on-demand).
 * Used for cluster album headers - only loads what's needed.
 */
export function useClusterMetadata(
  collectionId: string | undefined,
  clusterIds: string[]
) {
  return useQuery({
    queryKey: ['cluster-metadata', collectionId, clusterIds],
    queryFn: async () => {
      if (!collectionId) throw new Error('Collection ID required');
      return azureApi.getClustersByIds(collectionId, clusterIds);
    },
    enabled: !!collectionId && clusterIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min - cluster metadata doesn't change often
  });
}

/**
 * Extract unique cluster IDs from photos.
 * Helper for determining which clusters to fetch metadata for.
 */
export function extractClusterIds(photos: Array<{ faces?: Array<{ clusterId?: string | null }> }>): string[] {
  const clusterIds = new Set<string>();

  photos.forEach(photo => {
    photo.faces?.forEach(face => {
      if (face.clusterId) {
        clusterIds.add(face.clusterId);
      }
    });
  });

  return Array.from(clusterIds);
}
```

**Step 2: Commit cluster metadata hook**

```bash
git add src/hooks/useClusterMetadata.ts
git commit -m "feat: add useClusterMetadata for on-demand loading"
```

---

## Task 6: Refactor useAllPeople to Load Lazily

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts:187-261`

**Step 1: Update useAllPeople to be optional/lazy**

Replace `useAllPeople` hook (lines 187-261):

```typescript
export interface UseAllPeopleResult {
  allPeople: PersonCluster[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch all people + unnamed clusters for a collection.
 *
 * WARNING: This loads ALL clusters. Use sparingly.
 * Good for: People gallery page
 * Bad for: Every page that shows photos
 */
export function useAllPeople(
  collectionId: string | string[] | undefined,
  options?: {
    enabled?: boolean;  // Allow disabling the query
  }
): UseAllPeopleResult {
  const normalizedCollectionId = Array.isArray(collectionId)
    ? collectionId[0]
    : collectionId;

  // Fetch named people
  const {
    data: namedPeople = [],
    isLoading: peopleLoading,
    error: peopleError,
    refetch: refetchPeople,
  } = usePeople(normalizedCollectionId);

  // Fetch clusters - now optional
  const {
    data: clusterData = [],
    isLoading: clustersLoading,
    error: clustersError,
    refetch: refetchClusters,
  } = useClusters(normalizedCollectionId, {
    enabled: options?.enabled ?? true,  // Respect enabled flag
  });

  const isLoading = peopleLoading || clustersLoading;
  const error = peopleError || clustersError || null;

  const allPeople = useMemo(() => {
    const peopleList: PersonCluster[] = [
      ...namedPeople.map(p => ({
        id: p.id,
        name: p.name,
        thumbnailPath: p.thumbnailPath,
        thumbnailBbox: p.thumbnailBbox || null,
        photoCount: p.photoCount,
        photos: [],
      })),
      ...clusterData.map(cluster => {
        const photoIds = Array.from(new Set(cluster.faces.map(f => f.photo_id)));
        const representativeFace = cluster.faces.find(
          f => f.id === cluster.representative_face_id
        ) || cluster.faces[0];

        return {
          id: cluster.id,
          name: null,
          thumbnailPath: cluster.representative_thumbnail_url || extractPhotoId(representativeFace?.photo_id),
          thumbnailBbox: representativeFace ? apiBboxToUi(representativeFace.bbox) : null,
          photoCount: photoIds.length,
          photos: photoIds,
        };
      })
    ];

    return peopleList;
  }, [namedPeople, clusterData]);

  const refetch = () => {
    refetchPeople();
    refetchClusters();
  };

  return {
    allPeople,
    isLoading,
    error,
    refetch,
  };
}

// Helper function (keep existing extractPhotoId)
function extractPhotoId(value: string | undefined): string {
  if (!value) return '';
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value;
  }
  const match = value.match(/\/(photos|faces)\/([a-f0-9-]+)/i);
  return match ? match[2] : value;
}
```

**Step 2: Update useClusters to support enabled option**

In `src/hooks/useFaces.ts`, find `useClusters` hook and add enabled option:

```typescript
export function useClusters(
  collectionId: string | undefined,
  options?: { enabled?: boolean }  // ADD THIS
) {
  return useQuery({
    queryKey: ['clusters', collectionId],
    queryFn: async () => {
      if (!collectionId) throw new Error('Collection ID required');
      return azureApi.getClusters(collectionId);
    },
    enabled: (options?.enabled ?? true) && !!collectionId,  // UPDATE THIS
  });
}
```

**Step 3: Verify compilation**

```bash
npm run type-check
```

**Step 4: Commit lazy loading changes**

```bash
git add src/hooks/useAlbumPhotos.ts src/hooks/useFaces.ts
git commit -m "feat: make useAllPeople lazy-loadable"
```

---

## Task 7: Refactor PersonAlbum Page

**Files:**
- Modify: `src/pages/PersonAlbum.tsx:24-356`

**Step 1: Remove blocking cluster fetch from PersonAlbum**

In `PersonAlbum.tsx`, update the data fetching section (lines 28-95):

```typescript
// Line 28-35 - Keep collections
const { data: collections, isLoading: collectionsLoading } = useCollections();
const firstCollectionId = collections?.[0]?.id;

// Fetch named people only (not clusters)
const { data: namedPeople = [], isLoading: peopleLoading, refetch: refetchPeople } = usePeople(firstCollectionId);

// Find if this ID is a named person
const person = useMemo(() => {
  return namedPeople.find(p => p.id === id) || null;
}, [namedPeople, id]);

const isNamedPerson = !!person;

// For named persons: use person_id filter (server-side)
// For clusters: use cluster_ids filter (server-side)
const { photos, isLoading: photosLoading, hasMore, isLoadingMore, loadMore, refetch } = usePhotosWithClusters(
  firstCollectionId,
  isNamedPerson
    ? { personIds: [id!] }
    : undefined  // Cluster filtering handled below
);

// For clusters: need metadata for the header
const { data: clusterMetadata = [] } = useClusterMetadata(
  firstCollectionId,
  isNamedPerson ? [] : [id!]  // Only fetch if viewing cluster
);

const cluster = clusterMetadata[0] || null;
const isCluster = !!cluster && !isNamedPerson;

// Build display person from either named person or cluster metadata
const displayPerson = useMemo((): PersonCluster | undefined => {
  if (isNamedPerson && person) {
    return {
      id: person.id,
      name: person.name,
      thumbnailPath: person.thumbnailPath,
      thumbnailBbox: person.thumbnailBbox || null,
      photoCount: person.photoCount,
      photos: [],
    };
  }

  if (cluster) {
    const photoIds = Array.from(new Set(cluster.faces.map(f => f.photo_id)));
    const representativeFace = cluster.faces.find(
      f => f.id === cluster.representative_face_id
    ) || cluster.faces[0];

    return {
      id: cluster.id,
      name: null,
      thumbnailPath: cluster.representative_thumbnail_url || representativeFace?.photo_id || '',
      thumbnailBbox: representativeFace ? apiBboxToUi(representativeFace.bbox) : null,
      photoCount: photoIds.length,
      photos: photoIds,
    };
  }

  return undefined;
}, [isNamedPerson, person, cluster]);

// Only need allPeople for lightbox face tags (load lazily)
const { allPeople } = useAllPeople(firstCollectionId, {
  enabled: false,  // Don't block page load - we'll load on-demand later
});

// Loading state - only wait for photos and person/cluster metadata
const loading = collectionsLoading || peopleLoading || photosLoading || (isCluster && clusterMetadata.length === 0);
```

**Step 2: Remove unused imports**

At top of file, remove:

```typescript
// REMOVE THESE:
import { useClusters } from "@/hooks/useFaces";
```

Add:

```typescript
// ADD THIS:
import { useClusterMetadata } from "@/hooks/useClusterMetadata";
```

**Step 3: Remove old cluster photo construction logic**

Delete lines 47-85 (the `clusterPhotos` useMemo block) - no longer needed since photos come from API

**Step 4: Update photo source**

Remove line 95 (`const photos = isCluster ? clusterPhotos : personPhotos;`) - photos already defined

**Step 5: Verify compilation**

```bash
npm run type-check
```

**Step 6: Test in browser**

```bash
npm run dev
```

Navigate to `/people/{person-id}` and `/people/{cluster-id}`:
- Expected: Page loads fast
- Expected: Photos appear immediately
- Expected: Can click photos before everything loads
- Expected: Lightbox opens (may not have face tags yet)

**Step 7: Commit PersonAlbum refactor**

```bash
git add src/pages/PersonAlbum.tsx
git commit -m "refactor: remove blocking queries from PersonAlbum"
```

---

## Task 8: Update Lightbox to Show Minimal Face Tags

**Files:**
- Modify: `src/components/Lightbox.tsx` (find face tag rendering logic)

**Step 1: Find face rendering in Lightbox**

Locate where Lightbox renders face bounding boxes and names. Should be in render logic showing face tags over the photo.

**Step 2: Update face display to handle missing person names**

Update face tag rendering to show:
- Named faces: Show name from `face.personName`
- Unnamed cluster faces: Show "Unknown" or blank

Example update (adjust to your actual code):

```typescript
// In Lightbox face rendering:
{photo.faces?.map((face, idx) => (
  <div key={idx} className="face-tag" style={getFaceStyle(face.boundingBox)}>
    {/* Show name if available, "Unknown" if cluster face */}
    {face.personName || (face.clusterId ? "Unknown" : "")}
  </div>
))}
```

**Step 3: Test lightbox**

```bash
npm run dev
```

Open PersonAlbum → Click photo → Verify:
- Lightbox opens immediately
- Named faces show names
- Cluster faces show "Unknown" or blank
- Can navigate prev/next

**Step 4: Commit lightbox updates**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: lightbox shows minimal face tags immediately"
```

---

## Task 9: Add Backend Filter for cluster_ids

**Backend Task** - Coordinate with backend engineer

**Step 1: Update photos endpoint to support cluster_ids filter**

In backend `collections.py`, add cluster filtering similar to person filtering:

```python
@router.get("/{collection_id}/photos", ...)
async def get_collection_photos(
    # ... existing params ...
    cluster_ids: Optional[str] = Query(None, description="Comma-separated cluster IDs"),
):
    # ... existing code ...

    # Cluster filtering (NEW)
    if cluster_ids is not None:
        from backend.datamodel import Face
        cluster_id_list = [cid.strip() for cid in cluster_ids.split(",")]
        photos_with_clusters = select(Face.photo_id).where(
            Face.cluster_id.in_(cluster_id_list)
        )
        statement = statement.where(Photo.id.in_(photos_with_clusters))
```

**Step 2: Test cluster filtering**

```bash
curl "https://.../v1/collections/{id}/photos?cluster_ids=abc,def" -H "Authorization: Bearer {token}"
```

Expected: Only photos containing faces from clusters abc or def

**Step 3: Deploy backend changes**

Wait for backend deployment before proceeding to Task 10.

---

## Task 10: Use cluster_ids Filter for Cluster Albums

**Files:**
- Modify: `src/lib/azureApiClient.ts:120-128`
- Modify: `src/pages/PersonAlbum.tsx:88-91`

**Step 1: Add cluster_ids to PhotoFilters type**

In `azureApiClient.ts`, update PhotoFilters:

```typescript
// Line 120-128
export interface PhotoFilters {
  person_id?: string;
  cluster_ids?: string;  // ADD THIS - comma-separated cluster IDs
  year_min?: number;
  year_max?: number;
  tags?: string;
  favorite?: boolean;
  limit?: number;
  cursor?: string;
}
```

**Step 2: Include cluster_ids in query params**

In `getCollectionPhotosPaginated`, add cluster_ids handling:

```typescript
// Around line 332-339
if (filters) {
  if (filters.person_id) params.append('person_id', filters.person_id);
  if (filters.cluster_ids) params.append('cluster_ids', filters.cluster_ids);  // ADD THIS
  if (filters.year_min) params.append('year_min', filters.year_min.toString());
  if (filters.year_max) params.append('year_max', filters.year_max.toString());
  if (filters.tags) params.append('tags', filters.tags);
  if (filters.favorite !== undefined) params.append('favorite', filters.favorite.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.cursor) params.append('cursor', filters.cursor);
}
```

**Step 3: Use cluster_ids filter in PersonAlbum**

In `PersonAlbum.tsx`, update usePhotosWithClusters call:

```typescript
// Update the filter logic (around line 45)
const { photos, isLoading: photosLoading, hasMore, isLoadingMore, loadMore, refetch } = usePhotosWithClusters(
  firstCollectionId,
  isNamedPerson
    ? { personIds: [id!] }
    : { cluster_ids: id! }  // USE CLUSTER FILTER for unnamed clusters
);
```

**Step 4: Remove cluster photo construction**

Now that clusters are filtered server-side, you can simplify PersonAlbum further by removing any remaining cluster-specific photo construction logic.

**Step 5: Test cluster album**

```bash
npm run dev
```

Navigate to unnamed cluster `/people/{cluster-id}`:
- Expected: Only photos with that cluster's faces appear
- Expected: Fast loading (server filters, no client-side processing)
- Expected: Pagination works correctly

**Step 6: Commit cluster filtering**

```bash
git add src/lib/azureApiClient.ts src/pages/PersonAlbum.tsx
git commit -m "feat: use cluster_ids filter for cluster albums"
```

---

## Task 11: Optimize Index Page (Timeline)

**Files:**
- Modify: `src/pages/Index.tsx:11-61`

**Step 1: Make allPeople lazy on Index page**

In `Index.tsx`, update useAllPeople to not block page load:

```typescript
// Line 20 - Update to lazy load
const { allPeople } = useAllPeople(firstCollectionId, {
  enabled: false,  // Don't load ALL clusters on timeline - not needed
});
```

**Rationale:** Timeline doesn't need cluster metadata - photos already have face data embedded.

**Step 2: Test timeline performance**

```bash
npm run dev
```

Navigate to `/`:
- Expected: Timeline loads immediately
- Expected: Photos appear fast
- Expected: Can scroll and open lightbox without waiting

**Step 3: Commit timeline optimization**

```bash
git add src/pages/Index.tsx
git commit -m "perf: defer allPeople loading on timeline"
```

---

## Task 12: Create usePhotoFaceNames Hook (Future Enhancement)

**Files:**
- Create: `src/hooks/usePhotoFaceNames.ts`

**Purpose:** On-demand loading of person names for lightbox face tags.

**Step 1: Write hook to resolve face names**

Create `src/hooks/usePhotoFaceNames.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { usePeople } from '@/hooks/usePeople';
import { useClusterMetadata, extractClusterIds } from '@/hooks/useClusterMetadata';
import { Photo } from '@/types/photo';

/**
 * Resolve face names for a specific photo's faces.
 * Loads only the people/clusters needed for this photo.
 */
export function usePhotoFaceNames(
  collectionId: string | undefined,
  photo: Photo | null
) {
  // Extract unique person IDs and cluster IDs from photo
  const personIds = photo?.faces
    ?.filter(f => f.personId && !f.clusterId)
    .map(f => f.personId!) || [];

  const clusterIds = photo?.faces
    ?.filter(f => f.clusterId)
    .map(f => f.clusterId!) || [];

  // Fetch named people (lightweight - just names)
  const { data: allPeople = [] } = usePeople(collectionId);

  // Fetch cluster metadata (only for clusters in this photo)
  const { data: clusters = [] } = useClusterMetadata(
    collectionId,
    Array.from(new Set(clusterIds))
  );

  // Build face name map
  const faceNames = new Map<string, string>();

  // Add person names
  allPeople.forEach(person => {
    if (personIds.includes(person.id)) {
      faceNames.set(person.id, person.name);
    }
  });

  // Add cluster names (if any are named)
  clusters.forEach(cluster => {
    // Clusters don't have names by design, but you could show "Unknown" here
    faceNames.set(cluster.id, "Unknown");
  });

  return faceNames;
}
```

**Step 2: Document for future use**

Add comment in Lightbox.tsx indicating this hook can be used to show full face names without blocking page load.

**Step 3: Commit hook**

```bash
git add src/hooks/usePhotoFaceNames.ts
git commit -m "feat: add usePhotoFaceNames for on-demand face resolution"
```

---

## Task 13: Update People Gallery Page

**Files:**
- Modify: `src/pages/People.tsx`

**Purpose:** People gallery should still load ALL people + clusters (this is the one place it's needed).

**Step 1: Keep useAllPeople enabled on People page**

In `People.tsx`, ensure useAllPeople has no enabled flag (default is true):

```typescript
// Should be something like:
const { allPeople, isLoading } = useAllPeople(firstCollectionId);
// No {enabled: false} - we want full list here
```

**Step 2: Test People gallery**

```bash
npm run dev
```

Navigate to `/people`:
- Expected: Shows all named people + unnamed clusters
- Expected: Grid of thumbnails loads
- Expected: Can click to view person/cluster album

**Step 3: Verify this is the ONLY page loading all clusters**

Search codebase for `useAllPeople`:

```bash
grep -r "useAllPeople" src/pages/
```

Expected: Only Index.tsx (disabled), PersonAlbum.tsx (disabled), People.tsx (enabled)

**Step 4: Commit People page verification**

```bash
git add src/pages/People.tsx
git commit -m "docs: verify People page correctly loads all clusters"
```

---

## Task 14: Add Performance Monitoring

**Files:**
- Create: `docs/performance-monitoring.md`

**Step 1: Document performance metrics to track**

Create `docs/performance-monitoring.md`:

```markdown
# Performance Monitoring

## Key Metrics

### PersonAlbum Page Load
- **Time to first photo**: Should be < 300ms
- **Time to lightbox ready**: Should be < 500ms
- **Blocked by**: Photo query only (not clusters)

### Timeline Page Load
- **Time to first photo**: Should be < 500ms
- **Time to scroll**: Should be < 100ms
- **Blocked by**: Photo query only

### People Gallery
- **Time to grid render**: May be 1-2s (loads all clusters)
- **Acceptable**: This is the one page that needs all data

## How to Measure

### Chrome DevTools
1. Open Network tab
2. Filter by "Fetch/XHR"
3. Navigate to page
4. Check waterfall:
   - `/photos?person_id=...` should complete first
   - `/people` and `/clusters` should NOT block page render

### React Query DevTools
1. Install React Query DevTools
2. Check query status:
   - `['photos', ...]` - should be fetching
   - `['cluster-metadata', ...]` - should be disabled on most pages

## Red Flags

❌ `/api/faces/clusters?collection_id=...` called on PersonAlbum page
❌ Lightbox blocked until clusters load
❌ Timeline page waits for clusters
```

**Step 2: Commit monitoring docs**

```bash
git add docs/performance-monitoring.md
git commit -m "docs: add performance monitoring guide"
```

---

## Task 15: Update Architecture Docs

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Document new data flow**

In `ARCHITECTURE.md`, add section on photo data loading:

```markdown
## Photo Data Loading Architecture

### Problem Solved
Previously, viewing filtered photos (person albums) required loading ALL unnamed face clusters for the entire collection, blocking page render and lightbox functionality.

### Solution
Photos now include embedded face data (both named and unnamed) with cluster_id preserved from backend. Cluster metadata is loaded on-demand only when needed.

### Data Flow

#### Photos Query
```
GET /v1/collections/{id}/photos?person_id=abc
→ Returns photos with embedded faces
→ Each face has: person_id, name, bbox, cluster_id
```

#### Cluster Metadata Query (On-Demand)
```
GET /api/faces/clusters?ids=xyz
→ Only when viewing cluster album header
→ Not loaded on timeline or person albums
```

#### Where Queries Run

| Page | Photos Query | Cluster Metadata | All People |
|------|--------------|------------------|------------|
| Timeline | ✅ All photos | ❌ Disabled | ❌ Disabled |
| PersonAlbum | ✅ Filtered | ✅ Current only | ❌ Disabled |
| People Gallery | ❌ None | ✅ All clusters | ✅ Enabled |

### Performance Impact

- PersonAlbum: 5-10x faster (no bulk cluster fetch)
- Timeline: 3-5x faster (no cluster fetch)
- Lightbox: Opens immediately (not blocked)
```

**Step 2: Commit architecture updates**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: document new photo loading architecture"
```

---

## Task 16: Final Testing Checklist

**Files:**
- Create: `docs/testing/2025-11-25-performance-testing.md`

**Step 1: Create test checklist**

Create test doc:

```markdown
# Performance Refactor Testing Checklist

## Test PersonAlbum Page

### Named Person Album
- [ ] Navigate to `/people/{named-person-id}`
- [ ] Page renders immediately (no "Loading..." screen)
- [ ] Photos appear within 300ms
- [ ] Click photo → Lightbox opens immediately
- [ ] Face tags show person name
- [ ] Prev/next navigation works
- [ ] Network tab shows NO `/api/faces/clusters?collection_id=...` call

### Unnamed Cluster Album
- [ ] Navigate to `/people/{cluster-id}`
- [ ] Page renders immediately
- [ ] Photos appear within 300ms
- [ ] Header shows cluster photo count
- [ ] Click photo → Lightbox opens immediately
- [ ] Face tags show "Unknown"
- [ ] Network tab shows `/api/faces/clusters?ids={cluster-id}` (small payload)

## Test Timeline Page

- [ ] Navigate to `/`
- [ ] Timeline renders immediately
- [ ] Photos appear fast
- [ ] Scroll works smoothly
- [ ] Click photo → Lightbox opens immediately
- [ ] Network tab shows NO cluster query

## Test People Gallery

- [ ] Navigate to `/people`
- [ ] Grid loads (may take 1-2s - acceptable)
- [ ] All named people shown
- [ ] All unnamed clusters shown
- [ ] Click person/cluster → PersonAlbum loads fast

## Performance Regression Tests

- [ ] 500-photo collection: Timeline loads in < 1s
- [ ] Person with 5 photos: Page loads in < 300ms
- [ ] Cluster with 20 photos: Page loads in < 500ms
- [ ] Lightbox: Opens in < 100ms (not blocked)

## Edge Cases

- [ ] Empty collection: No errors
- [ ] Person with no photos: Shows "No photos"
- [ ] Cluster with 1 face: Loads correctly
- [ ] Photo with 10 faces: All faces render
```

**Step 2: Run through checklist**

Execute each test case, check boxes as you go.

**Step 3: Document any failures**

If tests fail, document in the test file:
```markdown
## Failures Found
- [ ] Issue: Timeline still loads clusters
  - Root cause: useAllPeople enabled={true} in Index.tsx
  - Fix: Set enabled={false}
```

**Step 4: Commit test results**

```bash
git add docs/testing/2025-11-25-performance-testing.md
git commit -m "test: performance refactor validation"
```

---

## Unresolved Questions

1. **Face tag display in lightbox**: Should unnamed cluster faces show "Unknown", blank, or a cluster icon? (UX decision)

2. **Cluster merge workflow**: When user merges clusters, does backend handle updating cluster_ids in photo faces? (Backend question)

3. **Cache invalidation**: When cluster is labeled (unnamed → named), do photo face queries need manual refetch, or does React Query handle it? (May need cache invalidation strategy)

4. **Large albums**: What's the expected max cluster size? If cluster has 1000+ photos, should we paginate within the cluster album? (Product decision)

5. **Cluster representative thumbnail**: Backend returns `representative_thumbnail_url` - does this URL have auth, or should we use `getPhotoUrl()`? (Backend question)

---

## Success Criteria

✅ PersonAlbum page loads without blocking on ALL clusters
✅ Lightbox opens immediately (not blocked by metadata)
✅ Timeline doesn't load cluster data
✅ People gallery still shows all people + clusters
✅ No regression in face tag functionality
✅ Network requests reduced by 80%+ on filtered views
