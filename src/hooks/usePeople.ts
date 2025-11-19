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

      console.log('[usePeople] Received people from backend:', people);

      // Transform PersonResponse[] to PersonCluster[]
      return people.map((person: PersonResponse): PersonCluster => {
        console.log('[usePeople] Mapping person:', {
          id: person.id,
          name: person.name,
          thumbnail_url: person.thumbnail_url,
          thumbnail_bbox: person.thumbnail_bbox
        });

        // Normalize thumbnail_url: Backend returns full URLs for auto-thumbnails,
        // but usePhotoUrl expects relative paths like /api/faces/{id}/thumbnail
        let thumbnailPath = person.thumbnail_url || '';
        if (thumbnailPath.includes('/api/faces/')) {
          // Extract just the path part: /api/faces/{id}/thumbnail
          const match = thumbnailPath.match(/\/api\/faces\/[a-f0-9-]+\/thumbnail/i);
          thumbnailPath = match ? match[0] : thumbnailPath;
          console.log('[usePeople] Normalized face thumbnail URL to path:', thumbnailPath);
        }

        return {
          id: person.id,
          name: person.name,
          thumbnailPath,
          thumbnailBbox: person.thumbnail_bbox || null,
          photoCount: person.photo_count,
          photos: [], // Backend doesn't provide photo list yet
        };
      });
    },
    enabled: !!collectionId,
  });
}
