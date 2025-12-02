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

      return people.map((person: PersonResponse): PersonCluster => ({
        id: person.id,
        name: person.name,
        representativeFaceId: person.representative_face_id,
        photoCount: person.photo_count,
        photos: [],
      }));
    },
    enabled: !!collectionId,
  });
}
