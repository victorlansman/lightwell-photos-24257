import { Photo } from "@/types/photo";
import { Check } from "lucide-react";
import { useState } from "react";
import { cn, getPhotoUrl } from "@/lib/utils";

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
  cropSquare?: boolean;
  isSelectionMode?: boolean;
}

export function PhotoCard({ photo, isSelected, onSelect, onClick, cropSquare = true, isSelectionMode = false }: PhotoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCardClick = () => {
    if (isSelectionMode) {
      onSelect(photo.id);
    } else {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "relative aspect-square group cursor-pointer",
        !cropSquare && "bg-muted"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <img
        src={getPhotoUrl(photo.path)}
        alt="Photo"
        className={cn(
          "w-full h-full rounded-lg transition-all duration-200",
          cropSquare ? "object-cover" : "object-contain",
          isSelected && "ring-4 ring-primary",
          "hover:shadow-elevation-hover hover:scale-[1.02]"
        )}
      />
      
      {/* Checkbox overlay - only shown in selection mode */}
      {isSelectionMode && (
        <div
          className={cn(
            "absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
            isSelected
              ? "bg-primary border-primary"
              : "bg-card/80 border-card backdrop-blur-sm"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(photo.id);
          }}
        >
          {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
        </div>
      )}

      {/* Hover overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-background/10 rounded-lg transition-opacity duration-200",
          isHovered && !isSelected ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
