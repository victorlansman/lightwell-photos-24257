import { FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { Button } from "@/components/ui/button";
import { Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaceBoundingBoxProps {
  face: FaceDetection;
  imageWidth: number;
  imageHeight: number;
  onEdit: (face: FaceDetection) => void;
  onRemove: (face: FaceDetection) => void;
  allPeople?: PersonCluster[];
}

export function FaceBoundingBox({ face, imageWidth, imageHeight, onEdit, onRemove, allPeople = [] }: FaceBoundingBoxProps) {
  const left = (face.boundingBox.x / 100) * imageWidth;
  const top = (face.boundingBox.y / 100) * imageHeight;
  const width = (face.boundingBox.width / 100) * imageWidth;
  const height = (face.boundingBox.height / 100) * imageHeight;

  // Determine display name
  let displayName = "Unnamed person";
  const isUnnamed = !face.personName;
  
  if (face.personName) {
    displayName = face.personName;
  } else if (face.personId && allPeople.length > 0) {
    const person = allPeople.find(p => p.id === face.personId);
    if (person && person.photoCount > 1) {
      // Find cluster index among unnamed people
      const unnamedClusters = allPeople
        .filter(p => p.name === null && p.photoCount > 1)
        .sort((a, b) => a.id.localeCompare(b.id));
      const clusterIndex = unnamedClusters.findIndex(p => p.id === person.id);
      if (clusterIndex !== -1) {
        displayName = `Unnamed person ${clusterIndex + 1}`;
      }
    }
  }
  
  return (
    <div
      className={cn(
        "absolute border-2",
        isUnnamed ? "border-yellow-500" : "border-primary"
      )}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* Person name flag */}
      <div className={cn(
        "absolute -top-8 left-0 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg",
        isUnnamed 
          ? "bg-yellow-500 text-black" 
          : "bg-primary text-primary-foreground"
      )}>
        <span>{displayName}</span>
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
