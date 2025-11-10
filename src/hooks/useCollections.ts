import { useQuery } from '@tanstack/react-query';
import { azureApi } from '@/lib/azureApiClient';
import { useApiAuth } from '@/contexts/ApiAuthContext';

/**
 * Hook to fetch collections from Azure backend.
 * Replaces Supabase collection queries.
 */
export function useCollections() {
  const { isReady } = useApiAuth();

  return useQuery({
    queryKey: ['collections'],
    queryFn: () => azureApi.getCollections(),
    // Only fetch after auth token is set
    enabled: isReady,
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
