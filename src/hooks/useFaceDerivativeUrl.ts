import { useState, useEffect } from 'react';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Hook to fetch face derivative URL.
 * Returns object URL for use in img src.
 */
export function useFaceDerivativeUrl(faceId: string | null | undefined) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!faceId) {
      setLoading(false);
      setUrl('');
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      try {
        setLoading(true);
        setError(null);

        const blob = await azureApi.fetchFaceDerivative(faceId);
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('[useFaceDerivativeUrl] Failed:', err);
        setError(err instanceof Error ? err : new Error('Failed to load face'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [faceId]);

  return { url, loading, error };
}
