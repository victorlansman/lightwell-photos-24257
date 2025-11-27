import { useMemo, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Photo, FaceDetection } from '@/types/photo';
import { useCollectionPhotos, useToggleFavorite } from '@/hooks/usePhotos';
import { useClusters } from '@/hooks/useFaces';
import { usePeople } from '@/hooks/usePeople';
import { PersonCluster } from '@/types/person';
import { apiBboxToUi } from '@/types/coordinates';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Extract photo ID from URL or return value as-is if already a UUID.
 * Handles backend inconsistency where photo_id field may contain full URL.
 *
 * Example: "http://.../api/faces/abc-123/thumbnail/image" -> "abc-123"
 * Example: "abc-123" -> "abc-123"
 */
function extractPhotoId(value: string | undefined): string {
  if (!value) return '';

  // If it's already a UUID-like string (not a URL), return as-is
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value;
  }

  // Extract UUID from URL path
  // Pattern: .../faces/{UUID}/... or .../photos/{UUID}/...
  const match = value.match(/\/(photos|faces)\/([a-f0-9-]+)/i);
  return match ? match[2] : value;
}

export interface PhotoFilters {
  yearRange?: [number, number];
  personIds?: string[];
  clusterIds?: string[];
  tags?: string[];
  favoriteOnly?: boolean;
}

export interface UsePhotosWithClustersResult {
  photos: Photo[];
  allPhotos: Photo[]; // Unfiltered
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
          cluster_ids: filters.clusterIds?.[0],
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

// ============================================================================
// TASK 2: useAllPeople Hook
// ============================================================================

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

  // Combine named people and clusters into PersonCluster[]
  const allPeople = useMemo(() => {
    const peopleList: PersonCluster[] = [
      // Named people (thumbnailPath already normalized by usePeople hook)
      ...namedPeople.map(p => ({
        id: p.id,
        name: p.name,
        thumbnailPath: p.thumbnailPath, // Already normalized - don't extract again
        thumbnailBbox: p.thumbnailBbox || null,
        photoCount: p.photoCount,
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
          // Use backend's representative_thumbnail_url (correct API)
          // Fallback to photo_id only if backend doesn't provide thumbnail URL
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

// ============================================================================
// TASK 3: useAlbumLightbox Hook
// ============================================================================

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
    // Request fullscreen immediately (user gesture context)
    // Must be done here before React state update breaks the gesture chain
    if (document.fullscreenElement === null) {
      document.documentElement.requestFullscreen?.().catch(() => {
        console.log('[openLightbox] Fullscreen request failed or denied');
      });
    }
    setLightboxPhoto(photo);
  }, []);

  const closeLightbox = useCallback(() => {
    // Exit fullscreen when closing lightbox
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
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
      isFavorited: !photo.is_favorite,
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
