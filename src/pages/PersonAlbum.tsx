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
import { useUpdatePerson, useClusters } from "@/hooks/useFaces";
import { azureApi } from "@/lib/azureApiClient";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";
import { apiBboxToUi } from "@/types/coordinates";

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

  // Fetch all people and clusters
  const { data: allPeople = [], isLoading: peopleLoading, refetch: refetchPeople } = usePeople(firstCollectionId);
  const { data: clusterData = [], isLoading: clustersLoading } = useClusters(firstCollectionId);

  // Find if this ID is a person or a cluster
  const person = useMemo(() => {
    return allPeople.find(p => p.id === id) || null;
  }, [allPeople, id]);

  const cluster = useMemo(() => {
    return clusterData.find(c => c.id === id) || null;
  }, [clusterData, id]);

  const isCluster = !!cluster && !person;

  // Fetch photos - either by person_id or get all photos from cluster
  const { data: azurePhotos = [], isLoading: photosLoading, refetch: refetchPhotos } = useCollectionPhotos(
    firstCollectionId,
    !isCluster ? { person_id: id } : undefined
  );
  const toggleFavoriteMutation = useToggleFavorite();
  const updatePersonMutation = useUpdatePerson();

  const loading = collectionsLoading || peopleLoading || clustersLoading || photosLoading;

  // Create PersonCluster from either person or cluster data for uniform UI
  const displayPerson: PersonCluster | null = useMemo(() => {
    if (person) {
      return {
        id: person.id,
        name: person.name,
        thumbnailPath: person.thumbnail_url || '',
        thumbnailBbox: person.thumbnail_bbox || null,
        photoCount: person.photo_count,
        photos: [],
      };
    } else if (cluster) {
      const photoIds = Array.from(new Set(cluster.faces.map(f => f.photo_id)));
      const representativeFace = cluster.faces.find(f => f.id === cluster.representative_face_id) || cluster.faces[0];

      return {
        id: cluster.id,
        name: null, // Unnamed cluster
        thumbnailPath: cluster.representative_thumbnail_url || representativeFace.photo_id,
        thumbnailBbox: representativeFace ? apiBboxToUi(representativeFace.bbox) : null,
        photoCount: photoIds.length,
        photos: photoIds,
      };
    }
    return null;
  }, [person, cluster]);

  // Get thumbnail photo URL
  const { url: thumbnailUrl } = usePhotoUrl(displayPerson?.thumbnailPath || '');
  const displayThumbnailUrl = thumbnailUrl;

  // Transform Azure photos to Photo type, filtering by cluster if viewing a cluster
  const photos: Photo[] = useMemo(() => {
    let filteredPhotos = azurePhotos;

    // If viewing a cluster, only show photos that have faces in this cluster
    if (isCluster && cluster) {
      const clusterPhotoIds = new Set(cluster.faces.map(f => f.photo_id));
      filteredPhotos = azurePhotos.filter(photo => clusterPhotoIds.has(photo.id));
    }

    return filteredPhotos.map(photo => ({
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
  }, [azurePhotos, isCluster, cluster]);

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
    if (!displayPerson || isCluster) return; // Can't change thumbnail for clusters

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
        name: displayPerson.name || undefined,
        thumbnail_url: photoId,
        thumbnail_bbox: apiBbox,
      };

      console.log("[handleSelectFaceForThumbnail] Updating thumbnail:", {
        personId: displayPerson.id,
        personName: displayPerson.name,
        photoId,
        uiBbox: face.boundingBox,
        apiBbox,
      });

      await updatePersonMutation.mutateAsync({
        personId: displayPerson.id,
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

  const handleNameSave = async (name: string, existingPersonId?: string) => {
    if (!displayPerson) return;

    try {
      if (isCluster && cluster && firstCollectionId) {
        let personId: string;

        if (existingPersonId) {
          // User selected an existing person - merge cluster with that person
          personId = existingPersonId;
        } else {
          // Create a new person
          const newPerson = await azureApi.createPerson({
            name,
            collection_id: firstCollectionId,
          });
          personId = newPerson.id;
        }

        // Label the cluster - assign all faces to this person
        const result = await azureApi.labelCluster(cluster.id, personId);

        toast({
          title: "Success",
          description: `Labeled cluster: ${result.faces_updated} faces assigned to ${name}`,
        });

        // Refresh data and navigate
        await refetchPeople();
        await refetchPhotos();
        navigate("/people");
      } else if (person) {
        // For existing persons: just update the name
        await supabase
          .from("people")
          .update({ name })
          .eq("id", person.id);

        // Refresh people list to get updated name
        await refetchPeople();

        toast({
          title: "Success",
          description: `Person renamed: ${name}`,
        });
      }
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

  if (!displayPerson) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">
                {isCluster ? 'Cluster not found' : 'Person not found'}
              </p>
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
                  
                  {/* Person/Cluster thumbnail */}
                  <div className="relative">
                    {displayThumbnailUrl ? (
                      <PersonThumbnail
                        photoUrl={displayThumbnailUrl}
                        bbox={displayPerson.thumbnailBbox}
                        size="sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No thumbnail
                      </div>
                    )}
                    {!isCluster && (
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
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {displayPerson.name ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
                          {displayPerson.name}
                        </h1>
                        {!isCluster && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsNamingDialogOpen(true)}
                            className="shrink-0"
                          >
                            Edit name
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="link"
                        className="text-xl md:text-3xl font-bold p-0 h-auto text-primary hover:text-primary/80"
                        onClick={() => setIsNamingDialogOpen(true)}
                      >
                        Name This {isCluster ? 'Cluster' : 'Person'}
                      </Button>
                    )}
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                      {displayPerson.photoCount} {displayPerson.photoCount === 1 ? "Item" : "Items"}
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
                          personName={displayPerson.name || (isCluster ? "This Cluster" : "This Person")}
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
                      personName={displayPerson.name || (isCluster ? "This Cluster" : "This Person")}
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
                      personId={displayPerson.id}
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
                        personId={displayPerson.id}
                        isSelected={selectedPhotos.has(photo.id)}
                        onSelect={handleSelectPhoto}
                        onClick={() => handlePhotoClick(photo)}
                        isSelectionMode={isSelectionMode}
                        showOnlyUnnamed={isCluster}
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
        currentPerson={displayPerson}
        allPeople={allPeople.map(p => ({
          id: p.id,
          name: p.name,
          thumbnailPath: p.thumbnail_url || '',
          thumbnailBbox: p.thumbnail_bbox || null,
          photoCount: p.photo_count,
          photos: [],
        }))}
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
