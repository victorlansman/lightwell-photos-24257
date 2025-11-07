import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PhotoCard } from "@/components/PhotoCard";
import { Lightbox } from "@/components/Lightbox";
import { NamingDialog } from "@/components/NamingDialog";
import { AlbumViewControls } from "@/components/AlbumViewControls";
import { InlineActionBar } from "@/components/InlineActionBar";
import { SharePhotosDialog } from "@/components/SharePhotosDialog";
import { PersonCluster } from "@/types/person";
import { Photo, FaceDetection } from "@/types/photo";
import { ArrowLeft } from "lucide-react";

export default function PersonAlbum() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [person, setPerson] = useState<PersonCluster | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(false);
  const [cropSquare, setCropSquare] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchPersonAndPhotos();
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchPersonAndPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch person data
      const { data: personData, error: personError } = await supabase
        .from("people")
        .select("*")
        .eq("id", id)
        .single();

      if (personError) throw personError;

      // Fetch photos with this person
      const { data: photoData, error: photosError } = await supabase
        .from("photo_people")
        .select(`
          photo_id,
          face_bbox,
          photo:photos (
            id,
            path,
            created_at,
            original_filename,
            taken_at,
            tags,
            photo_people (
              person:people (
                id,
                name
              ),
              face_bbox
            )
          )
        `)
        .eq("person_id", id);

      if (photosError) throw photosError;

      // Get user's favorites
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      const { data: favoritesData } = await supabase
        .from("favorites")
        .select("photo_id")
        .eq("user_id", userData?.id || "");

      const favoriteIds = new Set(favoritesData?.map(f => f.photo_id) || []);

      // Transform photos
      const transformedPhotos: Photo[] = (photoData || []).map((pp: any) => {
        const photo = pp.photo;
        const faces: FaceDetection[] = photo.photo_people?.map((photoP: any) => ({
          personId: photoP.person.id,
          personName: photoP.person.name,
          boundingBox: photoP.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
        })) || [];

        return {
          id: photo.id,
          path: photo.path,
          created_at: photo.created_at,
          filename: photo.original_filename,
          is_favorite: favoriteIds.has(photo.id),
          faces,
          taken_at: photo.taken_at,
          tags: photo.tags || [],
        };
      });

      // Create person cluster
      const cluster: PersonCluster = {
        id: personData.id,
        name: personData.name,
        thumbnailPath: personData.thumbnail_url || transformedPhotos[0]?.path || "/placeholder.svg",
        photoCount: transformedPhotos.length,
        photos: transformedPhotos.map(p => p.path),
      };

      setPerson(cluster);
      setPhotos(transformedPhotos);
    } catch (error: any) {
      toast({
        title: "Error loading person",
        description: error.message,
        variant: "destructive",
      });
      navigate("/people");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhoto = (id: string) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedPhotos(new Set());
    }
  };

  const handleRemovePhotos = async () => {
    if (!person) return;
    
    try {
      // Remove photo_people associations for selected photos
      for (const photoId of Array.from(selectedPhotos)) {
        await supabase
          .from("photo_people")
          .delete()
          .eq("photo_id", photoId)
          .eq("person_id", person.id);
      }

      toast({
        title: "Success",
        description: `Removed ${selectedPhotos.size} photo(s) from ${person.name || "this person"}`,
      });

      // Refresh data
      fetchPersonAndPhotos();
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

  const handleDeletePhotos = async () => {
    try {
      // Delete photos entirely
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
      fetchPersonAndPhotos();
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

  const handlePhotoClick = (photo: Photo) => {
    if (!isSelectionMode) {
      setLightboxPhoto(photo);
    }
  };

  const handleNameSave = async (name: string) => {
    if (!person) return;
    
    try {
      await supabase
        .from("people")
        .update({ name })
        .eq("id", person.id);

      setPerson({ ...person, name });
      toast({
        title: "Success",
        description: `Person named: ${name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMerge = (targetPerson: PersonCluster) => {
    toast({
      title: "Success",
      description: `Merged with ${targetPerson.name}`,
    });
    navigate("/people");
  };

  const currentPhotoIndex = lightboxPhoto
    ? photos.findIndex((p) => p.id === lightboxPhoto.id)
    : -1;

  const handlePrevious = () => {
    const previousIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1;
    setLightboxPhoto(photos[previousIndex]);
  };

  const handleNext = () => {
    const nextIndex = currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0;
    setLightboxPhoto(photos[nextIndex]);
  };

  const handleToggleFavorite = (photoId: string) => {
    setPhotos((prevPhotos) =>
      prevPhotos.map((p) =>
        p.id === photoId ? { ...p, is_favorite: !p.is_favorite } : p
      )
    );
    // Also update the lightbox photo if it's the one being toggled
    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto({ ...lightboxPhoto, is_favorite: !lightboxPhoto.is_favorite });
    }
  };

  const handleUpdateFaces = (photoId: string, faces: FaceDetection[]) => {
    setPhotos((prevPhotos) =>
      prevPhotos.map((p) =>
        p.id === photoId ? { ...p, faces } : p
      )
    );
    // Also update the lightbox photo if it's the one being updated
    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto({ ...lightboxPhoto, faces });
    }
  };

  const handleUpdatePeople = async (personId: string, personName: string, photoPath: string) => {
    // Update person in database if needed
    try {
      await supabase
        .from("people")
        .update({ name: personName })
        .eq("id", personId);
      
      // Refresh data if it's the current person
      if (person && person.id === personId) {
        fetchPersonAndPhotos();
      }
    } catch (error: any) {
      toast({
        title: "Error updating person",
        description: error.message,
        variant: "destructive",
      });
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

  if (!person) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Person not found</p>
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
            showDates={showDates}
            onToggleDates={() => setShowDates(!showDates)}
            cropSquare={cropSquare}
            onToggleCropSquare={() => setCropSquare(!cropSquare)}
          />
          <main className="flex-1 p-4 md:p-6">
            <div className="space-y-4 md:space-y-6">
              {/* Header */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/people")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    {person.name ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
                          {person.name}
                        </h1>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsNamingDialogOpen(true)}
                          className="shrink-0"
                        >
                          Edit name
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="link"
                        className="text-xl md:text-3xl font-bold p-0 h-auto text-primary hover:text-primary/80"
                        onClick={() => setIsNamingDialogOpen(true)}
                      >
                        Name This Person
                      </Button>
                    )}
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                      {person.photoCount} {person.photoCount === 1 ? "Item" : "Items"}
                    </p>
                  </div>
                </div>

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
                          onRemove={handleRemovePhotos}
                          onShare={handleShare}
                          onDelete={handleDeletePhotos}
                          personName={person.name || "This Person"}
                        />
                      </div>
                      <Button
                        onClick={handleToggleSelectionMode}
                        size="sm"
                        className="md:ml-auto"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleToggleSelectionMode}
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
                      onRemove={handleRemovePhotos}
                      onShare={handleShare}
                      onDelete={handleDeletePhotos}
                      personName={person.name || "This Person"}
                    />
                  </div>
                )}
              </div>

              {/* Photo Grid */}
              <div 
                className="grid gap-2 md:gap-4"
                style={{
                  gridTemplateColumns: `repeat(${zoomLevel}, minmax(0, 1fr))`,
                }}
              >
                {photos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedPhotos.has(photo.id)}
                    onSelect={handleSelectPhoto}
                    onClick={() => handlePhotoClick(photo)}
                    isSelectionMode={isSelectionMode}
                    cropSquare={cropSquare}
                  />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>


      <Lightbox
        photo={lightboxPhoto}
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToggleFavorite={handleToggleFavorite}
        onUpdateFaces={handleUpdateFaces}
        onUpdatePeople={handleUpdatePeople}
      />

      <NamingDialog
        isOpen={isNamingDialogOpen}
        onClose={() => setIsNamingDialogOpen(false)}
        currentPerson={person}
        allPeople={[]} // Not needed in this context
        onNameSave={handleNameSave}
        onMerge={handleMerge}
      />

      <SharePhotosDialog
        photoIds={Array.from(selectedPhotos)}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        onShareComplete={handleShareComplete}
      />
    </SidebarProvider>
  );
}
