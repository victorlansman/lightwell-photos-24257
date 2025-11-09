import { useQuery } from '@tanstack/react-query';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Hook to fetch collections from Azure backend.
 * Replaces Supabase collection queries.
 */
export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => azureApi.getCollections(),
    select: (data) => data.collections,
    // Only fetch if user is logged in (token is set)
    enabled: true,
  });
}

/**
 * Hook to fetch single collection details
 */
export function useCollection(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId],
    queryFn: () => azureApi.getCollection(collectionId!),
    enabled: !!collectionId,
  });
}
