import { FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { Button } from "@/components/ui/button";
import { User, Edit2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface FaceBoundingBoxProps {
  face: FaceDetection;
  imageWidth: number;
  imageHeight: number;
  onEdit: (face: FaceDetection) => void;
  onRemove: (face: FaceDetection) => void;
  onUpdateBoundingBox: (face: FaceDetection, newBox: { x: number; y: number; width: number; height: number }) => void;
  allPeople?: PersonCluster[];
  onCloseLightbox?: () => void;
}

export function FaceBoundingBox({ face, imageWidth, imageHeight, onEdit, onRemove, onUpdateBoundingBox, allPeople = [], onCloseLightbox }: FaceBoundingBoxProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editBox, setEditBox] = useState(face.boundingBox);
  const boxRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, boxX: 0, boxY: 0 });
  const resizeHandleRef = useRef<string | null>(null);

  useEffect(() => {
    setEditBox(face.boundingBox);
  }, [face.boundingBox]);

  // Defensive check: Don't render if image dimensions are invalid
  if (imageWidth === 0 || imageHeight === 0) {
    console.warn('[FaceBoundingBox] Invalid image dimensions:', { imageWidth, imageHeight, face });
    return null;
  }

  const currentBox = isEditing ? editBox : face.boundingBox;
  const left = (currentBox.x / 100) * imageWidth;
  const top = (currentBox.y / 100) * imageHeight;
  const width = (currentBox.width / 100) * imageWidth;
  const height = (currentBox.height / 100) * imageHeight;

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    if (!isEditing) return;
    e.stopPropagation();
    
    isDraggingRef.current = true;
    resizeHandleRef.current = handle || null;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      boxX: currentBox.x,
      boxY: currentBox.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = ((moveEvent.clientX - dragStartRef.current.x) / imageWidth) * 100;
      const deltaY = ((moveEvent.clientY - dragStartRef.current.y) / imageHeight) * 100;

      if (resizeHandleRef.current) {
        // Resizing - calculate new position and size separately to avoid locking
        let newBox = { ...currentBox };

        if (resizeHandleRef.current.includes('top')) {
          // Resize from top: move Y down, reduce height
          // Allow Y to move to: [0, currentBox.y + currentBox.height - 5] (min 5px height)
          const maxY = currentBox.y + currentBox.height - 5;
          newBox.y = Math.max(0, Math.min(maxY, dragStartRef.current.boxY + deltaY));
          newBox.height = currentBox.height - (newBox.y - currentBox.y);
        }
        if (resizeHandleRef.current.includes('bottom')) {
          // Resize from bottom: increase/decrease height
          // Allow height to be: [5, 100 - currentBox.y] (min 5px, fits in space below)
          newBox.height = Math.max(5, Math.min(100 - currentBox.y, currentBox.height + deltaY));
        }
        if (resizeHandleRef.current.includes('left')) {
          // Resize from left: move X right, reduce width
          // Allow X to move to: [0, currentBox.x + currentBox.width - 5] (min 5px width)
          const maxX = currentBox.x + currentBox.width - 5;
          newBox.x = Math.max(0, Math.min(maxX, dragStartRef.current.boxX + deltaX));
          newBox.width = currentBox.width - (newBox.x - currentBox.x);
        }
        if (resizeHandleRef.current.includes('right')) {
          // Resize from right: increase/decrease width
          // Allow width to be: [5, 100 - currentBox.x] (min 5px, fits in space to right)
          newBox.width = Math.max(5, Math.min(100 - currentBox.x, currentBox.width + deltaX));
        }

        setEditBox(newBox);
      } else {
        // Moving
        const newX = Math.max(0, Math.min(100 - currentBox.width, dragStartRef.current.boxX + deltaX));
        const newY = Math.max(0, Math.min(100 - currentBox.height, dragStartRef.current.boxY + deltaY));
        setEditBox({ ...currentBox, x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      resizeHandleRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleConfirmEdit = () => {
    onUpdateBoundingBox(face, editBox);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditBox(face.boundingBox);
    setIsEditing(false);
  };

  // Determine display name and clickability
  let displayName = "Unnamed person";
  const isUnnamed = !face.personName;
  let isClickable = false;
  let personIdForNav: string | null = null;
  let isCluster = false;

  if (face.personName && face.personId) {
    displayName = face.personName;
    isClickable = true;
    personIdForNav = face.personId;
  } else if (face.personId && allPeople.length > 0) {
    const person = allPeople.find(p => p.id === face.personId);
    if (person && person.photoCount > 1) {
      // This is a cluster face (unnamed face in a cluster)
      isCluster = true;
      // Find cluster index among unnamed people
      const unnamedClusters = allPeople
        .filter(p => p.name === null && p.photoCount > 1)
        .sort((a, b) => a.id.localeCompare(b.id));
      const clusterIndex = unnamedClusters.findIndex(p => p.id === person.id);
      if (clusterIndex !== -1) {
        displayName = `Unnamed person ${clusterIndex + 1}`;
        isClickable = true;
        personIdForNav = person.id;
      }
    }
  }

  const handleNameClick = (e: React.MouseEvent) => {
    console.log('Name clicked', { isClickable, personIdForNav, displayName });
    if (!isClickable || !personIdForNav) {
      console.log('Not clickable or no personId');
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    console.log('Navigating to:', `/people/${personIdForNav}`);
    // Close lightbox first, then navigate
    onCloseLightbox?.();
    setTimeout(() => {
      navigate(`/people/${personIdForNav}`);
    }, 0);
  };
  
  return (
    <div
      ref={boxRef}
      className={cn(
        "absolute border-2 z-10",
        face.personName ? "border-primary" :    // Named: blue
        isCluster ? "border-orange-500" :       // Cluster: orange
        "border-yellow-500",                    // Individual: yellow
        isEditing ? "cursor-move pointer-events-auto" : "pointer-events-none"
      )}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      onMouseDown={(e) => {
        // Only handle mouse down for dragging/resizing in edit mode on the box itself
        if (isEditing && e.target === e.currentTarget) {
          handleMouseDown(e);
        }
      }}
    >
      {/* Resize handles */}
      {isEditing && (
        <>
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nw-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'top-left')} />
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full cursor-n-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'top')} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-ne-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'top-right')} />
          <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-primary rounded-full cursor-w-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'left')} />
          <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-3 h-3 bg-primary rounded-full cursor-e-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'right')} />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-sw-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'bottom-left')} />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full cursor-s-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'bottom')} />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-se-resize z-20" onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} />
        </>
      )}
      {/* Person name flag */}
      <div
        className={cn(
          "absolute -top-8 left-0 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 shadow-lg z-30 pointer-events-auto",
          face.personName
            ? "bg-primary text-primary-foreground"   // Named: blue
            : isCluster
            ? "bg-orange-500 text-white"             // Cluster: orange
            : "bg-yellow-500 text-black"             // Individual: yellow
        )}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        {isClickable ? (
          <button
            type="button"
            className={cn(
              "select-none text-inherit font-inherit bg-transparent border-none p-0 m-0 cursor-pointer hover:underline text-left"
            )}
            onClick={handleNameClick}
          >
            {displayName}
          </button>
        ) : (
          <span className="select-none">
            {displayName}
          </span>
        )}
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmEdit();
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(face);
                }}
              >
                <User className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(face);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
