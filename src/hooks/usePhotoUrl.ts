import { useState, useEffect } from 'react';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Hook to get authenticated photo or face thumbnail URL.
 * Creates object URL from blob for use in img src.
 *
 * Handles:
 * - Photo IDs (UUID strings)
 * - Face thumbnail paths (/api/faces/{faceId}/thumbnail)
 *
 * @param options.thumbnail - Whether to fetch thumbnail
 * @param options.abortSignal - AbortSignal to cancel fetch
 * @param options.priority - 'high' for lightbox, 'low' for thumbnails (allows prioritization)
 */
export function usePhotoUrl(photoIdOrPath: string, options?: {
  thumbnail?: boolean
  abortSignal?: AbortSignal
  priority?: 'high' | 'low'
}) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Extract options to fix dependency array
  const thumbnail = options?.thumbnail;
  const abortSignal = options?.abortSignal;
  const priority = options?.priority || 'low';

  useEffect(() => {
    // Guard against empty or whitespace-only photoIdOrPath
    if (!photoIdOrPath || !photoIdOrPath.trim()) {
      setLoading(false);
      setUrl('');
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    const startTime = performance.now();

    async function loadImage() {
      try {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        console.log('[usePhotoUrl] Starting fetch:', { photoIdOrPath, isThumbnail: !!options?.thumbnail, elapsed: '0ms' });

        let blob: Blob;

        // Check if this is a face thumbnail path
        if (photoIdOrPath.startsWith('/api/faces/')) {
          // Extract face ID from path: /api/faces/{faceId}/thumbnail
          const faceId = photoIdOrPath.split('/')[3];
          blob = await azureApi.fetchFaceThumbnail(faceId);
          console.log('[usePhotoUrl] Face thumbnail fetched:', { faceId, elapsed: `${Math.round(performance.now() - startTime)}ms` });
        } else {
          // Regular photo ID
          const fetchStart = performance.now();
          // Add AbortSignal to fetch if provided
          const fetchOptions = { thumbnail, abortSignal };
          blob = await azureApi.fetchPhoto(photoIdOrPath, fetchOptions as any);
          const fetchElapsed = Math.round(performance.now() - fetchStart);
          console.log('[usePhotoUrl] Photo fetched:', { photoId: photoIdOrPath, priority, blobSize: `${Math.round(blob.size / 1024)}KB`, fetchElapsed: `${fetchElapsed}ms`, totalElapsed: `${Math.round(performance.now() - startTime)}ms` });
        }

        if (cancelled) return;

        const objectUrlStart = performance.now();
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        console.log('[usePhotoUrl] Object URL created:', { url: objectUrl, elapsed: `${Math.round(performance.now() - objectUrlStart)}ms`, totalElapsed: `${Math.round(performance.now() - startTime)}ms` });
      } catch (err) {
        if (cancelled) return;

        // Silently handle 404s for face thumbnails (expected when faces are deleted/merged)
        const is404 = err instanceof Error && err.message.includes('404');
        const isFaceThumbnail = photoIdOrPath.startsWith('/api/faces/');

        if (!(is404 && isFaceThumbnail)) {
          console.error('[usePhotoUrl] Failed to load image:', err, { photoIdOrPath, elapsed: `${Math.round(performance.now() - startTime)}ms` });
        }

        setError(err instanceof Error ? err : new Error('Failed to load image'));
      } finally {
        if (!cancelled) {
          console.log('[usePhotoUrl] Setting loading=false:', { photoIdOrPath, totalElapsed: `${Math.round(performance.now() - startTime)}ms` });
          setLoading(false);
        }
      }
    }

    loadImage();

    // Cleanup object URL on unmount and set cancellation flag
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoIdOrPath, thumbnail, abortSignal, priority]);

  return { url, loading, error };
}
