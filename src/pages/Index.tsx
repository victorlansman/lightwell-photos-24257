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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchPhotos();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's collections
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      const { data: collectionsData } = await supabase
        .from("collection_members")
        .select("collection_id")
        .eq("user_id", userData.id);

      if (!collectionsData || collectionsData.length === 0) {
        setLoading(false);
        return;
      }

      const collectionIds = collectionsData.map(c => c.collection_id);

      // Fetch all photos from user's collections
      const { data: photosData, error } = await supabase
        .from("photos")
        .select(`
          *,
          photo_people (
            person:people (
              id,
              name
            ),
            face_bbox
          )
        `)
        .in("collection_id", collectionIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get favorites
      const { data: favoritesData } = await supabase
        .from("favorites")
        .select("photo_id")
        .eq("user_id", userData.id);

      const favoriteIds = new Set(favoritesData?.map(f => f.photo_id) || []);

      // Transform photos
      const transformedPhotos: Photo[] = (photosData || []).map(photo => {
        const faces: FaceDetection[] = photo.photo_people?.map((pp: any) => ({
          personId: pp.person.id,
          personName: pp.person.name,
          boundingBox: pp.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
        })) || [];

        // Use thumbnail_url if available, or construct storage URL from path, or use path directly if it starts with /
        const imageUrl = photo.thumbnail_url ||
          (photo.path.startsWith('/') 
            ? photo.path 
            : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${photo.path}`);

        return {
          id: photo.id,
          path: imageUrl,
          created_at: photo.created_at,
          filename: photo.original_filename,
          is_favorite: favoriteIds.has(photo.id),
          faces,
          taken_at: photo.taken_at,
          tags: photo.tags || [],
        };
      });

      setPhotos(transformedPhotos);
    } catch (error: any) {
      toast({
        title: "Error loading photos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

      // Refresh data
      fetchPhotos();
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      if (photo.is_favorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userData.id)
          .eq("photo_id", photoId);
      } else {
        await supabase
          .from("favorites")
          .insert({
            user_id: userData.id,
            photo_id: photoId,
          });
      }

      // Update local state
      setPhotos((prevPhotos) =>
        prevPhotos.map((p) =>
          p.id === photoId ? { ...p, is_favorite: !p.is_favorite } : p
        )
      );
      if (lightboxPhoto && lightboxPhoto.id === photoId) {
        setLightboxPhoto({ ...lightboxPhoto, is_favorite: !lightboxPhoto.is_favorite });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateFaces = (photoId: string, faces: FaceDetection[]) => {
    setPhotos((prevPhotos) =>
      prevPhotos.map((p) =>
        p.id === photoId ? { ...p, faces } : p
      )
    );
    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto({ ...lightboxPhoto, faces });
    }
  };

  const handleUpdatePeople = async (personId: string, personName: string, photoPath: string) => {
    // Update or create person in database
    try {
      const { data: existingPerson } = await supabase
        .from("people")
        .select("*")
        .eq("id", personId)
        .single();

      if (existingPerson) {
        // Update name if changed
        if (existingPerson.name !== personName) {
          await supabase
            .from("people")
            .update({ name: personName })
            .eq("id", personId);
        }
      }
      // If person doesn't exist, it will be created when face is tagged
    } catch (error: any) {
      console.error("Error updating person:", error);
    }
  };

  if (loading) {
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
