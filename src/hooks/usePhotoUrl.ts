import { useState, useEffect } from 'react';
import { azureApi, PhotoDerivativeSize } from '@/lib/azureApiClient';

/**
 * Hook to get authenticated photo derivative URL.
 * Creates object URL from blob for use in img src.
 *
 * @param photoId - Photo UUID
 * @param options.size - 'thumb_400' for grids, 'web_2048' for lightbox
 * @param options.abortSignal - AbortSignal to cancel fetch
 */
export function usePhotoUrl(
  photoId: string,
  options?: {
    size?: PhotoDerivativeSize;
    abortSignal?: AbortSignal;
  }
) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const size = options?.size ?? 'thumb_400';
  const abortSignal = options?.abortSignal;

  useEffect(() => {
    if (!photoId || !photoId.trim()) {
      setLoading(false);
      setUrl('');
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      try {
        if (cancelled) return;
        setLoading(true);
        setError(null);

        const blob = await azureApi.fetchPhotoDerivative(photoId, 'default', size, { abortSignal });
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('[usePhotoUrl] Failed:', err);
        setError(err instanceof Error ? err : new Error('Failed to load image'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, size, abortSignal]);

  return { url, loading, error };
}
