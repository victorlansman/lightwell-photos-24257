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

  // Extract thumbnail value to fix dependency array
  const thumbnail = options?.thumbnail;

  useEffect(() => {
    // Guard against empty photoId
    if (!photoId) {
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadPhoto() {
      try {
        if (cancelled) return;
        setLoading(true);
        setError(null);

        const blob = await azureApi.fetchPhoto(photoId, options);
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load photo:', err);
        setError(err instanceof Error ? err : new Error('Failed to load photo'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPhoto();

    // Cleanup object URL on unmount and set cancellation flag
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId, thumbnail, options]);

  return { url, loading, error };
}
