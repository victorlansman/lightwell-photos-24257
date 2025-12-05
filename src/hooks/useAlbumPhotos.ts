import { useMemo, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Photo } from '@/types/photo';
import { useToggleFavorite } from '@/hooks/usePhotos';
import { usePaginatedPeople } from './usePaginatedPeople';
import { usePaginatedClusters } from './usePaginatedClusters';
import { PersonCluster } from '@/types/person';
import { azureApi, PhotoListItem } from '@/lib/azureApiClient';

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

  const listPhotos = photosData?.pages.flatMap(page => page.photos) ?? [];
  const totalCount = photosData?.pages[0]?.total;

  // Convert lean list response to UI Photo format
  // Note: faces/bboxes are NOT in list response - fetch detail for face tagging
  const allPhotos = useMemo((): Photo[] => {
    return listPhotos.map((photo: PhotoListItem) => ({
      id: photo.id,
      collection_id: photo.collection_id,
      path: photo.path,
      thumbnail_url: photo.thumbnail_url,
      original_filename: null,
      created_at: photo.created_at,
      display_year: photo.display_year,
      estimated_year_min: photo.estimated_year_min,
      estimated_year_max: photo.estimated_year_max,
      is_favorite: photo.is_favorite,
      tags: photo.tags,
      people: photo.people,
      width: photo.width,
      height: photo.height,
      rotation: photo.rotation,
      // Fields only available from detail endpoint:
      title: null,
      description: null,
      estimated_year: null,
      user_corrected_year: null,
      faces: undefined, // Populated from PhotoDetail when lightbox opens
      taken_at: null,
    }));
  }, [listPhotos]);

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
