import { useQuery } from '@tanstack/react-query';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Fetch metadata for specific clusters (on-demand).
 * Used for cluster album headers - only loads what's needed.
 */
export function useClusterMetadata(
  collectionId: string | undefined,
  clusterIds: string[]
) {
  return useQuery({
    queryKey: ['cluster-metadata', collectionId, clusterIds],
    queryFn: async () => {
      if (!collectionId) throw new Error('Collection ID required');
      return azureApi.getClustersByIds(collectionId, clusterIds);
    },
    enabled: !!collectionId && clusterIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min - cluster metadata doesn't change often
  });
}

/**
 * Extract unique cluster IDs from photos.
 * Helper for determining which clusters to fetch metadata for.
 */
export function extractClusterIds(photos: Array<{ faces?: Array<{ clusterId?: string | null }> }>): string[] {
  const clusterIds = new Set<string>();

  photos.forEach(photo => {
    photo.faces?.forEach(face => {
      if (face.clusterId) {
        clusterIds.add(face.clusterId);
      }
    });
  });

  return Array.from(clusterIds);
}
