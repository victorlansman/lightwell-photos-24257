import { ZoomIn, ZoomOut, Calendar, CalendarOff, Square, RectangleHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface AlbumViewControlsProps {
  zoomLevel: number;
  onZoomChange: (level: number) => void;
  showDates: boolean;
  onToggleDates: () => void;
  cropSquare: boolean;
  onToggleCropSquare: () => void;
  showFaces?: boolean;
  onToggleFaces?: () => void;
}

const ZOOM_LEVELS = [1, 2, 4, 8, 16];

export function AlbumViewControls({ 
  zoomLevel, 
  onZoomChange, 
  showDates, 
  onToggleDates,
  cropSquare,
  onToggleCropSquare,
  showFaces = false,
  onToggleFaces
}: AlbumViewControlsProps) {
  const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);

  const handleZoomIn = () => {
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    if (currentIndex > 0) {
      onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const index = value[0];
    onZoomChange(ZOOM_LEVELS[index]);
  };

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="flex items-center gap-4 max-w-[1600px]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={currentIndex === 0}
            className="h-9 w-9"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <Slider
            value={[currentIndex]}
            onValueChange={handleSliderChange}
            min={0}
            max={ZOOM_LEVELS.length - 1}
            step={1}
            className="w-32"
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={currentIndex === ZOOM_LEVELS.length - 1}
            className="h-9 w-9"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDates}
          className="h-9 w-9"
          title={showDates ? "Hide dates" : "Show dates"}
        >
          {showDates ? (
            <CalendarOff className="h-4 w-4" />
          ) : (
            <Calendar className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCropSquare}
          className="h-9 w-9"
          title={cropSquare ? "Show full photos" : "Crop to square"}
        >
          {cropSquare ? (
            <RectangleHorizontal className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </Button>

        {onToggleFaces && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFaces}
            className={cn("h-9 w-9", showFaces && "bg-accent")}
            title={showFaces ? "Hide face tags" : "Show face tags"}
          >
            <Users className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
