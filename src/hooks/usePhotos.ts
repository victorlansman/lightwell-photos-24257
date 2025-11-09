import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { azureApi, PhotoFilters } from '@/lib/azureApiClient';

/**
 * Hook to fetch photos from a collection with filters.
 * Supports year range, person, tags, and favorites filtering.
 */
export function useCollectionPhotos(
  collectionId: string | undefined,
  filters?: PhotoFilters
) {
  return useQuery({
    queryKey: ['collections', collectionId, 'photos', filters],
    queryFn: () => azureApi.getCollectionPhotos(collectionId!, filters),
    enabled: !!collectionId,
    select: (data) => data.photos,
  });
}

/**
 * Hook to toggle photo favorite status
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, isFavorited }: { photoId: string; isFavorited: boolean }) => {
      return azureApi.toggleFavorite(photoId, isFavorited);
    },
    onSuccess: () => {
      // Invalidate all photo queries to refetch with updated favorite status
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

/**
 * Hook to update year estimation
 */
export function useUpdateYearEstimation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, update }: {
      photoId: string;
      update: {
        user_corrected_year?: number;
        user_corrected_year_min?: number;
        user_corrected_year_max?: number;
        user_year_reasoning?: string;
      }
    }) => azureApi.updateYearEstimation(photoId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
