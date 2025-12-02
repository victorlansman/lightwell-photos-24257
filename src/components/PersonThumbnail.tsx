import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { useFaceDerivativeUrl } from "@/hooks/useFaceDerivativeUrl";

interface PersonThumbnailProps {
  faceId: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a person's face as a circular thumbnail.
 * Uses pre-cropped face derivative from backend.
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

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const showPlaceholder = !faceId || error || (!loading && !url);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-muted flex-shrink-0 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {loading ? (
        <div className="w-full h-full bg-muted animate-pulse rounded-full" />
      ) : showPlaceholder ? (
        <User className={cn(iconSizes[size], "text-muted-foreground")} />
      ) : (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
