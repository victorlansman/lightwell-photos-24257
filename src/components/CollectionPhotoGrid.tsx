import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";

interface Photo {
  id: string;
  path: string;
  thumbnail_url: string | null;
  original_filename: string;
  title: string | null;
  is_favorite: boolean;
}

interface CollectionPhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onToggleFavorite: (photoId: string) => void;
}

function PhotoThumbnail({ photo }: { photo: Photo }) {
  const { url, loading } = usePhotoUrl(photo.id, { thumbnail: true });

  if (loading) {
    return <div className="w-full h-full bg-gray-200 animate-pulse" />;
  }

  return (
    <img
      src={url || ''}
      alt={photo.title || photo.original_filename}
      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
    />
  );
}

export function CollectionPhotoGrid({
  photos,
  onPhotoClick,
  onToggleFavorite,
}: CollectionPhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No photos in this collection yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative aspect-square bg-muted rounded-lg overflow-hidden group cursor-pointer"
          onClick={() => onPhotoClick(photo)}
        >
          <PhotoThumbnail photo={photo} />

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity",
              photo.is_favorite && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(photo.id);
            }}
          >
            <Heart
              className={cn(
                "h-5 w-5",
                photo.is_favorite && "fill-red-500 text-red-500"
              )}
            />
          </Button>
        </div>
      ))}
    </div>
  );
}
