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

  // Use inline CSS for grid to ensure consistency and dynamic zoom levels
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${zoomLevel}, minmax(0, 1fr))`,
    gap: "0.5rem",
    gridAutoFlow: "row" as const,
  };

  if (!showDates) {
    // Render all photos in one grid without date grouping
    return (
      <div className="animate-fade-in">
        <div style={gridStyle}>
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
          <div style={gridStyle}>
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
