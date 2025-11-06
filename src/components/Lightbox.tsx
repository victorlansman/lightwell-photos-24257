import { Photo } from "@/types/photo";
import { X, ChevronLeft, ChevronRight, Heart, Share2, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
}

export function Lightbox({ photo, isOpen, onClose, onPrevious, onNext, onToggleFavorite }: LightboxProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showUnshareDialog, setShowUnshareDialog] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

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

  const handleConfirmShare = () => {
    // Generate a shareable link (in a real app, this would be an API call)
    const link = `${window.location.origin}/shared/${photo.id}`;
    setShareLink(link);
    toast.success("Share link created!");
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleUnshare = () => {
    setShowShareDialog(false);
    setShowUnshareDialog(true);
  };

  const handleConfirmUnshare = () => {
    setShareLink(null);
    setShowUnshareDialog(false);
    toast.success("Photo is now private");
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.path;
    link.download = photo.filename || 'photo.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <div className={cn(
              "flex-1 flex items-center justify-center p-16 transition-all",
              showInfo && "lg:pr-8"
            )}>
              <img
                src={photo.path}
                alt="Photo"
                className="max-w-full max-h-full object-contain animate-fade-in"
              />
            </div>

            {/* Info Panel */}
            {showInfo && (
              <div className={cn(
                "absolute bg-card/95 backdrop-blur-sm border-l border-border p-6 space-y-4 overflow-y-auto",
                "lg:relative lg:w-80 lg:h-full",
                "max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:top-auto max-lg:max-h-[50vh] max-lg:border-l-0 max-lg:border-t"
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

                  {photo.tagged_people && photo.tagged_people.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tagged People</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {photo.tagged_people.map((person, idx) => (
                          <span 
                            key={idx}
                            className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                          >
                            {person}
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

      {/* Share Confirmation Dialog */}
      <AlertDialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{shareLink ? "Share this photo" : "Make Photo Public?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {shareLink ? (
                <div className="space-y-3">
                  <p>Your photo is now publicly available. Anyone with this link can access it:</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={shareLink}
                      className="flex-1 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded border border-border"
                    />
                    <Button size="sm" onClick={handleCopyLink}>
                      Copy
                    </Button>
                  </div>
                </div>
              ) : (
                "Do you want to make this image publicly available? That means that anyone with the link will be able to access it."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {shareLink ? (
              <div className="flex w-full justify-between items-center">
                <Button variant="outline" onClick={handleUnshare}>
                  Unshare this photo
                </Button>
                <AlertDialogCancel onClick={() => {
                  setShareLink(null);
                  setShowShareDialog(false);
                }}>
                  Close
                </AlertDialogCancel>
              </div>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button onClick={handleConfirmShare}>Yes</Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unshare Confirmation Dialog */}
      <AlertDialog open={showUnshareDialog} onOpenChange={setShowUnshareDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you want to make this photo private?</AlertDialogTitle>
            <AlertDialogDescription>
              Doing so will disable access to the photo for anyone with the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnshare}>Unshare</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
