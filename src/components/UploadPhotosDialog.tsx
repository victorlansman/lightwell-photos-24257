import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadPhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  onUploadComplete: () => void;
}

export function UploadPhotosDialog({
  open,
  onOpenChange,
  collectionId,
  onUploadComplete,
}: UploadPhotosDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = files.length;
      let completed = 0;

      for (const file of files) {
        // Upload to storage
        const fileName = `${collectionId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("photos")
          .getPublicUrl(fileName);

        // Create photo record with mock EXIF data
        const { error: insertError } = await supabase
          .from("photos")
          .insert({
            collection_id: collectionId,
            path: fileName,
            thumbnail_url: publicUrl,
            original_filename: file.name,
            taken_at: new Date().toISOString(),
            camera_model: "Unknown",
            tags: [],
          });

        if (insertError) throw insertError;

        completed++;
        setUploadProgress((completed / totalFiles) * 100);
      }

      toast({
        title: "Upload complete",
        description: `${files.length} ${files.length === 1 ? "photo" : "photos"} uploaded successfully.`,
      });

      setFiles([]);
      onOpenChange(false);
      onUploadComplete();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
          <DialogDescription>
            Select photos to add to this collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <Label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                Click to select photos
              </span>
              <span className="text-xs text-muted-foreground">
                Supports JPG, PNG (up to 50MB each)
              </span>
            </Label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {files.length} {files.length === 1 ? "file" : "files"} selected
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 bg-muted rounded-md p-2"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-center text-muted-foreground">
                Uploading... {Math.round(uploadProgress)}%
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>Upload {files.length > 0 ? `${files.length} photos` : ""}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
