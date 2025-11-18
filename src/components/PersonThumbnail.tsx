import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PersonThumbnailProps {
  photoUrl: string;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a person's face as a circular thumbnail crop.
 * If bbox is provided, crops to that face. Otherwise shows default center crop.
 * Bbox can be in either UI coordinates (0-100) or API coordinates (0-1).
 */
export function PersonThumbnail({
  photoUrl,
  bbox,
  size = "md",
  className,
}: PersonThumbnailProps) {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // If bbox is explicitly null (face thumbnails), don't crop
  const isPreCropped = bbox === null;

  // Default bbox if none provided (UI coordinates 0-100)
  let displayBbox = bbox || { x: 50, y: 50, width: 20, height: 20 };

  // Convert API coordinates (0-1) to UI coordinates (0-100) if needed
  if (bbox && bbox.x <= 1 && bbox.y <= 1 && bbox.width <= 1 && bbox.height <= 1) {
    displayBbox = {
      x: bbox.x * 100,
      y: bbox.y * 100,
      width: bbox.width * 100,
      height: bbox.height * 100,
    };
  }

  // Calculate center and zoom for face crop (unless pre-cropped)
  const centerX = displayBbox.x + displayBbox.width / 2;
  const centerY = displayBbox.y + displayBbox.height / 2;
  const zoomFactor = isPreCropped
    ? 1
    : Math.max(100 / displayBbox.width, 100 / displayBbox.height) * 0.8;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const updateDimensions = () => {
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setImageDimensions({ width: rect.width, height: rect.height });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(img);

    img.addEventListener("load", updateDimensions);
    if (img.complete) {
      updateDimensions();
    }

    const rafId = requestAnimationFrame(() => {
      setTimeout(updateDimensions, 10);
    });

    return () => {
      resizeObserver.disconnect();
      img.removeEventListener("load", updateDimensions);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-muted flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      <img
        ref={imgRef}
        src={photoUrl}
        alt=""
        className="w-full h-full object-cover"
        style={{
          objectPosition: `${centerX}% ${centerY}%`,
          transform: `scale(${zoomFactor})`,
          transformOrigin: `${centerX}% ${centerY}%`,
        }}
      />
    </div>
  );
}
