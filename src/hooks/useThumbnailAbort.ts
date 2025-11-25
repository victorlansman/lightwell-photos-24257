import { createContext, useContext } from 'react';

/**
 * Context for sharing thumbnail abort controller.
 * Allows lightbox to abort all thumbnail fetches and prioritize full-size photo loading.
 */
export const ThumbnailAbortContext = createContext<{
  abortController: AbortController;
} | null>(null);

export function useThumbnailAbort() {
  const context = useContext(ThumbnailAbortContext);
  if (!context) {
    // Return a no-op controller if context not available
    return new AbortController();
  }
  return context.abortController;
}
