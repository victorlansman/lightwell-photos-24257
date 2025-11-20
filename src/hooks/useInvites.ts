import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { azureApi, InviteRequest } from '@/lib/azureApiClient';

/**
 * Fetch invite details (no auth required).
 * Used on auth page to show invite preview.
 */
export function useInviteDetails(token: string | null) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => azureApi.getInviteDetails(token!),
    enabled: !!token,
    retry: false, // Don't retry on 404/410 errors
  });
}

/**
 * Accept an invite (requires auth).
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => azureApi.acceptInvite(token),
    onSuccess: () => {
      // Invalidate collections to show new collection
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

/**
 * Fetch collection members.
 */
export function useCollectionMembers(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId, 'members'],
    queryFn: () => azureApi.getCollectionMembers(collectionId!),
    enabled: !!collectionId,
  });
}

/**
 * Fetch pending invites (owners only).
 */
export function usePendingInvites(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId, 'invites'],
    queryFn: () => azureApi.getPendingInvites(collectionId!),
    enabled: !!collectionId,
  });
}

/**
 * Invite a user to collection (owners only).
 */
export function useInviteToCollection(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: InviteRequest) =>
      azureApi.inviteToCollection(collectionId, request),
    onSuccess: () => {
      // Refresh members and invites lists
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'members']
      });
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'invites']
      });
    },
  });
}

/**
 * Remove a member from collection (owners only).
 */
export function useRemoveMember(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      azureApi.removeMember(collectionId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'members']
      });
    },
  });
}

/**
 * Cancel a pending invite (owners only).
 */
export function useCancelInvite(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) =>
      azureApi.cancelInvite(collectionId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'invites']
      });
    },
  });
}

/**
 * Change member role (owners only).
 */
export function useChangeMemberRole(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'owner' | 'admin' | 'viewer' }) =>
      azureApi.changeMemberRole(collectionId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'members']
      });
    },
  });
}
