import { useQuery, useQueryClient } from '@tanstack/react-query';
import { azureApi, PhotoDetail } from '@/lib/azureApiClient';

/**
 * Fetch full photo detail including year reasoning and face bboxes.
 *
 * Use cases:
 * - Lightbox info panel (reasoning, confidence)
 * - Face tagging mode (face bboxes)
 * - Slideshow captions
 *
 * Automatically prefetches adjacent photos when enabled.
 */
export function usePhotoDetail(
  photoId: string | null | undefined,
  options?: {
    enabled?: boolean;
  }
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['photo-detail', photoId],
    queryFn: async () => {
      if (!photoId) throw new Error('Photo ID required');
      return azureApi.getPhotoDetail(photoId);
    },
    enabled: !!photoId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000, // 5 minutes - detail data doesn't change often
  });

  return {
    detail: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Prefetch photo detail into cache.
 * Call this for adjacent photos in lightbox for smooth navigation.
 */
export function usePrefetchPhotoDetail() {
  const queryClient = useQueryClient();

  return (photoId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['photo-detail', photoId],
      queryFn: () => azureApi.getPhotoDetail(photoId),
      staleTime: 5 * 60 * 1000,
    });
  };
}

/**
 * Get cached photo detail if available, without triggering fetch.
 */
export function useCachedPhotoDetail(photoId: string | null | undefined): PhotoDetail | null {
  const queryClient = useQueryClient();

  if (!photoId) return null;
  return queryClient.getQueryData(['photo-detail', photoId]) ?? null;
}
