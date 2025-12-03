import { cn } from "@/lib/utils";
import { useFaceDerivativeUrl } from "@/hooks/useFaceDerivativeUrl";

interface PersonThumbnailProps {
  faceId: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a person's face as a circular thumbnail.
 * Shows skeleton until image loads - no flash of placeholder icon.
 *
 * Note: First load may take 3-4s due to on-the-fly derivative generation.
 * Subsequent loads are fast (~200ms) due to caching.
 */
export function PersonThumbnail({
  faceId,
  size = "md",
  className,
}: PersonThumbnailProps) {
  const { url, loading, error } = useFaceDerivativeUrl(faceId);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  // Show skeleton consistently until we have a loaded image
  const showSkeleton = !faceId || loading || (!url && !error);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-muted flex-shrink-0 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {showSkeleton ? (
        <div className="w-full h-full bg-muted animate-pulse rounded-full" />
      ) : url ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        // Error state - show static muted background
        <div className="w-full h-full bg-muted rounded-full" />
      )}
    </div>
  );
}
