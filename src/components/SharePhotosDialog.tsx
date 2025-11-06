import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { useState } from "react";

interface SharePhotosDialogProps {
  photoIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onShareComplete?: () => void;
}

export function SharePhotosDialog({ 
  photoIds, 
  isOpen, 
  onClose,
  onShareComplete 
}: SharePhotosDialogProps) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showUnshareDialog, setShowUnshareDialog] = useState(false);

  const photoCount = photoIds.length;
  const isMultiple = photoCount > 1;

  const handleConfirmShare = () => {
    // Generate a shareable link (in a real app, this would be an API call)
    const link = isMultiple
      ? `${window.location.origin}/shared/album/${photoIds.join(',')}`
      : `${window.location.origin}/shared/${photoIds[0]}`;
    setShareLink(link);
    toast.success(isMultiple ? "Share link created for photos!" : "Share link created!");
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleUnshare = () => {
    onClose();
    setShowUnshareDialog(true);
  };

  const handleConfirmUnshare = () => {
    setShareLink(null);
    setShowUnshareDialog(false);
    toast.success(isMultiple ? "Photos are now private" : "Photo is now private");
    if (onShareComplete) {
      onShareComplete();
    }
  };

  const handleCloseShareDialog = () => {
    setShareLink(null);
    onClose();
    if (onShareComplete) {
      onShareComplete();
    }
  };

  return (
    <>
      {/* Share Confirmation Dialog */}
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {shareLink 
                ? (isMultiple ? "Share these photos" : "Share this photo")
                : (isMultiple ? "Make Photos Public?" : "Make Photo Public?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {shareLink ? (
                <div className="space-y-3">
                  <p>
                    {isMultiple 
                      ? "Your photos are now publicly available. Anyone with this link can access them:"
                      : "Your photo is now publicly available. Anyone with this link can access it:"}
                  </p>
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
                isMultiple
                  ? "Do you want to make these images publicly available? That means that anyone with the link will be able to access them."
                  : "Do you want to make this image publicly available? That means that anyone with the link will be able to access it."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {shareLink ? (
              <div className="flex w-full justify-between items-center">
                <Button variant="outline" onClick={handleUnshare}>
                  {isMultiple ? "Unshare these photos" : "Unshare this photo"}
                </Button>
                <AlertDialogCancel onClick={handleCloseShareDialog}>
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
            <AlertDialogTitle>
              {isMultiple 
                ? "Do you want to make these photos private?"
                : "Do you want to make this photo private?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isMultiple
                ? "Doing so will disable access to the photos for anyone with the link."
                : "Doing so will disable access to the photo for anyone with the link."}
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