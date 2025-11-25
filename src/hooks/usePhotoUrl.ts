import { useState, useEffect } from 'react';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Hook to get authenticated photo or face thumbnail URL.
 * Creates object URL from blob for use in img src.
 *
 * Handles:
 * - Photo IDs (UUID strings)
 * - Face thumbnail paths (/api/faces/{faceId}/thumbnail)
 */
export function usePhotoUrl(photoIdOrPath: string, options?: { thumbnail?: boolean }) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Extract thumbnail value to fix dependency array
  const thumbnail = options?.thumbnail;

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
          blob = await azureApi.fetchPhoto(photoIdOrPath, { thumbnail });
          const fetchElapsed = Math.round(performance.now() - fetchStart);
          console.log('[usePhotoUrl] Photo fetched:', { photoId: photoIdOrPath, blobSize: `${Math.round(blob.size / 1024)}KB`, fetchElapsed: `${fetchElapsed}ms`, totalElapsed: `${Math.round(performance.now() - startTime)}ms` });
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
  }, [photoIdOrPath, thumbnail]);

  return { url, loading, error };
}
