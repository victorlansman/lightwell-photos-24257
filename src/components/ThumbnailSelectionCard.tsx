import { useState, useEffect, useRef } from "react";
import { Photo, FaceDetection } from "@/types/photo";
import { cn } from "@/lib/utils";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";

interface ThumbnailSelectionCardProps {
  photo: Photo;
  personId: string;
  onSelectFace: (face: FaceDetection, photoId: string) => void;
}

/**
 * Shows a photo with all faces for a person as circular, clickable thumbnails.
 * User clicks a specific face to set as the person's thumbnail.
 */
export function ThumbnailSelectionCard({
  photo,
  personId,
  onSelectFace,
}: ThumbnailSelectionCardProps) {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { url: photoUrl, loading } = usePhotoUrl(photo.id);

  useEffect(() => {
    const updateDimensions = () => {
      if (imgRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setImageDimensions({ width: rect.width, height: rect.height });
        }
      }
    };

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    const img = imgRef.current;
    if (img) {
      img.addEventListener("load", updateDimensions);
      if (img.complete) {
        updateDimensions();
      }
    }

    const rafId = requestAnimationFrame(() => {
      setTimeout(updateDimensions, 10);
    });

    return () => {
      resizeObserver.disconnect();
      if (img) {
        img.removeEventListener("load", updateDimensions);
      }
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Get all faces for this person in this photo
  const personFaces = photo.faces?.filter(f => f.personId === personId) || [];

  // Calculate zoom and center based on all faces for this person
  // If multiple faces, encompass all of them; otherwise use the first face
  let zoomFactor = 1;
  let centerX = 50;
  let centerY = 50;

  if (personFaces.length > 0) {
    // Find bounding box that encompasses all faces
    const xs = personFaces.map(f => f.boundingBox.x);
    const ys = personFaces.map(f => f.boundingBox.y);
    const xEnds = personFaces.map(f => f.boundingBox.x + f.boundingBox.width);
    const yEnds = personFaces.map(f => f.boundingBox.y + f.boundingBox.height);

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xEnds);
    const maxY = Math.max(...yEnds);

    const width = maxX - minX;
    const height = maxY - minY;

    centerX = minX + width / 2;
    centerY = minY + height / 2;
    zoomFactor = Math.max(100 / width, 100 / height) * 0.8;
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-full bg-muted aspect-square cursor-pointer group border-4 border-blue-500 transition-all duration-200 hover:border-8 hover:border-blue-400 hover:shadow-lg"
    >
      <img
        ref={imgRef}
        src={photoUrl || ''}
        alt=""
        className="w-full h-full object-cover"
        style={{
          objectPosition: `${centerX}% ${centerY}%`,
          transform: `scale(${zoomFactor})`,
          transformOrigin: `${centerX}% ${centerY}%`,
        }}
      />

      {/* Clickable area for selecting face - entire circle is clickable */}
      <button
        className="absolute inset-0 z-10"
        onClick={() => {
          if (personFaces.length > 0) {
            onSelectFace(personFaces[0], photo.id);
          }
        }}
        title={`Click to use as thumbnail`}
      />

      {/* Face count badge */}
      {personFaces.length > 0 && (
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold z-20">
          {personFaces.length} face{personFaces.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
