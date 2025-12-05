import { useQuery } from '@tanstack/react-query';
import { azureApi, CurrentUser } from '@/lib/azureApiClient';

/**
 * Hook to fetch the current authenticated user.
 * Returns user info including id (for member matching), email, and name.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => azureApi.getCurrentUser(),
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 1,
  });
}
