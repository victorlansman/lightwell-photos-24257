import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getPhotoUrl } from "@/lib/utils";

interface Photo {
  id: string;
  path: string;
  thumbnail_url: string | null;
  original_filename: string;
  title: string | null;
  is_favorite?: boolean;
}

interface CollectionPhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: any) => void;
  onToggleFavorite: (photoId: string) => void;
}

export function CollectionPhotoGrid({
  photos,
  onPhotoClick,
  onToggleFavorite,
}: CollectionPhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No photos match your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
          onClick={() => onPhotoClick(photo)}
        >
          <img
            src={getPhotoUrl(photo.thumbnail_url || photo.path)}
            alt={photo.title || photo.original_filename}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />

          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-2 right-2 bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity",
              photo.is_favorite && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(photo.id);
            }}
          >
            <Heart
              className={cn(
                "h-4 w-4",
                photo.is_favorite && "fill-primary text-primary"
              )}
            />
          </Button>

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-sm font-medium line-clamp-1">
                {photo.title || photo.original_filename}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
