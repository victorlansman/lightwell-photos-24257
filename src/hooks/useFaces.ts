import { useMutation, useQueryClient } from '@tanstack/react-query';
import { azureApi, FaceTag, CreatePersonRequest, UpdatePersonRequest } from '@/lib/azureApiClient';

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
