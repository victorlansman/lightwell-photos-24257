import { useQuery } from '@tanstack/react-query';
import { azureApi, PersonResponse } from '@/lib/azureApiClient';
import { PersonCluster } from '@/types/person';

/**
 * Hook to fetch all people in a collection.
 * Returns people sorted by photo_count desc, then name asc.
 */
export function usePeople(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId, 'people'],
    queryFn: async () => {
      if (!collectionId) throw new Error('Collection ID required');

      const people = await azureApi.getPeople(collectionId);

      // Transform PersonResponse[] to PersonCluster[]
      return people.map((person: PersonResponse): PersonCluster => ({
        id: person.id,
        name: person.name,
        thumbnailPath: person.thumbnail_url || '',
        thumbnailBbox: null, // Backend doesn't provide bbox yet
        photoCount: person.photo_count,
        photos: [], // Backend doesn't provide photo list yet
      }));
    },
    enabled: !!collectionId,
  });
}
