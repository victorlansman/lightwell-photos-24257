import { Photo } from "@/types/photo";
import { PhotoCard } from "./PhotoCard";
import { format, parseISO } from "date-fns";

interface PhotoGridProps {
  photos: Photo[];
  selectedPhotos: Set<string>;
  onSelectPhoto: (id: string) => void;
  onPhotoClick: (photo: Photo) => void;
  zoomLevel?: number;
  showDates?: boolean;
  cropSquare?: boolean;
  isSelectionMode?: boolean;
}

export function PhotoGrid({ 
  photos, 
  selectedPhotos, 
  onSelectPhoto, 
  onPhotoClick,
  zoomLevel = 4,
  showDates = true,
  cropSquare = true,
  isSelectionMode = false
}: PhotoGridProps) {
  // Group photos by date
  const photosByDate = photos.reduce((acc, photo) => {
    const date = format(parseISO(photo.created_at), "MMMM d, yyyy");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, Photo[]>);

  // Generate responsive grid classes based on zoom level
  const getGridCols = () => {
    if (zoomLevel <= 1) return "grid-cols-1";
    if (zoomLevel <= 2) return "grid-cols-2";
    if (zoomLevel <= 4) return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
    if (zoomLevel <= 8) return "grid-cols-4 sm:grid-cols-6 md:grid-cols-8";
    if (zoomLevel <= 16) return "grid-cols-6 sm:grid-cols-10 md:grid-cols-16";
    if (zoomLevel <= 32) return "grid-cols-8 sm:grid-cols-16 md:grid-cols-32";
    return "grid-cols-10 sm:grid-cols-20 md:grid-cols-64";
  };

  if (!showDates) {
    // Render all photos in one grid without date grouping
    return (
      <div className="animate-fade-in">
        <div className={`grid ${getGridCols()} gap-2`}>
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              isSelected={selectedPhotos.has(photo.id)}
              onSelect={() => onSelectPhoto(photo.id)}
              onClick={() => onPhotoClick(photo)}
              cropSquare={cropSquare}
              isSelectionMode={isSelectionMode}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {Object.entries(photosByDate).map(([date, datePhotos]) => (
        <div key={date} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
            {date}
          </h2>
          <div className={`grid ${getGridCols()} gap-2`}>
            {datePhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              isSelected={selectedPhotos.has(photo.id)}
              onSelect={() => onSelectPhoto(photo.id)}
              onClick={() => onPhotoClick(photo)}
              cropSquare={cropSquare}
              isSelectionMode={isSelectionMode}
            />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
