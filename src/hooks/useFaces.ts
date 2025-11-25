import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { azureApi, FaceTag, CreatePersonRequest, UpdatePersonRequest } from '@/lib/azureApiClient';

/**
 * Hook to fetch face clusters for a collection
 */
export function useClusters(
  collectionId: string | undefined,
  options?: { enabled?: boolean }  // ADD THIS
) {
  return useQuery({
    queryKey: ['clusters', collectionId],
    queryFn: () => {
      if (!collectionId) {
        throw new Error('Collection ID is required');
      }
      return azureApi.getClusters(collectionId);
    },
    enabled: (options?.enabled ?? true) && !!collectionId,  // UPDATE THIS
  });
}

/**
 * Hook to update face tags on a photo
 */
export function useUpdatePhotoFaces() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, faces }: { photoId: string; faces: FaceTag[] }) =>
      azureApi.updatePhotoFaces(photoId, faces),
    onSuccess: () => {
      // Invalidate all photo queries to refetch with updated faces
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}

/**
 * Hook to create a new person
 */
export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreatePersonRequest) =>
      azureApi.createPerson(request),
    onSuccess: () => {
      // Invalidate collections to refresh people lists
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

/**
 * Hook to update a person's name
 */
export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ personId, request }: { personId: string; request: UpdatePersonRequest }) =>
      azureApi.updatePerson(personId, request),
    onSuccess: () => {
      // Invalidate collections to refresh people data
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

/**
 * Hook to merge two people/clusters together
 */
export function useMergePeople() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetPersonId, sourcePersonId }: { targetPersonId: string; sourcePersonId: string }) =>
      azureApi.mergePeople(targetPersonId, sourcePersonId),
    onSuccess: () => {
      // Invalidate all people and cluster queries to get fresh photo counts
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });
}
