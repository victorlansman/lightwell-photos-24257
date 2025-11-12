import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PhotoCard } from "@/components/PhotoCard";
import { FacePhotoCard } from "@/components/FacePhotoCard";
import { PersonThumbnail } from "@/components/PersonThumbnail";
import { ThumbnailSelectionCard } from "@/components/ThumbnailSelectionCard";
import { Lightbox } from "@/components/Lightbox";
import { NamingDialog } from "@/components/NamingDialog";
import { AlbumViewControls } from "@/components/AlbumViewControls";
import { InlineActionBar } from "@/components/InlineActionBar";
import { SharePhotosDialog } from "@/components/SharePhotosDialog";
import { PersonCluster } from "@/types/person";
import { Photo, FaceDetection } from "@/types/photo";
import { ArrowLeft, Pencil } from "lucide-react";
import { getPhotoUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useCollections } from "@/hooks/useCollections";
import { usePeople } from "@/hooks/usePeople";
import { useCollectionPhotos, useToggleFavorite } from "@/hooks/usePhotos";
import { useUpdatePerson } from "@/hooks/useFaces";
import { azureApi } from "@/lib/azureApiClient";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";

export default function PersonAlbum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(16);
  const [showDates, setShowDates] = useState(false);
  const [cropSquare, setCropSquare] = useState(true);
  const [showFaces, setShowFaces] = useState(false);
  const [isChoosingThumbnail, setIsChoosingThumbnail] = useState(false);

  // TODO: Multi-collection support - currently showing first collection only
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Fetch all people for EditPersonDialog
  const { data: allPeople = [], isLoading: peopleLoading, refetch: refetchPeople } = usePeople(firstCollectionId);

  // Fetch photos filtered by person_id
  const { data: azurePhotos = [], isLoading: photosLoading, refetch: refetchPhotos } = useCollectionPhotos(
    firstCollectionId,
    { person_id: id }
  );
  const toggleFavoriteMutation = useToggleFavorite();
  const updatePersonMutation = useUpdatePerson();

  const loading = collectionsLoading || peopleLoading || photosLoading;

  // Find person from people list
  const person = useMemo(() => {
    return allPeople.find(p => p.id === id) || null;
  }, [allPeople, id]);

  // Get thumbnail photo URL if thumbnailPath is a photo ID
  // thumbnailPath might be a photo ID (UUID) or a URL
  const thumbnailPhotoId = person?.thumbnailPath && 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(person.thumbnailPath)
    ? person.thumbnailPath 
    : null;
  const { url: thumbnailUrl, loading: thumbnailLoading } = usePhotoUrl(thumbnailPhotoId || '', { thumbnail: true });
  
  // Use thumbnail URL if it's a photo ID, otherwise use thumbnailPath directly (if it's already a URL)
  const displayThumbnailUrl = thumbnailPhotoId ? thumbnailUrl : (person?.thumbnailPath || '');

  // Transform Azure photos to Photo type
  const photos: Photo[] = useMemo(() => {
    return azurePhotos.map(photo => ({
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
    }));
  }, [azurePhotos]);

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
    // TODO: Implement remove face tags endpoint in Azure backend
    toast({
      title: "Not yet implemented",
      description: "Remove functionality will be added after Azure migration is complete",
      variant: "destructive",
    });
    console.warn('Remove photos from person not implemented for Azure backend yet', { selectedPhotos });
  };

  const handleDeletePhotos = async () => {
    // TODO: Implement delete photos endpoint in Azure backend
    toast({
      title: "Not yet implemented",
      description: "Delete functionality will be added after Azure migration is complete",
      variant: "destructive",
    });
    console.warn('Delete photos not implemented for Azure backend yet', { selectedPhotos });
  };

  const handlePhotoClick = async (photo: Photo) => {
    if (!isSelectionMode) {
      setLightboxPhoto(photo);
    }
  };

  const handleSelectFaceForThumbnail = async (
    face: FaceDetection,
    photoId: string
  ) => {
    if (!person) return;

    try {
      // Convert UI coordinates (0-100) to API coordinates (0-1)
      const apiBbox = {
        x: face.boundingBox.x / 100,
        y: face.boundingBox.y / 100,
        width: face.boundingBox.width / 100,
        height: face.boundingBox.height / 100,
      };

      const updateRequest: {
        name?: string;
        thumbnail_url?: string;
        thumbnail_bbox?: { x: number; y: number; width: number; height: number };
      } = {
        name: person.name || undefined,
        thumbnail_url: photoId,
        thumbnail_bbox: apiBbox,
      };

      console.log("[handleSelectFaceForThumbnail] Updating thumbnail:", {
        personId: person.id,
        personName: person.name,
        photoId,
        uiBbox: face.boundingBox,
        apiBbox,
      });

      await updatePersonMutation.mutateAsync({
        personId: person.id,
        request: updateRequest,
      });

      // Refetch people to get updated thumbnail
      await refetchPeople();

      setIsChoosingThumbnail(false);
      setShowFaces(false);

      toast({
        title: "Success",
        description: "Thumbnail updated",
      });
    } catch (error: any) {
      console.error("[handleSelectFaceForThumbnail] Failed to update thumbnail:", error);

      const errorMessage = error.message || "Failed to update thumbnail";
      const isValidationError =
        errorMessage.includes("422") ||
        errorMessage.includes("Unprocessable") ||
        errorMessage.includes("Validation") ||
        errorMessage.includes("missing");

      toast({
        title: "Failed to update thumbnail",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleNameSave = async (name: string) => {
    if (!person) return;

    try {
      await supabase
        .from("people")
        .update({ name })
        .eq("id", person.id);

      // Refresh people list to get updated name
      await refetchPeople();

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
    // Photos are derived from azurePhotos via useMemo, so React Query handles updates
    // No need to manually update local state
    // Also update the lightbox photo if it's the one being toggled
    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto({ ...lightboxPhoto, is_favorite: !lightboxPhoto.is_favorite });
    }
  };

  const handleUpdateFaces = async (photoId: string, faces?: FaceDetection[]) => {
    try {
      // Photos are derived from azurePhotos via useMemo, so React Query handles updates
      // Update lightbox photo immediately for responsive UI
      if (lightboxPhoto && lightboxPhoto.id === photoId && faces) {
        setLightboxPhoto({ ...lightboxPhoto, faces });
      }

      // Refresh data in background to update counts (don't await to avoid race conditions)
      refetchPhotos();
    } catch (error: any) {
      toast({
        title: "Error updating face tags",
        description: error.message,
        variant: "destructive",
      });
      // Revert on error
      refetchPhotos();
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
        // Person doesn't exist, create them with proper collection_id
        if (!person?.id) return;
        
        // Get the collection_id from the current person we're viewing
        const { data: personData } = await supabase
          .from("people")
          .select("collection_id")
          .eq("id", person.id)
          .single();
        
        if (!personData) return;

        await supabase
          .from("people")
          .insert({
            id: personId,
            name: personName,
            collection_id: personData.collection_id,
            thumbnail_url: photoPath,
          });
      } else {
        // Person exists, update their name
        await supabase
          .from("people")
          .update({ name: personName })
          .eq("id", personId);
      }
      
      // Update lightbox photo if open with new person name for faces
      if (lightboxPhoto) {
        setLightboxPhoto(prev => prev ? {
          ...prev,
          faces: prev.faces.map(face =>
            face.personId === personId ? { ...face, personName } : face
          )
        } : null);
      }

      // Refresh all data - people list and photos
      await refetchPeople();
      await refetchPhotos();
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
            showFaces={showFaces}
            onToggleFaces={() => setShowFaces(!showFaces)}
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
                  
                  {/* Person thumbnail */}
                  <div className="relative">
                    {displayThumbnailUrl ? (
                      <PersonThumbnail
                        photoUrl={displayThumbnailUrl}
                        bbox={person.thumbnailBbox}
                        size="sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No thumbnail
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setIsChoosingThumbnail(true);
                        setShowFaces(true);
                      }}
                      className="absolute top-1 right-1 bg-background/90 hover:bg-background rounded-full p-1.5 transition-colors shadow-sm"
                      title="Change thumbnail"
                    >
                      <Pencil className="h-3 w-3 text-foreground" />
                    </button>
                  </div>
                  
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

                {/* Choose Thumbnail UI */}
                {isChoosingThumbnail && (
                  <div className="flex items-center gap-4 py-2">
                    <h2 className="text-2xl font-semibold text-primary">
                      Choose New Thumbnail
                    </h2>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsChoosingThumbnail(false);
                        setShowFaces(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

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
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${zoomLevel}, minmax(0, 1fr))`,
                  gap: "0.5rem",
                  gridAutoFlow: "row",
                }}>
                {photos.map((photo) => (
                  isChoosingThumbnail ? (
                    <ThumbnailSelectionCard
                      key={photo.id}
                      photo={photo}
                      personId={person.id}
                      onSelectFace={handleSelectFaceForThumbnail}
                    />
                  ) : showFaces ? (
                    <div
                      key={photo.id}
                      className={cn(
                        "relative transition-transform duration-200"
                      )}
                    >
                      <FacePhotoCard
                        photo={photo}
                        personId={person.id}
                        isSelected={selectedPhotos.has(photo.id)}
                        onSelect={handleSelectPhoto}
                        onClick={() => handlePhotoClick(photo)}
                        isSelectionMode={isSelectionMode}
                      />
                    </div>
                  ) : (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      isSelected={selectedPhotos.has(photo.id)}
                      onSelect={() => handleSelectPhoto(photo.id)}
                      onClick={() => handlePhotoClick(photo)}
                      isSelectionMode={isSelectionMode}
                      cropSquare={cropSquare}
                    />
                  )
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
        onPersonCreated={async () => {
          // Refresh people list when a new person is created
          await refetchPeople();
        }}
        allPeople={allPeople}
        collectionId={firstCollectionId!}
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
