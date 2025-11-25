import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook to detect when an element enters the viewport.
 * Useful for lazy loading images.
 *
 * @param threshold - Percentage of element visibility to trigger (0-1)
 * @param rootMargin - Margin around viewport to trigger early (e.g., '200px')
 * @param triggerOnce - If true, stops observing after first trigger
 */
export function useIntersectionObserver({
  threshold = 0,
  rootMargin = '200px',
  triggerOnce = true,
}: UseIntersectionObserverOptions = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsVisible(visible);

        // Stop observing after first trigger if triggerOnce is true
        if (visible && triggerOnce && element) {
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isVisible };
}
