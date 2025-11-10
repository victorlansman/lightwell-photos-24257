import { useState, useEffect } from 'react';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Hook to get authenticated photo URL.
 * Creates object URL from blob for use in img src.
 */
export function usePhotoUrl(photoId: string, options?: { thumbnail?: boolean }) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    async function loadPhoto() {
      try {
        setLoading(true);
        setError(null);

        const blob = await azureApi.fetchPhoto(photoId, options);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        console.error('Failed to load photo:', err);
        setError(err instanceof Error ? err : new Error('Failed to load photo'));
      } finally {
        setLoading(false);
      }
    }

    loadPhoto();

    // Cleanup object URL on unmount
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId, options?.thumbnail]);

  return { url, loading, error };
}
