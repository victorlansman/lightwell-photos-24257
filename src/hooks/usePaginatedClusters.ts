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
