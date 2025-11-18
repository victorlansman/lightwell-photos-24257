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
    // Guard against empty photoIdOrPath
    if (!photoIdOrPath) {
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      try {
        if (cancelled) return;
        setLoading(true);
        setError(null);

        let blob: Blob;

        // Check if this is a face thumbnail path
        if (photoIdOrPath.startsWith('/api/faces/')) {
          // Extract face ID from path: /api/faces/{faceId}/thumbnail
          const faceId = photoIdOrPath.split('/')[3];
          blob = await azureApi.fetchFaceThumbnail(faceId);
        } else {
          // Regular photo ID
          blob = await azureApi.fetchPhoto(photoIdOrPath, { thumbnail });
        }

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load image:', err);
        setError(err instanceof Error ? err : new Error('Failed to load image'));
      } finally {
        if (!cancelled) {
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
