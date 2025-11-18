import { useMemo, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Photo, FaceDetection } from '@/types/photo';
import { useCollectionPhotos, useToggleFavorite } from '@/hooks/usePhotos';
import { useClusters } from '@/hooks/useFaces';
import { usePeople } from '@/hooks/usePeople';
import { PersonCluster } from '@/types/person';
import { apiBboxToUi } from '@/types/coordinates';
import { azureApi } from '@/lib/azureApiClient';

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
  // Handle single or multiple collections
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

      // Convert filters to API format
      const apiFilters = filters ? {
        year_min: filters.yearRange?.[0],
        year_max: filters.yearRange?.[1],
        person_id: filters.personIds?.[0],
        tags: filters.tags?.join(','),
        favorite: filters.favoriteOnly,
        cursor: pageParam,
        limit: 50,
      } : { cursor: pageParam, limit: 50 };

      return azureApi.getCollectionPhotosPaginated(normalizedCollectionId, apiFilters);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.cursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!normalizedCollectionId,
  });

  // Fetch cluster data
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

  // Apply client-side filters (after pagination)
  const photos = useMemo(() => {
    // Note: Server-side filters are applied in the query, so we don't need to re-filter here
    // unless we're doing client-side filtering on top of server-side results
    return allPhotos;
  }, [allPhotos]);

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

// ============================================================================
// TASK 2: useAllPeople Hook
// ============================================================================

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
        thumbnailPath: p.thumbnailPath || '',
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
          // Use representative face's photo_id as the thumbnail (usePhotoUrl expects a photo ID)
          thumbnailPath: representativeFace?.photo_id || '',
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
