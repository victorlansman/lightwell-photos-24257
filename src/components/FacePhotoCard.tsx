import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "@/types/photo";
import { useFaceDerivativeUrl } from "@/hooks/useFaceDerivativeUrl";

interface FacePhotoCardProps {
  photo: Photo;
  personId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
  isSelectionMode: boolean;
  showOnlyUnnamed?: boolean; // For cluster view - show unnamed faces
  isThumbnailSelection?: boolean; // For thumbnail selection - adds blue border
}

export function FacePhotoCard({
  photo,
  personId,
  isSelected,
  onSelect,
  onClick,
  isSelectionMode,
  showOnlyUnnamed = false,
  isThumbnailSelection = false,
}: FacePhotoCardProps) {
  // Find matching face in photo.people[] (from list response)
  // personId can be a person ID or cluster ID depending on context
  const matchingPerson = showOnlyUnnamed
    ? photo.people?.find(p => p.cluster_id === personId && p.id === null)
    : photo.people?.find(p => p.id === personId || p.cluster_id === personId);

  // Use face derivative (pre-cropped) instead of manual cropping
  const { url: faceUrl, loading } = useFaceDerivativeUrl(matchingPerson?.face_id);

  const handleClick = () => {
    if (isSelectionMode) {
      onSelect(photo.id);
    } else {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-full cursor-pointer group",
        "bg-muted transition-all duration-200",
        isSelected && "ring-4 ring-primary",
        isThumbnailSelection && "border-4 border-blue-500 hover:border-8 hover:border-blue-400 hover:shadow-lg"
      )}
      onClick={handleClick}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {faceUrl && (
        <img
          src={faceUrl}
          alt=""
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      )}

      {/* Selection overlay */}
      {isSelectionMode && (
        <div
          className={cn(
            "absolute inset-0 transition-all duration-200",
            isSelected ? "bg-primary/20" : "bg-transparent"
          )}
        >
          <div
            className={cn(
              "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
              isSelected
                ? "bg-primary border-primary"
                : "bg-background/80 border-background backdrop-blur-sm"
            )}
          >
            {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
          </div>
        </div>
      )}

      {/* Hover overlay */}
      {!isSelectionMode && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200" />
      )}
    </div>
  );
}
