import { X, Heart, MapPin, Camera, Calendar, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn, getPhotoUrl } from "@/lib/utils";

interface Photo {
  id: string;
  path: string;
  original_filename: string;
  taken_at: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  camera_model: string | null;
  location: any;
  is_favorite?: boolean;
  people?: Array<{ id: string; name: string }>;
}

interface PhotoLightboxProps {
  photo: Photo;
  onClose: () => void;
  onToggleFavorite: (photoId: string) => void;
}

export function PhotoLightbox({
  photo,
  onClose,
  onToggleFavorite,
}: PhotoLightboxProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-background/80 to-transparent">
        <h2 className="text-lg font-semibold text-foreground truncate flex-1 mr-4">
          {photo.title || photo.original_filename}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(photo.id)}
          >
            <Heart
              className={cn(
                "h-5 w-5",
                photo.is_favorite && "fill-primary text-primary"
              )}
            />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="h-full flex flex-col lg:flex-row">
        {/* Image */}
        <div className="flex-1 flex items-center justify-center p-16">
          <img
            src={getPhotoUrl(photo.path)}
            alt={photo.title || photo.original_filename}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Metadata Panel */}
        <div className="lg:w-80 bg-card/95 backdrop-blur-sm border-l border-border p-6 space-y-6 overflow-y-auto">
          {/* Photo Info */}
          <div className="space-y-4">
            {photo.description && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{photo.description}</p>
              </div>
            )}

            {/* Date */}
            {photo.taken_at && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Date Taken</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(photo.taken_at), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
            )}

            {/* Camera */}
            {photo.camera_model && (
              <div className="flex items-start gap-3">
                <Camera className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Camera</p>
                  <p className="text-sm text-muted-foreground">{photo.camera_model}</p>
                </div>
              </div>
            )}

            {/* Location */}
            {photo.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Location</p>
                  <p className="text-sm text-muted-foreground">
                    {photo.location.place_name || 
                      `${photo.location.lat.toFixed(4)}, ${photo.location.lng.toFixed(4)}`}
                  </p>
                </div>
              </div>
            )}

            {/* People */}
            {photo.people && photo.people.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">People</h3>
                <div className="flex flex-wrap gap-2">
                  {photo.people.map((person) => (
                    <Badge key={person.id} variant="secondary">
                      {person.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {photo.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TagIcon className="h-4 w-4" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {photo.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
