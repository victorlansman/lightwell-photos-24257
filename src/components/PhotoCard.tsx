import { Photo } from "@/types/photo";
import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";
import { useThumbnailAbort } from "@/hooks/useThumbnailAbort";

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  cropSquare?: boolean;
  isSelectionMode?: boolean;
}

export function PhotoCard({ photo, isSelected, onSelect, onClick, cropSquare = true, isSelectionMode = false }: PhotoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const thumbnailAbort = useThumbnailAbort();
  const { url: photoUrl, loading } = usePhotoUrl(photo.id, {
    size: 'thumb_400',
    abortSignal: thumbnailAbort.signal,
  });

  const handleCardClick = () => {
    if (isSelectionMode) {
      onSelect();
    } else {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        cropSquare ? "aspect-square" : "aspect-auto"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {loading ? (
        <div className="w-full h-full bg-gray-200 rounded-lg animate-pulse" />
      ) : (
        <img
          src={photoUrl || ''}
          alt="Photo"
          className={cn(
            "w-full h-full rounded-lg transition-all duration-200",
            cropSquare ? "object-cover" : "object-contain",
            isHovered && "scale-105"
          )}
        />
      )}

      {/* Selection checkbox */}
      {(isSelectionMode || isSelected) && (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
              isSelected
                ? "bg-blue-500 border-blue-500"
                : "bg-white/80 border-gray-300"
            )}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </div>
        </div>
      )}
    </div>
  );
}
