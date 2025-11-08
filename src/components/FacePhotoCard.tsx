import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "@/types/photo";

interface FacePhotoCardProps {
  photo: Photo;
  personId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
  isSelectionMode: boolean;
}

export function FacePhotoCard({
  photo,
  personId,
  isSelected,
  onSelect,
  onClick,
  isSelectionMode,
}: FacePhotoCardProps) {
  const [imageUrl, setImageUrl] = useState<string>("");

  // Find the face bounding box for this person
  const face = photo.faces?.find(f => f.personId === personId);
  const bbox = face?.boundingBox || { x: 50, y: 50, width: 20, height: 20 };

  useEffect(() => {
    setImageUrl(photo.path);
  }, [photo.path]);

  const handleClick = () => {
    if (isSelectionMode) {
      onSelect(photo.id);
    } else {
      onClick();
    }
  };

  // Calculate the center point of the face
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;

  // Calculate zoom level to make face fill the card (with some padding)
  // bbox dimensions are in percentages, so 100/bbox gives us the zoom needed
  const zoomFactor = Math.max(100 / bbox.width, 100 / bbox.height) * 0.8;

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-full cursor-pointer group",
        "bg-muted transition-all duration-200",
        isSelected && "ring-4 ring-primary"
      )}
      onClick={handleClick}
    >
      {imageUrl && (
        <div className="w-full h-full overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            style={{
              objectPosition: `${centerX}% ${centerY}%`,
              transform: `scale(${zoomFactor})`,
              transformOrigin: `${centerX}% ${centerY}%`,
            }}
          />
        </div>
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
