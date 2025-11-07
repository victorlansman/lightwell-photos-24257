import { Photo, FaceDetection } from "@/types/photo";
import { X, ChevronLeft, ChevronRight, Heart, Share2, Download, Info, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SharePhotosDialog } from "@/components/SharePhotosDialog";
import { FaceBoundingBox } from "@/components/FaceBoundingBox";
import { EditPersonDialog } from "@/components/EditPersonDialog";
import { mockPeople } from "@/data/mockPeople";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LightboxProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFavorite?: (photoId: string) => void;
  onUpdateFaces?: (photoId: string, faces: FaceDetection[]) => void;
  onUpdatePeople?: (personId: string, personName: string, photoPath: string) => void;
}

export function Lightbox({ photo, isOpen, onClose, onPrevious, onNext, onToggleFavorite, onUpdateFaces, onUpdatePeople }: LightboxProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFaces, setShowFaces] = useState(false);
  const [editingFace, setEditingFace] = useState<FaceDetection | null>(null);
  const [faces, setFaces] = useState<FaceDetection[]>([]);
  const [showNamingDialog, setShowNamingDialog] = useState(false);
  const [personToName, setPersonToName] = useState<FaceDetection | null>(null);
  const [newPersonName, setNewPersonName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [faceToDelete, setFaceToDelete] = useState<FaceDetection | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    if (photo?.faces) {
      setFaces(photo.faces);
    } else {
      setFaces([]);
    }
    // Don't reset showFaces - let user control visibility
  }, [photo]);

  // Track image dimensions for bounding box positioning
  useEffect(() => {
    const updateDimensions = () => {
      if (imgRef.current) {
        setImageDimensions({
          width: imgRef.current.width,
          height: imgRef.current.height,
        });
      }
    };

    const img = imgRef.current;
    if (img) {
      // Update on load
      img.addEventListener('load', updateDimensions);
      // Update immediately if already loaded
      if (img.complete) {
        updateDimensions();
      }
    }

    // Update on window resize
    window.addEventListener('resize', updateDimensions);
    
    // Update when info panel toggles and when photo changes
    const timeoutId = setTimeout(updateDimensions, 300);
    
    // Also try to update after a short delay to catch cached images
    const rafId = requestAnimationFrame(() => {
      updateDimensions();
      // Try again after a brief delay
      setTimeout(updateDimensions, 50);
      setTimeout(updateDimensions, 150);
    });

    return () => {
      if (img) {
        img.removeEventListener('load', updateDimensions);
      }
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
    };
  }, [showInfo, photo]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        onPrevious();
      } else if (e.key === "ArrowRight") {
        onNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onPrevious, onNext, onClose]);

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        onNext();
      } else {
        onPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!photo) return null;

  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(photo.id);
      toast.success(photo.is_favorite ? "Removed from favorites" : "Added to favorites");
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleDownload = async () => {
    try {
      // Fetch the image as a blob
      const response = await fetch(photo.path);
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.filename || 'photo.jpg';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Download started");
    } catch (error) {
      console.error('Download failed:', error);
      toast.error("Failed to download photo");
    }
  };

  const handleEditFace = (face: FaceDetection) => {
    setEditingFace(face);
  };

  const handleRemoveFace = (face: FaceDetection) => {
    // If person is named, convert to unnamed
    if (face.personName) {
      const updatedFaces = faces.map(f => 
        f === face ? { ...f, personName: null, personId: `unknown-${Date.now()}` } : f
      );
      setFaces(updatedFaces);
      if (photo && onUpdateFaces) {
        onUpdateFaces(photo.id, updatedFaces);
      }
      toast.success("Person unmarked");
    } else {
      // If unnamed, show confirmation dialog
      setFaceToDelete(face);
      setShowDeleteDialog(true);
    }
  };

  const handleConfirmDelete = () => {
    if (faceToDelete && photo) {
      const updatedFaces = faces.filter(f => f !== faceToDelete);
      setFaces(updatedFaces);
      if (onUpdateFaces) {
        onUpdateFaces(photo.id, updatedFaces);
      }
      toast.success("Face tag deleted");
      setFaceToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  const handleSelectPerson = (personId: string, personName: string | null) => {
    if (editingFace && photo) {
      const targetPerson = mockPeople.find(p => p.id === personId);
      
      // If target person is unnamed/unknown, trigger naming dialog
      if (targetPerson && targetPerson.name === null) {
        setPersonToName({ ...editingFace, personId, personName });
        setShowNamingDialog(true);
        setEditingFace(null);
      } else {
        const updatedFaces = faces.map(f => 
          f === editingFace ? { ...f, personId, personName } : f
        );
        setFaces(updatedFaces);
        if (onUpdateFaces) {
          onUpdateFaces(photo.id, updatedFaces);
        }
        // Update people database if assigning to a named person
        if (personName && onUpdatePeople) {
          onUpdatePeople(personId, personName, photo.path);
        }
        toast.success(`Reassigned to ${personName || "Unnamed"}`);
        setEditingFace(null);
      }
    }
  };

  const handleCreateNewPerson = () => {
    if (editingFace) {
      setPersonToName(editingFace);
      setShowNamingDialog(true);
      setEditingFace(null);
    }
  };

  const handleNamePerson = () => {
    if (personToName && newPersonName.trim() && photo) {
      // Create a proper personId based on the name
      const newPersonId = newPersonName.trim().toLowerCase().replace(/\s+/g, '-');
      // Update the face with the new name and proper personId
      const updatedFace = { 
        ...personToName, 
        personName: newPersonName.trim(),
        personId: newPersonId
      };
      const updatedFaces = faces.map(f => 
        f === personToName ? updatedFace : f
      );
      setFaces(updatedFaces);
      if (onUpdateFaces) {
        onUpdateFaces(photo.id, updatedFaces);
      }
      // Update people database with new person
      if (onUpdatePeople) {
        onUpdatePeople(newPersonId, newPersonName.trim(), photo.path);
      }
      toast.success(`Named person as ${newPersonName.trim()}`);
      setPersonToName(null);
      setNewPersonName("");
      setShowNamingDialog(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[100vw] h-screen p-0 bg-background/95 backdrop-blur-sm border-0 [&>button]:hidden">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background/80 to-transparent flex items-center justify-between px-4 z-50">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleToggleFavorite}>
                <Heart className={cn("h-5 w-5", photo.is_favorite && "fill-primary text-primary")} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleShare}>
                <Share2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload}>
                <Download className="h-5 w-5" />
              </Button>
              {faces.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowFaces(!showFaces)}
                  className={cn(showFaces && "bg-accent")}
                >
                  <Users className="h-5 w-5" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowInfo(!showInfo)}
                className={cn(showInfo && "bg-accent")}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Main content area */}
          <div 
            className="w-full h-full flex"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Image */}
            <div 
              ref={imageRef}
              className={cn(
                "flex-1 flex items-center justify-center p-16 transition-all relative z-0",
                showInfo && "lg:pr-8"
              )}
            >
              <div className="relative">
                <img
                  ref={imgRef}
                  src={photo.path}
                  alt="Photo"
                  className="max-w-full max-h-full object-contain animate-fade-in"
                />
                {showFaces && imageDimensions.width > 0 && (
                  <div 
                    className="absolute inset-0 z-10"
                    style={{
                      width: imageDimensions.width,
                      height: imageDimensions.height,
                    }}
                  >
                    {faces.map((face, idx) => (
                      <FaceBoundingBox
                        key={idx}
                        face={face}
                        imageWidth={imageDimensions.width}
                        imageHeight={imageDimensions.height}
                        onEdit={handleEditFace}
                        onRemove={handleRemoveFace}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Info Panel */}
            {showInfo && (
              <div className={cn(
                "absolute bg-card/95 backdrop-blur-sm border-l border-border p-6 space-y-4 overflow-y-auto z-50",
                "lg:relative lg:w-80 lg:h-full lg:z-auto",
                "max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:top-16 max-lg:max-h-[calc(100vh-4rem)] max-lg:border-l-0 max-lg:border-t"
              )}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Photo Info</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="lg:hidden"
                    onClick={() => setShowInfo(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Filename</p>
                    <p className="text-sm text-foreground">{photo.filename || `photo-${photo.id}.jpg`}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p className="text-sm text-foreground">
                      {format(new Date(photo.created_at), "PPpp")}
                    </p>
                  </div>

                  {faces.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">People in Photo</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {faces.map((face, idx) => (
                          <span 
                            key={idx}
                            className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                          >
                            {face.personName || "Unknown"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {photo.user_notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p className="text-sm text-foreground">{photo.user_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 hover:bg-background border border-border shadow-lg z-50 backdrop-blur-sm"
            onClick={onPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 hover:bg-background border border-border shadow-lg z-50 backdrop-blur-sm"
            onClick={onNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </DialogContent>
      </Dialog>

      <SharePhotosDialog
        photoIds={[photo.id]}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />

      <EditPersonDialog
        face={editingFace}
        isOpen={!!editingFace}
        onClose={() => setEditingFace(null)}
        allPeople={mockPeople}
        onSelectPerson={handleSelectPerson}
        onCreateNew={handleCreateNewPerson}
      />

      <Dialog open={showNamingDialog} onOpenChange={() => {
        setShowNamingDialog(false);
        setNewPersonName("");
      }}>
        <DialogContent className="sm:max-w-md" aria-describedby="naming-dialog-description">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Name This Person</h3>
            <p id="naming-dialog-description" className="sr-only">Enter a name for this person</p>
            <Input
              type="text"
              placeholder="Enter name..."
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNamePerson();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowNamingDialog(false);
                setNewPersonName("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleNamePerson} disabled={!newPersonName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={() => setShowDeleteDialog(false)}>
        <DialogContent className="sm:max-w-md" aria-describedby="delete-dialog-description">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Delete the tag of this person?</h3>
            <p id="delete-dialog-description" className="text-sm text-muted-foreground">
              This will permanently remove the face tag from this photo.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowDeleteDialog(false);
                setFaceToDelete(null);
              }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Yes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}