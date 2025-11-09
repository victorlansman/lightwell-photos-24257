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

  // Transform Azure API photos to local Photo type
  const photos: Photo[] = (azurePhotos || []).map(photo => ({
    id: photo.id,
    path: photo.path,
    created_at: photo.created_at,
    filename: photo.title || undefined,
    is_favorite: photo.is_favorite,
    faces: photo.people.map(person => ({
      personId: person.id,
      personName: person.name,
      boundingBox: person.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
    })),
    taken_at: null,
    tags: photo.tags,
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

  const handleDelete = async () => {
    try {
      // Delete photos
      for (const photoId of Array.from(selectedPhotos)) {
        await supabase
          .from("photos")
          .delete()
          .eq("id", photoId);
      }

      toast({
        title: "Success",
        description: `Deleted ${selectedPhotos.size} photo(s)`,
      });

      // Data will auto-refresh via React Query
      setSelectedPhotos(new Set());
      setIsSelectionMode(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
    try {
      // Get the photo path for thumbnail generation
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      // Delete all existing face tags for this photo
      await supabase
        .from("photo_people")
        .delete()
        .eq("photo_id", photoId);

      // Insert new face tags (including unknown faces with null person_id)
      const insertData = faces.map(face => ({
        photo_id: photoId,
        person_id: face.personId,
        face_bbox: face.boundingBox,
      }));

      if (insertData.length > 0) {
        const { data: insertedFaces, error: insertError } = await supabase
          .from("photo_people")
          .insert(insertData)
          .select();

        if (insertError) throw insertError;

        // Only generate thumbnails for uploaded photos (not static demo assets)
        const isUploadedPhoto = !photo.path.startsWith('/photos/');

        if (insertedFaces && isUploadedPhoto) {
          // Generate thumbnails in background for uploaded photos only
          Promise.all(
            insertedFaces.map(async (face) => {
              try {
                const { data, error } = await supabase.functions.invoke('generate-thumbnail', {
                  body: {
                    photoPath: photo.path,
                    bbox: face.face_bbox,
                    faceId: face.id
                  }
                });

                if (data?.success && data?.thumbnailUrl) {
                  await supabase
                    .from('photo_people')
                    .update({ thumbnail_url: data.thumbnailUrl })
                    .eq('id', face.id);

                  if (face.person_id) {
                    await supabase
                      .from('people')
                      .update({ thumbnail_url: data.thumbnailUrl })
                      .eq('id', face.person_id);
                  }
                }
              } catch (err) {
                console.error('Error generating thumbnail for face:', face.id, err);
              }
            })
          ).catch(err => console.error('Error in thumbnail generation batch:', err));
        }
      }

      // Data will auto-refresh via React Query
    } catch (error: any) {
      toast({
        title: "Error updating face tags",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdatePeople = async (personId: string, personName: string, photoPath: string) => {
    try {
      // Check if person exists
      const { data: existingPerson } = await supabase
        .from("people")
        .select("id")
        .eq("id", personId)
        .maybeSingle();

      if (!existingPerson) {
        // Person doesn't exist, create them with the provided personId
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return;

        const { data: currentUserData } = await supabase
          .from("users")
          .select("id")
          .eq("supabase_user_id", currentUser.id)
          .single();

        if (!currentUserData) return;

        const { data: collectionData } = await supabase
          .from("collection_members")
          .select("collection_id")
          .eq("user_id", currentUserData.id)
          .limit(1)
          .single();

        if (!collectionData) return;

        await supabase
          .from("people")
          .insert({
            id: personId,
            name: personName,
            collection_id: collectionData.collection_id,
            thumbnail_url: photoPath,
          });
      } else {
        // Person exists, update their name
        await supabase
          .from("people")
          .update({ name: personName })
          .eq("id", personId);
      }

      // Data will auto-refresh via React Query
    } catch (error: any) {
      toast({
        title: "Error updating person",
        description: error.message,
        variant: "destructive",
      });
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
                          onDelete={handleDelete}
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
                      onDelete={handleDelete}
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
