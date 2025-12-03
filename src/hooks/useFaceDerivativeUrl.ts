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
