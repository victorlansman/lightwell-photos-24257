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

export default function PersonAlbum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(false);
  const [cropSquare, setCropSquare] = useState(true);
  const [showFaces, setShowFaces] = useState(false);
  const [isChoosingThumbnail, setIsChoosingThumbnail] = useState(false);

  // TODO: Multi-collection support - currently showing first collection only
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Fetch all people for EditPersonDialog
  const { data: allPeople = [], isLoading: peopleLoading } = usePeople(firstCollectionId);

  // Fetch photos filtered by person_id
  const { data: azurePhotos = [], isLoading: photosLoading, refetch: refetchPhotos } = useCollectionPhotos(
    firstCollectionId,
    { person_id: id }
  );
  const toggleFavoriteMutation = useToggleFavorite();

  const loading = collectionsLoading || peopleLoading || photosLoading;

  // Find person from people list
  const person = useMemo(() => {
    return allPeople.find(p => p.id === id) || null;
  }, [allPeople, id]);

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
      faces: photo.people.map(person => ({
        personId: person.id,
        personName: person.name,
        boundingBox: person.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
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
    if (isChoosingThumbnail) {
      // Get the face bounding box for this person in this photo
      const face = photo.faces?.find(f => f.personId === person!.id);
      const bbox = face?.boundingBox || { x: 50, y: 50, width: 20, height: 20 };
      
      // Update person's thumbnail with the photo path and bounding box
      try {
        await supabase
          .from("people")
          .update({ 
            thumbnail_url: photo.path,
            thumbnail_bbox: bbox
          })
          .eq("id", person!.id);

        setPerson(prev => prev ? { 
          ...prev, 
          thumbnailPath: photo.path,
          thumbnailBbox: bbox
        } : null);
        setIsChoosingThumbnail(false);
        setShowFaces(false);
        
        toast({
          title: "Success",
          description: "Thumbnail updated",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else if (!isSelectionMode) {
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

  const handleUpdateFaces = async (photoId: string, faces: FaceDetection[]) => {
    try {
      // Update local state immediately for responsive UI
      setPhotos((prevPhotos) =>
        prevPhotos.map((p) =>
          p.id === photoId ? { ...p, faces } : p
        )
      );
      
      if (lightboxPhoto && lightboxPhoto.id === photoId) {
        setLightboxPhoto(prev => prev ? { ...prev, faces } : null);
      }

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
        await supabase
          .from("photo_people")
          .insert(insertData);
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
      
      // Update local state immediately
      setAllPeople(prevPeople => 
        prevPeople.map(p => 
          p.id === personId ? { ...p, name: personName } : p
        )
      );
      
      // Update the current person if it's the one being renamed
      if (person?.id === personId) {
        setPerson(prev => prev ? { ...prev, name: personName } : null);
      }
      
      // Update faces in photos to reflect the new name
      setPhotos(prevPhotos => 
        prevPhotos.map(photo => ({
          ...photo,
          faces: photo.faces.map(face => 
            face.personId === personId ? { ...face, personName } : face
          )
        }))
      );
      
      // Update lightbox photo if open
      if (lightboxPhoto) {
        setLightboxPhoto(prev => prev ? {
          ...prev,
          faces: prev.faces.map(face => 
            face.personId === personId ? { ...face, personName } : face
          )
        } : null);
      }
      
      // Refresh all data in background
      refetchPhotos();
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
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted">
                      {(() => {
                        // Use stored bounding box if available
                        const bbox = person.thumbnailBbox || { x: 50, y: 50, width: 20, height: 20 };
                        
                        const centerX = bbox.x + bbox.width / 2;
                        const centerY = bbox.y + bbox.height / 2;
                        const zoomFactor = Math.max(100 / bbox.width, 100 / bbox.height) * 0.8;
                        
                        return (
                          <img
                            src={person.thumbnailPath}
                            alt={person.name || "Person"}
                            className="w-full h-full object-cover"
                            style={{
                              objectPosition: `${centerX}% ${centerY}%`,
                              transform: `scale(${zoomFactor})`,
                              transformOrigin: `${centerX}% ${centerY}%`,
                            }}
                          />
                        );
                      })()}
                    </div>
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
                className="grid gap-2 md:gap-4"
                style={{
                  gridTemplateColumns: `repeat(${zoomLevel}, minmax(0, 1fr))`,
                }}
              >
                {photos.map((photo) => (
                  (showFaces || isChoosingThumbnail) ? (
                    <div
                      key={photo.id}
                      className={cn(
                        "relative transition-transform duration-200",
                        isChoosingThumbnail && "border-8 border-primary rounded-full hover:scale-105 cursor-pointer"
                      )}
                    >
                      <FacePhotoCard
                        photo={photo}
                        personId={person.id}
                        isSelected={selectedPhotos.has(photo.id)}
                        onSelect={handleSelectPhoto}
                        onClick={() => handlePhotoClick(photo)}
                        isSelectionMode={isSelectionMode && !isChoosingThumbnail}
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
        onUpdatePeople={handleUpdatePeople}
        allPeople={allPeople}
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
