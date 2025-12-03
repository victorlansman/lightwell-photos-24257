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
