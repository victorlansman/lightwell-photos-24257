import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PhotoGrid } from "@/components/PhotoGrid";
import { Lightbox } from "@/components/Lightbox";
import { AlbumViewControls } from "@/components/AlbumViewControls";
import { FaceBoundingBox } from "@/components/FaceBoundingBox";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Photo, FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionPhotos } from "@/hooks/usePhotos";
import { usePeople } from "@/hooks/usePeople";

export default function UnknownPeople() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showFaces, setShowFaces] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [cropSquare, setCropSquare] = useState(true);

  // Fetch collections and photos using Azure API
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;
  const { data: azurePhotos = [], isLoading: photosLoading } = useCollectionPhotos(firstCollectionId);
  const { data: allPeople = [], isLoading: peopleLoading } = usePeople(firstCollectionId);

  const loading = collectionsLoading || photosLoading || peopleLoading;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  // Transform Azure photos to Photo type and filter for unnamed faces
  const photos: Photo[] = useMemo(() => {
    return (azurePhotos || [])
      .map(photo => ({
        id: photo.id,
        collection_id: photo.collection_id,
        path: photo.path,
        thumbnail_url: photo.thumbnail_url,
        original_filename: photo.original_filename,
        created_at: photo.created_at,
        filename: photo.title || undefined,
        title: photo.title,
        description: photo.description,
        width: photo.width,
        height: photo.height,
        rotation: photo.rotation,
        estimated_year: photo.estimated_year,
        user_corrected_year: photo.user_corrected_year,
        is_favorite: photo.is_favorite,
        tags: photo.tags,
        people: photo.people,
        faces: photo.people
          .filter(person => person.face_bbox !== null)
          .map(person => ({
            personId: person.id,
            personName: person.name,
            boundingBox: person.face_bbox!,
          })),
        taken_at: null,
      }))
      // Filter to only photos with unnamed faces (null personId or empty name)
      .filter(photo =>
        photo.faces.some(face => !face.personId || !face.personName)
      );
  }, [azurePhotos]);

  const handlePhotoClick = (photo: Photo) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setSelectedPhoto(photo);
    setLightboxIndex(index);
  };

  const handleCloseLightbox = () => {
    setSelectedPhoto(null);
  };

  const handleUpdateFaces = async (photoId: string) => {
    // Azure API handles updates via Lightbox component
    // Just close the lightbox and let React Query refresh
  };

  const handlePersonCreated = async () => {
    // React Query will automatically refresh when person data changes
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewControls
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            showDates={false}
            onToggleDates={() => {}}
            cropSquare={cropSquare}
            onToggleCropSquare={() => setCropSquare(!cropSquare)}
            showFaces={showFaces}
            onToggleFaces={() => setShowFaces(!showFaces)}
          />
          <main className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4"
                  onClick={() => navigate("/people")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to People
                </Button>
                <h1 className="text-3xl font-bold text-foreground">Unnamed People</h1>
                <p className="text-muted-foreground mt-1">
                  {photos.length} {photos.length === 1 ? "photo" : "photos"} with untagged faces
                </p>
              </div>

              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">No photos with unnamed faces</p>
                  <p className="text-sm text-muted-foreground mt-2">All faces have been tagged!</p>
                </div>
              ) : showFaces ? (
                <div className="space-y-4">
                  {photos.map((photo) => (
                    <FacePhotoGalleryCard
                      key={photo.id}
                      photo={photo}
                      onClick={() => handlePhotoClick(photo)}
                      cropSquare={cropSquare}
                    />
                  ))}
                </div>
              ) : (
                <PhotoGrid
                  photos={photos}
                  onPhotoClick={handlePhotoClick}
                  selectedPhotos={new Set()}
                  onSelectPhoto={() => {}}
                  zoomLevel={zoomLevel}
                  cropSquare={cropSquare}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {selectedPhoto && (
        <Lightbox
          isOpen={true}
          photo={photos[lightboxIndex]}
          onClose={handleCloseLightbox}
          onNext={() => {
            const nextIndex = (lightboxIndex + 1) % photos.length;
            setLightboxIndex(nextIndex);
            setSelectedPhoto(photos[nextIndex]);
          }}
          onPrevious={() => {
            const prevIndex = (lightboxIndex - 1 + photos.length) % photos.length;
            setLightboxIndex(prevIndex);
            setSelectedPhoto(photos[prevIndex]);
          }}
          onUpdateFaces={handleUpdateFaces}
          onPersonCreated={handlePersonCreated}
          allPeople={allPeople}
          collectionId={firstCollectionId || ''}
        />
      )}
    </SidebarProvider>
  );
}

// Gallery card component that displays all face BBs for a photo
interface FacePhotoGalleryCardProps {
  photo: Photo;
  onClick: () => void;
  cropSquare: boolean;
}

function FacePhotoGalleryCard({ photo, onClick, cropSquare }: FacePhotoGalleryCardProps) {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setImageDimensions({ width: rect.width, height: rect.height });
        }
      }
    };

    const img = imgRef.current;
    if (!img) return;

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(img);

    img.addEventListener('load', updateDimensions);
    if (img.complete) {
      updateDimensions();
    }

    const rafId = requestAnimationFrame(() => {
      setTimeout(updateDimensions, 10);
    });

    return () => {
      resizeObserver.disconnect();
      img.removeEventListener('load', updateDimensions);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Get only unnamed faces (no personId or no personName)
  const unnamedFaces = photo.faces?.filter(f => !f.personId || !f.personName) || [];

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted cursor-pointer group transition-opacity hover:opacity-80",
        cropSquare ? "aspect-square rounded-lg" : "rounded-lg"
      )}
      onClick={onClick}
    >
      <img
        ref={imgRef}
        src={photo.path}
        alt=""
        className="w-full h-full object-cover"
      />

      {/* Face BBs overlay */}
      {imageDimensions.width > 0 && unnamedFaces.length > 0 && (
        <div
          className="absolute inset-0 z-10"
          style={{
            width: imageDimensions.width,
            height: imageDimensions.height,
          }}
        >
          {unnamedFaces.map((face, idx) => {
            const left = (face.boundingBox.x / 100) * imageDimensions.width;
            const top = (face.boundingBox.y / 100) * imageDimensions.height;
            const width = (face.boundingBox.width / 100) * imageDimensions.width;
            const height = (face.boundingBox.height / 100) * imageDimensions.height;

            return (
              <div
                key={idx}
                className="absolute border-2 border-yellow-500 z-10"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
              >
                <div className="absolute -top-6 left-0 px-2 py-1 rounded text-xs font-medium bg-yellow-500 text-black shadow-lg">
                  Unnamed
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unnamed face count badge */}
      {unnamedFaces.length > 0 && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-semibold z-20">
          {unnamedFaces.length}
        </div>
      )}
    </div>
  );
}
