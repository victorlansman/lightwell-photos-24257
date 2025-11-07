import { FaceDetection } from "@/types/photo";
import { Button } from "@/components/ui/button";
import { Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaceBoundingBoxProps {
  face: FaceDetection;
  imageWidth: number;
  imageHeight: number;
  onEdit: (face: FaceDetection) => void;
  onRemove: (face: FaceDetection) => void;
}

export function FaceBoundingBox({ face, imageWidth, imageHeight, onEdit, onRemove }: FaceBoundingBoxProps) {
  const left = (face.boundingBox.x / 100) * imageWidth;
  const top = (face.boundingBox.y / 100) * imageHeight;
  const width = (face.boundingBox.width / 100) * imageWidth;
  const height = (face.boundingBox.height / 100) * imageHeight;

  return (
    <div
      className="absolute border-2 border-primary"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* Person name flag */}
      <div className="absolute -top-8 left-0 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg">
        <span>{face.personName || "Unknown"}</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-primary-foreground/20"
            onClick={() => onEdit(face)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-primary-foreground/20"
            onClick={() => onRemove(face)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
