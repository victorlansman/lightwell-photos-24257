import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PhotoGrid } from "@/components/PhotoGrid";
import { AlbumViewControls } from "@/components/AlbumViewControls";
import { InlineActionBar } from "@/components/InlineActionBar";
import { Lightbox } from "@/components/Lightbox";
import { SharePhotosDialog } from "@/components/SharePhotosDialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Photo, FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionPhotos, useToggleFavorite } from "@/hooks/usePhotos";
import { useUpdatePhotoFaces, useCreatePerson, useUpdatePerson } from "@/hooks/useFaces";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(true);
  const [cropSquare, setCropSquare] = useState(true);
  const [allPeople, setAllPeople] = useState<PersonCluster[]>([]);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // TODO: Multi-collection support - currently showing first collection only
  // Original implementation fetched from all collections, but Azure API is collection-specific
  const { data: collections } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  const { data: azurePhotos, isLoading } = useCollectionPhotos(firstCollectionId);
  const toggleFavoriteMutation = useToggleFavorite();
  const updateFacesMutation = useUpdatePhotoFaces();
  const createPersonMutation = useCreatePerson();
  const updatePersonMutation = useUpdatePerson();

  // Transform Azure API photos to local Photo type
  const photos: Photo[] = (azurePhotos || []).map(photo => ({
    id: photo.id,
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
    faces: photo.people.map(person => ({
      personId: person.id,
      personName: person.name,
      // Convert bbox from 0-1 (backend) to 0-100 (frontend)
      boundingBox: person.face_bbox
        ? {
            x: person.face_bbox.x * 100,
            y: person.face_bbox.y * 100,
            width: person.face_bbox.width * 100,
            height: person.face_bbox.height * 100,
          }
        : { x: 0, y: 0, width: 10, height: 10 },
    })),
    taken_at: null,
  }));

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSelectPhoto = (id: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPhotos(newSelected);
  };

  const handlePhotoClick = (photo: Photo) => {
    if (!isSelectionMode) {
      setLightboxPhoto(photo);
      setIsLightboxOpen(true);
    }
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
  };

  const handlePrevious = () => {
    if (!lightboxPhoto) return;
    const currentIndex = photos.findIndex((p) => p.id === lightboxPhoto.id);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    setLightboxPhoto(photos[previousIndex]);
  };

  const handleNext = () => {
    if (!lightboxPhoto) return;
    const currentIndex = photos.findIndex((p) => p.id === lightboxPhoto.id);
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    setLightboxPhoto(photos[nextIndex]);
  };

  const handleClearSelection = () => {
    setSelectedPhotos(new Set());
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedPhotos(new Set());
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleShareComplete = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleToggleFavorite = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    toggleFavoriteMutation.mutate(
      { photoId, isFavorited: photo.is_favorite },
      {
        onSuccess: () => {
          // Update lightbox photo if it's the one being toggled
          if (lightboxPhoto && lightboxPhoto.id === photoId) {
            setLightboxPhoto({ ...lightboxPhoto, is_favorite: !lightboxPhoto.is_favorite });
          }
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdateFaces = async (photoId: string, faces: FaceDetection[]) => {
    // Transform FaceDetection[] to FaceTag[]
    const faceTags = faces.map(face => ({
      person_id: face.personId,
      bbox: face.boundingBox
    }));

    updateFacesMutation.mutate(
      { photoId, faces: faceTags },
      {
        onError: (error: any) => {
          toast({
            title: "Error updating face tags",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleUpdatePeople = async (personId: string, personName: string, photoPath: string): Promise<string> => {
    // Check if we're creating or updating
    // Frontend-generated UUID (not in allPeople list) means create, existing UUID means update
    const isNewPerson = !allPeople.some(p => p.id === personId);

    if (isNewPerson) {
      // Create new person
      if (!firstCollectionId) {
        toast({
          title: "Error",
          description: "No collection found",
          variant: "destructive",
        });
        return Promise.reject(new Error("No collection found"));
      }

      try {
        const person = await createPersonMutation.mutateAsync({
          name: personName,
          collection_id: firstCollectionId
        });
        return person.id;
      } catch (error: any) {
        toast({
          title: "Error creating person",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
    } else {
      // Update existing person
      try {
        await updatePersonMutation.mutateAsync({
          personId,
          request: { name: personName }
        });
        return personId;
      } catch (error: any) {
        toast({
          title: "Error updating person",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
    }
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewControls
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            showDates={showDates}
            onToggleDates={() => setShowDates(!showDates)}
            cropSquare={cropSquare}
            onToggleCropSquare={() => setCropSquare(!cropSquare)}
          />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Timeline</h1>
                
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {isSelectionMode ? (
                    <>
                      {/* Desktop: inline action bar */}
                      <div className="hidden md:flex flex-1">
                        <InlineActionBar
                          selectedCount={selectedPhotos.size}
                          totalCount={photos.length}
                          onClearSelection={() => {
                            setSelectedPhotos(new Set());
                            setIsSelectionMode(false);
                          }}
                          onToggleSelectAll={handleToggleSelectAll}
                          onShare={handleShare}
                        />
                      </div>
                      <Button
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedPhotos(new Set());
                        }}
                        size="sm"
                        className="md:ml-auto"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsSelectionMode(true)}
                      size="sm"
                      className="md:ml-auto"
                    >
                      Select
                    </Button>
                  )}
                </div>

                {/* Mobile/Tablet: action bar below header */}
                {isSelectionMode && (
                  <div className="md:hidden border-t border-border pt-3">
                    <InlineActionBar
                      selectedCount={selectedPhotos.size}
                      totalCount={photos.length}
                      onClearSelection={() => {
                        setSelectedPhotos(new Set());
                        setIsSelectionMode(false);
                      }}
                      onToggleSelectAll={handleToggleSelectAll}
                      onShare={handleShare}
                    />
                  </div>
                )}
              </div>
              
              <PhotoGrid
                photos={photos}
                selectedPhotos={selectedPhotos}
                onSelectPhoto={handleSelectPhoto}
                onPhotoClick={handlePhotoClick}
                zoomLevel={zoomLevel}
                showDates={showDates}
                cropSquare={cropSquare}
                isSelectionMode={isSelectionMode}
              />
            </div>
          </main>
        </div>
      </div>

      <Lightbox
        photo={lightboxPhoto}
        isOpen={isLightboxOpen}
        onClose={handleCloseLightbox}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToggleFavorite={handleToggleFavorite}
        onUpdateFaces={handleUpdateFaces}
        onUpdatePeople={handleUpdatePeople}
        allPeople={allPeople}
      />

      <SharePhotosDialog
        photoIds={Array.from(selectedPhotos)}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        onShareComplete={handleShareComplete}
      />
    </SidebarProvider>
  );
};

export default Index;
