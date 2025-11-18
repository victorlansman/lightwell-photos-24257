# Album View Refactor - Reusable Components Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor album views to use reusable hooks and components, eliminating code duplication across Index, CollectionDetail, PersonAlbum, and future views.

**Architecture:** Create three custom hooks (`usePhotosWithClusters`, `useAllPeople`, `useAlbumLightbox`) for data management and one container component (`AlbumViewContainer`) for common UI patterns. This establishes a scalable foundation for multi-collection support, pagination, and new album view types.

**Tech Stack:** React hooks, React Query, TypeScript, existing Azure API integration

---

## Phase 1: Build Infrastructure

### Task 1: Create usePhotosWithClusters Hook

**Files:**
- Create: `src/hooks/useAlbumPhotos.ts`
- Reference: `src/hooks/usePhotos.ts` (existing patterns)
- Reference: `src/hooks/useFaces.ts` (cluster fetching)

**Step 1: Write the hook skeleton with types**

Create `src/hooks/useAlbumPhotos.ts`:

```typescript
import { useMemo } from 'react';
import { Photo, FaceDetection } from '@/types/photo';
import { useCollectionPhotos } from '@/hooks/usePhotos';
import { useClusters } from '@/hooks/useFaces';
import { apiBboxToUi } from '@/types/coordinates';

export interface PhotoFilters {
  yearRange?: [number, number];
  personIds?: string[];
  tags?: string[];
  favoriteOnly?: boolean;
}

export interface UsePhotosWithClustersResult {
  photos: Photo[];
  allPhotos: Photo[]; // Unfiltered
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  // TODO: Implementation
  return {
    photos: [],
    allPhotos: [],
    isLoading: false,
    error: null,
    refetch: () => {},
  };
}
```

**Step 2: Implement base photo fetching**

Add to `src/hooks/useAlbumPhotos.ts`:

```typescript
export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  // Handle single or multiple collections
  const normalizedCollectionId = Array.isArray(collectionId) ? collectionId[0] : collectionId;

  // Fetch base photos
  const {
    data: azurePhotos = [],
    isLoading: photosLoading,
    error: photosError,
    refetch: refetchPhotos
  } = useCollectionPhotos(normalizedCollectionId);

  // Fetch cluster data
  const {
    data: clusterData = [],
    isLoading: clustersLoading,
    error: clustersError
  } = useClusters(normalizedCollectionId);

  const isLoading = photosLoading || clustersLoading;
  const error = photosError || clustersError || null;

  // TODO: Merge cluster faces and apply filters

  return {
    photos: [],
    allPhotos: [],
    isLoading,
    error,
    refetch: refetchPhotos,
  };
}
```

**Step 3: Implement cluster face merging**

Update the hook to merge cluster faces into photos:

```typescript
export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  // ... existing fetch code ...

  // Convert Azure photos to UI format with cluster faces
  const allPhotos = useMemo(() => {
    return azurePhotos.map(azurePhoto => {
      // Start with named faces
      let faces: FaceDetection[] = azurePhoto.people
        .filter(person => person.face_bbox !== null)
        .map(person => ({
          personId: person.id,
          personName: person.name,
          boundingBox: person.face_bbox!,
        }));

      // Add cluster faces for this photo
      clusterData.forEach(cluster => {
        const clusterFacesForPhoto = cluster.faces.filter(
          f => f.photo_id === azurePhoto.id
        );
        clusterFacesForPhoto.forEach(clusterFace => {
          faces.push({
            personId: cluster.id,
            personName: null,
            boundingBox: apiBboxToUi(clusterFace.bbox),
          });
        });
      });

      return {
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
        faces,
        taken_at: null,
      } as Photo;
    });
  }, [azurePhotos, clusterData]);

  // TODO: Apply filters

  return {
    photos: allPhotos,
    allPhotos,
    isLoading,
    error,
    refetch: refetchPhotos,
  };
}
```

**Step 4: Implement filtering logic**

Add filter application:

```typescript
export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  // ... existing code ...

  // Apply filters
  const photos = useMemo(() => {
    if (!filters) return allPhotos;

    let filtered = [...allPhotos];

    // Year filter
    if (filters.yearRange) {
      const [minYear, maxYear] = filters.yearRange;
      filtered = filtered.filter(photo => {
        const year = photo.user_corrected_year || photo.estimated_year;
        if (!year) return true;
        return year >= minYear && year <= maxYear;
      });
    }

    // People filter
    if (filters.personIds && filters.personIds.length > 0) {
      filtered = filtered.filter(photo =>
        photo.faces?.some(face =>
          face.personId && filters.personIds!.includes(face.personId)
        )
      );
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(photo =>
        filters.tags!.some(tag => photo.tags?.includes(tag))
      );
    }

    // Favorites filter
    if (filters.favoriteOnly) {
      filtered = filtered.filter(photo => photo.is_favorite);
    }

    return filtered;
  }, [allPhotos, filters]);

  return {
    photos,
    allPhotos,
    isLoading,
    error,
    refetch: refetchPhotos,
  };
}
```

**Step 5: Test the hook manually**

Create a test page or add to existing page temporarily:

```typescript
// In src/pages/Index.tsx temporarily
import { usePhotosWithClusters } from '@/hooks/useAlbumPhotos';

const { photos, isLoading, error } = usePhotosWithClusters(firstCollectionId, {
  favoriteOnly: false,
});

console.log('Photos with clusters:', photos.length);
console.log('Sample photo faces:', photos[0]?.faces);
```

**Step 6: Commit**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "feat: add usePhotosWithClusters hook for unified photo fetching"
```

---

### Task 2: Create useAllPeople Hook

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts`
- Reference: `src/hooks/usePeople.ts`
- Reference: `src/hooks/useFaces.ts`

**Step 1: Add useAllPeople hook to useAlbumPhotos.ts**

Add to `src/hooks/useAlbumPhotos.ts`:

```typescript
import { usePeople } from '@/hooks/usePeople';
import { PersonCluster } from '@/types/person';

export interface UseAllPeopleResult {
  allPeople: PersonCluster[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAllPeople(
  collectionId: string | string[] | undefined
): UseAllPeopleResult {
  // Handle single or multiple collections
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

  // Fetch clusters
  const {
    data: clusterData = [],
    isLoading: clustersLoading,
    error: clustersError,
    refetch: refetchClusters,
  } = useClusters(normalizedCollectionId);

  const isLoading = peopleLoading || clustersLoading;
  const error = peopleError || clustersError || null;

  // Combine named people and clusters into PersonCluster[]
  const allPeople = useMemo(() => {
    const peopleList: PersonCluster[] = [
      // Named people
      ...namedPeople.map(p => ({
        id: p.id,
        name: p.name,
        thumbnailPath: p.thumbnail_url || '',
        thumbnailBbox: p.thumbnail_bbox || null,
        photoCount: p.photo_count,
        photos: [],
      })),
      // Unnamed clusters
      ...clusterData.map(cluster => {
        const photoIds = Array.from(new Set(cluster.faces.map(f => f.photo_id)));
        const representativeFace = cluster.faces.find(
          f => f.id === cluster.representative_face_id
        ) || cluster.faces[0];

        return {
          id: cluster.id,
          name: null,
          thumbnailPath: cluster.representative_thumbnail_url || representativeFace.photo_id,
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
```

**Step 2: Test the hook**

Add to test page:

```typescript
const { allPeople, isLoading } = useAllPeople(firstCollectionId);

console.log('All people (named + clusters):', allPeople.length);
console.log('Named people:', allPeople.filter(p => p.name).length);
console.log('Clusters:', allPeople.filter(p => !p.name).length);
```

**Step 3: Commit**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "feat: add useAllPeople hook for unified people/cluster fetching"
```

---

### Task 3: Create useAlbumLightbox Hook

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts`
- Reference: `src/components/Lightbox.tsx` (existing lightbox patterns)

**Step 1: Add useAlbumLightbox hook**

Add to `src/hooks/useAlbumPhotos.ts`:

```typescript
import { useState, useCallback } from 'react';
import { useToggleFavorite } from '@/hooks/usePhotos';

export interface UseAlbumLightboxResult {
  lightboxPhoto: Photo | null;
  isOpen: boolean;
  openLightbox: (photo: Photo) => void;
  closeLightbox: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  handleToggleFavorite: (photoId: string) => void;
  currentIndex: number;
}

export function useAlbumLightbox(photos: Photo[]): UseAlbumLightboxResult {
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const toggleFavoriteMutation = useToggleFavorite();

  const currentIndex = lightboxPhoto
    ? photos.findIndex(p => p.id === lightboxPhoto.id)
    : -1;

  const openLightbox = useCallback((photo: Photo) => {
    setLightboxPhoto(photo);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxPhoto(null);
  }, []);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setLightboxPhoto(photos[currentIndex - 1]);
    } else if (photos.length > 0) {
      setLightboxPhoto(photos[photos.length - 1]);
    }
  }, [currentIndex, photos]);

  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setLightboxPhoto(photos[currentIndex + 1]);
    } else if (photos.length > 0) {
      setLightboxPhoto(photos[0]);
    }
  }, [currentIndex, photos]);

  const handleToggleFavorite = useCallback((photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    toggleFavoriteMutation.mutate({
      photoId,
      currentlyFavorited: photo.is_favorite,
    });

    // Update lightbox photo immediately for responsive UI
    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto({
        ...lightboxPhoto,
        is_favorite: !lightboxPhoto.is_favorite,
      });
    }
  }, [photos, lightboxPhoto, toggleFavoriteMutation]);

  return {
    lightboxPhoto,
    isOpen: !!lightboxPhoto,
    openLightbox,
    closeLightbox,
    goToPrevious,
    goToNext,
    handleToggleFavorite,
    currentIndex,
  };
}
```

**Step 2: Test the hook**

Add to test page:

```typescript
const lightbox = useAlbumLightbox(photos);

// Test opening lightbox
<button onClick={() => lightbox.openLightbox(photos[0])}>
  Open Lightbox
</button>

<Lightbox
  photo={lightbox.lightboxPhoto}
  isOpen={lightbox.isOpen}
  onClose={lightbox.closeLightbox}
  onPrevious={lightbox.goToPrevious}
  onNext={lightbox.goToNext}
  onToggleFavorite={lightbox.handleToggleFavorite}
  allPeople={allPeople}
  collectionId={firstCollectionId}
/>
```

**Step 3: Commit**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "feat: add useAlbumLightbox hook for unified lightbox management"
```

---

### Task 4: Create AlbumViewContainer Component

**Files:**
- Create: `src/components/AlbumViewContainer.tsx`
- Reference: `src/pages/Index.tsx` (existing layout patterns)
- Reference: `src/components/AlbumViewControls.tsx`

**Step 1: Create component skeleton with types**

Create `src/components/AlbumViewContainer.tsx`:

```typescript
import { ReactNode } from 'react';
import { Photo } from '@/types/photo';
import { PersonCluster } from '@/types/person';

export interface AlbumViewContainerProps {
  photos: Photo[];
  allPeople: PersonCluster[];
  collectionId: string | string[];
  isLoading?: boolean;

  // View customization
  showFilters?: boolean;
  showViewControls?: boolean;
  defaultZoomLevel?: number;
  gridMode?: 'standard' | 'faces';
  personId?: string; // For face mode

  // Selection & Actions
  enableSelection?: boolean;
  availableActions?: ('download' | 'share' | 'delete' | 'remove')[];
  onBulkAction?: (action: string, photoIds: string[]) => void;

  // Custom renders
  renderHeader?: () => ReactNode;
  renderFilters?: () => ReactNode;
  renderEmptyState?: () => ReactNode;

  // Callbacks
  onPhotoSelect?: (photoIds: string[]) => void;
  onNavigate?: (path: string) => void;
}

export function AlbumViewContainer(props: AlbumViewContainerProps) {
  // TODO: Implementation
  return <div>Album View Container</div>;
}
```

**Step 2: Implement view state management**

Add to `src/components/AlbumViewContainer.tsx`:

```typescript
import { useState } from 'react';
import { AlbumViewControls } from '@/components/AlbumViewControls';
import { useAlbumLightbox } from '@/hooks/useAlbumPhotos';

export function AlbumViewContainer({
  photos,
  allPeople,
  collectionId,
  isLoading = false,
  showViewControls = true,
  defaultZoomLevel = 4,
  gridMode = 'standard',
  personId,
  enableSelection = true,
  ...props
}: AlbumViewContainerProps) {
  // View controls state
  const [zoomLevel, setZoomLevel] = useState(defaultZoomLevel);
  const [showDates, setShowDates] = useState(true);
  const [cropSquare, setCropSquare] = useState(true);
  const [showFaces, setShowFaces] = useState(false);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  // Lightbox management
  const lightbox = useAlbumLightbox(photos);

  // TODO: Implement handlers and render

  return (
    <div className="flex-1 flex flex-col">
      {/* View controls */}
      {showViewControls && (
        <AlbumViewControls
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          showDates={showDates}
          onToggleDates={() => setShowDates(!showDates)}
          cropSquare={cropSquare}
          onToggleCropSquare={() => setCropSquare(!cropSquare)}
          showFaces={showFaces}
          onToggleFaces={() => setShowFaces(!showFaces)}
        />
      )}

      {/* Content will go here */}
    </div>
  );
}
```

**Step 3: Implement selection handlers**

Add selection logic:

```typescript
export function AlbumViewContainer({...}: AlbumViewContainerProps) {
  // ... existing state ...

  const handleSelectPhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedPhotos(new Set());
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkAction = (action: string) => {
    if (props.onBulkAction) {
      props.onBulkAction(action, Array.from(selectedPhotos));
    }
  };

  // ... rest of component ...
}
```

**Step 4: Implement photo grid rendering**

Add grid rendering:

```typescript
import { PhotoCard } from '@/components/PhotoCard';
import { FacePhotoCard } from '@/components/FacePhotoCard';

export function AlbumViewContainer({...}: AlbumViewContainerProps) {
  // ... existing code ...

  const handlePhotoClick = (photo: Photo) => {
    if (!isSelectionMode) {
      lightbox.openLightbox(photo);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* View controls */}
      {showViewControls && (
        <AlbumViewControls {...} />
      )}

      <main className="flex-1 p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Custom header */}
          {props.renderHeader?.()}

          {/* Selection mode controls */}
          {enableSelection && (
            <div className="flex items-center gap-2">
              {isSelectionMode ? (
                <>
                  <Button onClick={handleToggleSelectAll}>
                    {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button onClick={handleClearSelection}>Cancel</Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleToggleSelectionMode}>
                  Select
                </Button>
              )}
            </div>
          )}

          {/* Photo grid */}
          {isLoading ? (
            <div>Loading...</div>
          ) : photos.length === 0 ? (
            props.renderEmptyState?.() || <div>No photos found</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${zoomLevel}, minmax(0, 1fr))`,
                gap: '0.5rem',
              }}
            >
              {photos.map(photo => {
                if (gridMode === 'faces' && personId) {
                  return (
                    <FacePhotoCard
                      key={photo.id}
                      photo={photo}
                      personId={personId}
                      isSelected={selectedPhotos.has(photo.id)}
                      onSelect={handleSelectPhoto}
                      onClick={() => handlePhotoClick(photo)}
                      isSelectionMode={isSelectionMode}
                    />
                  );
                }

                return (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedPhotos.has(photo.id)}
                    onSelect={() => handleSelectPhoto(photo.id)}
                    onClick={() => handlePhotoClick(photo)}
                    isSelectionMode={isSelectionMode}
                    cropSquare={cropSquare}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

**Step 5: Add Lightbox integration**

Complete the component with lightbox:

```typescript
import { Lightbox } from '@/components/Lightbox';
import { SharePhotosDialog } from '@/components/SharePhotosDialog';
import { Button } from '@/components/ui/button';

export function AlbumViewContainer({...}: AlbumViewContainerProps) {
  const [showShareDialog, setShowShareDialog] = useState(false);

  // ... existing code ...

  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* ... existing grid rendering ... */}
      </div>

      {/* Lightbox */}
      <Lightbox
        photo={lightbox.lightboxPhoto}
        isOpen={lightbox.isOpen}
        onClose={lightbox.closeLightbox}
        onPrevious={lightbox.goToPrevious}
        onNext={lightbox.goToNext}
        onToggleFavorite={lightbox.handleToggleFavorite}
        onUpdateFaces={async () => {
          // Trigger refetch if needed
        }}
        allPeople={allPeople}
        collectionId={Array.isArray(collectionId) ? collectionId[0] : collectionId}
      />

      {/* Share dialog */}
      <SharePhotosDialog
        photoIds={Array.from(selectedPhotos)}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        onShareComplete={() => {
          setSelectedPhotos(new Set());
          setIsSelectionMode(false);
        }}
      />
    </>
  );
}
```

**Step 6: Test the component**

Add to test page:

```typescript
import { AlbumViewContainer } from '@/components/AlbumViewContainer';

const { photos, isLoading } = usePhotosWithClusters(firstCollectionId);
const { allPeople } = useAllPeople(firstCollectionId);

return (
  <AlbumViewContainer
    photos={photos}
    allPeople={allPeople}
    collectionId={firstCollectionId}
    isLoading={isLoading}
    defaultZoomLevel={4}
  />
);
```

**Step 7: Commit**

```bash
git add src/components/AlbumViewContainer.tsx
git commit -m "feat: add AlbumViewContainer for unified album UI"
```

---

## Phase 2: Migrate Existing Pages

### Task 5: Migrate Index.tsx

**Files:**
- Modify: `src/pages/Index.tsx`

**Step 1: Import new hooks and component**

Update imports in `src/pages/Index.tsx`:

```typescript
import { usePhotosWithClusters, useAllPeople } from '@/hooks/useAlbumPhotos';
import { AlbumViewContainer } from '@/components/AlbumViewContainer';
```

**Step 2: Replace existing logic with hooks**

Find the existing photo fetching and people logic (around line 30-100) and replace with:

```typescript
const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Multi-collection support - currently showing first collection only
  const { data: collections } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Use new hooks
  const { photos, isLoading, error } = usePhotosWithClusters(firstCollectionId);
  const { allPeople } = useAllPeople(firstCollectionId);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewContainer
            photos={photos}
            allPeople={allPeople}
            collectionId={firstCollectionId!}
            defaultZoomLevel={4}
            showViewControls
            enableSelection
          />
        </div>
      </div>
    </SidebarProvider>
  );
};
```

**Step 3: Remove old code**

Delete the following from Index.tsx:
- Old photo transformation logic (lines ~40-75)
- Old people extraction useEffect (lines ~76-95)
- Old lightbox state and handlers (lines ~100-150)
- Old PhotoGrid and Lightbox manual setup (lines ~200-300)

Keep only:
- Auth check logic
- Layout wrapper (SidebarProvider, AppSidebar, Header)
- New hook calls
- AlbumViewContainer usage

**Step 4: Test the migrated page**

Run the app and verify:
```bash
npm run dev
```

Test:
- Photos load correctly
- Cluster faces show with orange borders in lightbox
- Selection mode works
- Lightbox navigation works
- View controls (zoom, dates, crop) work

**Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "refactor: migrate Index to use AlbumViewContainer"
```

---

### Task 6: Migrate CollectionDetail.tsx

**Files:**
- Modify: `src/pages/CollectionDetail.tsx`

**Step 1: Import new hooks and component**

Update imports:

```typescript
import { usePhotosWithClusters, useAllPeople, PhotoFilters } from '@/hooks/useAlbumPhotos';
import { AlbumViewContainer } from '@/components/AlbumViewContainer';
```

**Step 2: Replace photo/people logic**

Replace the existing photo conversion and people extraction logic with:

```typescript
export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useApiAuth();

  // Filter states
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Build filters object
  const filters: PhotoFilters = {
    yearRange,
    personIds: selectedPeople.length > 0 ? selectedPeople : undefined,
    tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
    favoriteOnly: showFavoritesOnly,
  };

  // Use new hooks
  const { photos, allPhotos, isLoading, error } = usePhotosWithClusters(id, filters);
  const { allPeople } = useAllPeople(id);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewContainer
            photos={photos}
            allPeople={allPeople}
            collectionId={id!}
            showFilters
            renderFilters={() => (
              <PhotoFilters
                yearRange={yearRange}
                onYearRangeChange={setYearRange}
                selectedPeople={selectedPeople}
                onPeopleChange={setSelectedPeople}
                allPeople={allPeople}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                allTags={Array.from(new Set(allPhotos.flatMap(p => p.tags || [])))}
                showFavoritesOnly={showFavoritesOnly}
                onFavoritesChange={setShowFavoritesOnly}
              />
            )}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
```

**Step 3: Remove old code**

Delete:
- Old photo conversion useEffect (lines ~65-142)
- Old people extraction useEffect (lines ~144-172)
- Old lightbox management code (lines ~180-250)
- Old manual grid and lightbox rendering

**Step 4: Test**

Run and verify:
- Filters work correctly
- Photos update when filters change
- Cluster faces appear correctly
- All previous functionality works

**Step 5: Commit**

```bash
git add src/pages/CollectionDetail.tsx
git commit -m "refactor: migrate CollectionDetail to use AlbumViewContainer"
```

---

### Task 7: Migrate PersonAlbum.tsx

**Files:**
- Modify: `src/pages/PersonAlbum.tsx`

**Step 1: Import new hooks and component**

Update imports:

```typescript
import { usePhotosWithClusters, useAllPeople } from '@/hooks/useAlbumPhotos';
import { AlbumViewContainer } from '@/components/AlbumViewContainer';
```

**Step 2: Simplify PersonAlbum with hooks**

Replace the complex photo filtering logic with:

```typescript
export default function PersonAlbum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Multi-collection support - currently showing first collection only
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Use new hooks with person filter
  const { photos, isLoading: photosLoading } = usePhotosWithClusters(
    firstCollectionId,
    { personIds: [id!] }
  );
  const { allPeople } = useAllPeople(firstCollectionId);

  // Find current person/cluster
  const displayPerson = allPeople.find(p => p.id === id);
  const isCluster = displayPerson && !displayPerson.name;

  const loading = collectionsLoading || photosLoading;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!displayPerson) {
    return <div>Person not found</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewContainer
            photos={photos}
            allPeople={allPeople}
            collectionId={firstCollectionId!}
            gridMode="faces"
            personId={id}
            showViewControls
            renderHeader={() => (
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/people")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <PersonThumbnail
                  photoUrl={displayPerson.thumbnailPath}
                  bbox={displayPerson.thumbnailBbox}
                  size="sm"
                />
                <div>
                  <h1 className="text-2xl font-bold">
                    {displayPerson.name || 'Unnamed Cluster'}
                  </h1>
                  <p className="text-muted-foreground">
                    {displayPerson.photoCount} {displayPerson.photoCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
```

**Step 3: Remove old code**

Delete:
- Complex photo filtering logic (lines ~106-166)
- Manual lightbox setup (lines ~726-756)
- Manual grid rendering

Keep:
- NamingDialog (still needed for naming clusters)
- SharePhotosDialog (still needed)

**Step 4: Test**

Verify:
- Person album shows face-zoomed grid
- Cluster albums work correctly
- Orange borders show for cluster faces
- Navigation works

**Step 5: Commit**

```bash
git add src/pages/PersonAlbum.tsx
git commit -m "refactor: migrate PersonAlbum to use AlbumViewContainer"
```

---

### Task 8: Migrate UnknownPeople.tsx

**Files:**
- Modify: `src/pages/UnknownPeople.tsx`

**Step 1: Simplify with new hooks**

Replace photo fetching logic with:

```typescript
import { usePhotosWithClusters, useAllPeople } from '@/hooks/useAlbumPhotos';
import { AlbumViewContainer } from '@/components/AlbumViewContainer';

export default function UnknownPeople() {
  const navigate = useNavigate();
  const { data: collections } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Fetch all photos
  const { photos: allPhotos, isLoading } = usePhotosWithClusters(firstCollectionId);
  const { allPeople } = useAllPeople(firstCollectionId);

  // Filter to only unnamed individual photos (not in clusters)
  const clusterPersonIds = new Set(
    allPeople.filter(p => !p.name).map(p => p.id)
  );

  const unnamedPhotos = allPhotos.filter(photo => {
    const hasUnnamedFace = photo.faces?.some(face =>
      !face.personName && !clusterPersonIds.has(face.personId || '')
    );
    return hasUnnamedFace;
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewContainer
            photos={unnamedPhotos}
            allPeople={allPeople}
            collectionId={firstCollectionId!}
            isLoading={isLoading}
            renderHeader={() => (
              <div>
                <h1 className="text-2xl font-bold">Unknown People</h1>
                <p className="text-muted-foreground">
                  Photos with unnamed faces that aren't in clusters
                </p>
              </div>
            )}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
```

**Step 2: Remove old code**

Delete all old photo transformation and filtering logic.

**Step 3: Test and commit**

```bash
git add src/pages/UnknownPeople.tsx
git commit -m "refactor: migrate UnknownPeople to use AlbumViewContainer"
```

---

## Phase 3: Add Pagination Support

### Task 9: Add Pagination to Backend Integration

**Files:**
- Modify: `src/lib/azureApiClient.ts`
- Reference: Existing cursor-based pagination in backend

**Step 1: Update PhotoFilters type**

In `src/lib/azureApiClient.ts`, find the `PhotoFilters` interface and add cursor support:

```typescript
export interface PhotoFilters {
  person_id?: string;
  year_min?: number;
  year_max?: number;
  tags?: string;
  favorite?: boolean;
  limit?: number;
  cursor?: string;  // Already exists, verify it's there
}
```

**Step 2: Verify getCollectionPhotos supports cursor**

Check that `getCollectionPhotos` method already passes cursor parameter:

```typescript
async getCollectionPhotos(
  collectionId: string,
  filters?: PhotoFilters
): Promise<Photo[]> {
  const params = new URLSearchParams();

  if (filters) {
    // ... existing filter params ...
    if (filters.cursor) params.append('cursor', filters.cursor);
  }

  // ... rest of method ...
}
```

**Step 3: Add response type for paginated data**

Add new type for paginated responses:

```typescript
export interface PaginatedPhotosResponse {
  photos: Photo[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}
```

**Step 4: Create paginated fetch method**

Add new method for paginated fetching:

```typescript
async getCollectionPhotosPaginated(
  collectionId: string,
  filters?: PhotoFilters
): Promise<PaginatedPhotosResponse> {
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

  // Set default page size
  if (!filters?.limit) {
    params.append('limit', '50');
  }

  const query = params.toString();
  const endpoint = `/v1/collections/${collectionId}/photos${query ? `?${query}` : ''}`;

  const response = await this.request<any>(endpoint);

  // Backend should return { photos: [...], cursor: "...", hasMore: true }
  // If not, adapt to actual backend response format
  return {
    photos: response.photos || response,
    cursor: response.cursor,
    hasMore: response.hasMore ?? false,
    total: response.total,
  };
}
```

**Step 5: Commit**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add pagination support to Azure API client"
```

---

### Task 10: Update usePhotosWithClusters for Pagination

**Files:**
- Modify: `src/hooks/useAlbumPhotos.ts`

**Step 1: Add pagination state and types**

Update the hook signature and return type:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

export interface UsePhotosWithClustersResult {
  photos: Photo[];
  allPhotos: Photo[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  refetch: () => void;
  loadMore: () => void;
  hasMore: boolean;
  totalCount?: number;
}

export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  // Implementation below
}
```

**Step 2: Replace useQuery with useInfiniteQuery**

Update the hook implementation:

```typescript
export function usePhotosWithClusters(
  collectionId: string | string[] | undefined,
  filters?: PhotoFilters
): UsePhotosWithClustersResult {
  const normalizedCollectionId = Array.isArray(collectionId)
    ? collectionId[0]
    : collectionId;

  // Fetch photos with pagination
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

      return azureApi.getCollectionPhotosPaginated(normalizedCollectionId, {
        ...filters,
        cursor: pageParam,
        limit: 50,
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.cursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!normalizedCollectionId,
  });

  // Fetch cluster data (not paginated)
  const {
    data: clusterData = [],
    isLoading: clustersLoading,
    error: clustersError
  } = useClusters(normalizedCollectionId);

  // Flatten paginated photos
  const azurePhotos = photosData?.pages.flatMap(page => page.photos) ?? [];
  const totalCount = photosData?.pages[0]?.total;

  const isLoading = photosLoading || clustersLoading;
  const error = photosError || clustersError || null;

  // Convert and merge cluster faces (same logic as before)
  const allPhotos = useMemo(() => {
    return azurePhotos.map(azurePhoto => {
      // ... existing conversion logic ...
    });
  }, [azurePhotos, clusterData]);

  // Apply filters (same as before)
  const photos = useMemo(() => {
    // ... existing filter logic ...
  }, [allPhotos, filters]);

  return {
    photos,
    allPhotos,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error,
    refetch: refetchPhotos,
    loadMore: () => fetchNextPage(),
    hasMore: hasNextPage ?? false,
    totalCount,
  };
}
```

**Step 3: Test pagination**

Add debug logging:

```typescript
console.log('Pagination state:', {
  photosLoaded: photos.length,
  hasMore,
  isLoadingMore,
  totalCount,
});
```

**Step 4: Commit**

```bash
git add src/hooks/useAlbumPhotos.ts
git commit -m "feat: add pagination support to usePhotosWithClusters"
```

---

### Task 11: Add Infinite Scroll to AlbumViewContainer

**Files:**
- Modify: `src/components/AlbumViewContainer.tsx`
- Add dependency: `react-intersection-observer`

**Step 1: Install dependency**

```bash
npm install react-intersection-observer
```

**Step 2: Update AlbumViewContainer props**

Add pagination props:

```typescript
export interface AlbumViewContainerProps {
  // ... existing props ...

  // Pagination
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}
```

**Step 3: Add infinite scroll trigger**

Import and use intersection observer:

```typescript
import { useInView } from 'react-intersection-observer';

export function AlbumViewContainer({
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  ...props
}: AlbumViewContainerProps) {
  // ... existing state ...

  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px', // Trigger 200px before reaching end
  });

  // Trigger load more when in view
  useEffect(() => {
    if (inView && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [inView, hasMore, isLoadingMore, onLoadMore]);

  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* ... existing content ... */}

        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-4 md:space-y-6">
            {/* Photo grid */}
            <div style={{...}}>
              {photos.map(photo => (
                // ... existing photo cards ...
              ))}
            </div>

            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isLoadingMore ? (
                  <div className="text-muted-foreground">Loading more...</div>
                ) : (
                  <div className="h-4" />
                )}
              </div>
            )}

            {/* End of results */}
            {!hasMore && photos.length > 0 && (
              <div className="text-center text-muted-foreground py-4">
                All photos loaded
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ... existing lightbox and dialogs ... */}
    </>
  );
}
```

**Step 4: Update page usage**

Update Index.tsx to pass pagination props:

```typescript
const { photos, hasMore, isLoadingMore, loadMore, isLoading } = usePhotosWithClusters(firstCollectionId);

return (
  <AlbumViewContainer
    photos={photos}
    allPeople={allPeople}
    collectionId={firstCollectionId}
    hasMore={hasMore}
    isLoadingMore={isLoadingMore}
    onLoadMore={loadMore}
    isLoading={isLoading}
  />
);
```

**Step 5: Test infinite scroll**

Run the app and verify:
- Initial 50 photos load
- Scrolling to bottom loads next page
- Loading indicator appears
- Stops when no more photos

**Step 6: Commit**

```bash
git add src/components/AlbumViewContainer.tsx src/pages/Index.tsx package.json
git commit -m "feat: add infinite scroll to AlbumViewContainer"
```

---

### Task 12: Update All Pages with Pagination

**Files:**
- Modify: `src/pages/CollectionDetail.tsx`
- Modify: `src/pages/PersonAlbum.tsx`
- Modify: `src/pages/UnknownPeople.tsx`

**Step 1: Update CollectionDetail.tsx**

Add pagination props:

```typescript
const { photos, allPhotos, hasMore, isLoadingMore, loadMore, isLoading } =
  usePhotosWithClusters(id, filters);

return (
  <AlbumViewContainer
    photos={photos}
    allPeople={allPeople}
    collectionId={id!}
    hasMore={hasMore}
    isLoadingMore={isLoadingMore}
    onLoadMore={loadMore}
    isLoading={isLoading}
    // ... other props ...
  />
);
```

**Step 2: Update PersonAlbum.tsx**

```typescript
const { photos, hasMore, isLoadingMore, loadMore, isLoading } =
  usePhotosWithClusters(firstCollectionId, { personIds: [id!] });

return (
  <AlbumViewContainer
    photos={photos}
    allPeople={allPeople}
    collectionId={firstCollectionId!}
    hasMore={hasMore}
    isLoadingMore={isLoadingMore}
    onLoadMore={loadMore}
    // ... other props ...
  />
);
```

**Step 3: Update UnknownPeople.tsx**

```typescript
const { photos: allPhotos, hasMore, isLoadingMore, loadMore, isLoading } =
  usePhotosWithClusters(firstCollectionId);

// Filter logic...

return (
  <AlbumViewContainer
    photos={unnamedPhotos}
    allPeople={allPeople}
    collectionId={firstCollectionId!}
    hasMore={hasMore}
    isLoadingMore={isLoadingMore}
    onLoadMore={loadMore}
    isLoading={isLoading}
    // ... other props ...
  />
);
```

**Step 4: Test all pages**

Verify pagination works on:
- Index (all photos)
- CollectionDetail (with filters)
- PersonAlbum (person-specific photos)
- UnknownPeople (filtered unnamed)

**Step 5: Commit**

```bash
git add src/pages/CollectionDetail.tsx src/pages/PersonAlbum.tsx src/pages/UnknownPeople.tsx
git commit -m "feat: enable pagination on all album pages"
```

---

## Final Verification

### Task 13: Comprehensive Testing

**Step 1: Test Index page**

- Navigate to timeline
- Verify photos load in batches of 50
- Scroll to trigger next page load
- Open lightbox, verify cluster faces show orange borders
- Test selection mode and bulk actions
- Test view controls (zoom, dates, crop)

**Step 2: Test CollectionDetail page**

- Navigate to a collection
- Test all filters (year, person, tags, favorites)
- Verify pagination works with filters
- Test lightbox with cluster faces
- Test selection and sharing

**Step 3: Test PersonAlbum page**

- Click on a named person
- Verify face-zoomed grid view
- Test pagination
- Click on a cluster
- Verify cluster faces show orange borders
- Test naming workflow

**Step 4: Test UnknownPeople page**

- Navigate to unknown people
- Verify only individual unnamed photos show (no clusters)
- Test pagination
- Test lightbox

**Step 5: Test edge cases**

- Empty collection (no photos)
- Collection with 1000+ photos
- Filters that return no results
- Rapid scrolling
- Network errors (simulate offline)

**Step 6: Document issues found**

Create `docs/testing/album-refactor-issues.md` if any issues found.

---

## Rollout Strategy

**Recommended Approach:**

1. **Merge to feature branch first** - Don't merge directly to main
2. **Test in staging environment** - Deploy feature branch to test URL
3. **Monitor performance** - Check load times with 1000+ photos
4. **Gradual rollout** - If possible, A/B test with subset of users
5. **Have rollback plan** - Keep old code for one release cycle

**Performance Targets:**
- Initial page load: <2s
- Infinite scroll trigger: <500ms
- Lightbox open: <300ms

---

## Success Criteria

✅ All four pages use AlbumViewContainer
✅ No code duplication for photo/cluster fetching
✅ Pagination works across all views
✅ Cluster faces show orange borders consistently
✅ All existing features still work
✅ Tests pass (if any exist)
✅ No performance regression

---

## Future Enhancements

These were discussed but deferred:

1. **Multi-collection support** - Pass array of collection IDs
2. **Download format selection** - Add to bulk actions
3. **Virtual scrolling** - Replace infinite scroll with react-window
4. **Progressive image loading** - Add LQIP/blurhash
5. **CDN integration** - Backend optimization

Each can be added without changing the architecture.

---

## Notes for Engineers

**Code Style:**
- Use functional components with hooks
- Prefer composition over inheritance
- Keep components under 300 lines
- Extract complex logic to custom hooks

**Testing Approach:**
- Test hooks independently
- Test AlbumViewContainer with mock data
- Integration test on real pages
- Manual testing in browser for UI/UX

**Common Pitfalls:**
- Don't forget to pass `clusterData` dependency to useMemo
- Infinite scroll needs debouncing for rapid scrolling
- Lightbox needs proper cleanup on unmount
- React Query cache may need invalidation after mutations

**Getting Help:**
- Check existing hook patterns in `src/hooks/`
- Reference AlbumViewControls for UI patterns
- See PersonAlbum for face-mode example
