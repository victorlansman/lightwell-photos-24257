import { useState, useEffect } from "react";
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
import { ArrowLeft } from "lucide-react";
import { getPhotoUrl } from "@/lib/utils";

export default function PersonAlbum() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [person, setPerson] = useState<PersonCluster | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allPeople, setAllPeople] = useState<PersonCluster[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(false);
  const [cropSquare, setCropSquare] = useState(true);
  const [showFaces, setShowFaces] = useState(false);
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

      if (!collectionsData || collectionsData.length === 0) return;

      const collectionIds = collectionsData.map(c => c.collection_id);

      // Fetch ALL people from user's collections for the EditPersonDialog
      const { data: allPeopleData } = await supabase
        .from("people")
        .select(`
          id,
          name,
          thumbnail_url,
          collection_id,
          photo_people (
            photo:photos (
              id,
              path
            )
          )
        `)
        .in("collection_id", collectionIds);

      // Transform all people data
      const peopleList: PersonCluster[] = (allPeopleData || []).map(person => {
        const photos = person.photo_people?.map((pp: any) => pp.photo.path) || [];
        const thumbnailUrl = person.thumbnail_url || 
          (photos.length > 0 ? getPhotoUrl(photos[0]) : "/placeholder.svg");
            
        return {
          id: person.id,
          name: person.name,
          thumbnailPath: thumbnailUrl,
          photoCount: photos.length,
          photos: photos.map((path: string) => getPhotoUrl(path)),
        };
      });

      setAllPeople(peopleList);

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
            thumbnail_url,
            created_at,
            original_filename,
            taken_at,
            tags,
            photo_people (
              person_id,
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
      const { data: userDataForFavorites } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      const { data: favoritesData } = await supabase
        .from("favorites")
        .select("photo_id")
        .eq("user_id", userDataForFavorites?.id || "");

      const favoriteIds = new Set(favoritesData?.map(f => f.photo_id) || []);

      // Transform photos
      const transformedPhotos: Photo[] = (photoData || []).map((pp: any) => {
        const photo = pp.photo;
        const faces: FaceDetection[] = photo.photo_people?.map((photoP: any) => ({
          personId: photoP.person_id,
          personName: photoP.person?.name || null,
          boundingBox: photoP.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
        })) || [];

        // Use thumbnail_url if available, otherwise use path and let getPhotoUrl handle the conversion
        const imageUrl = photo.thumbnail_url ? getPhotoUrl(photo.thumbnail_url) : getPhotoUrl(photo.path);

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
      fetchPersonAndPhotos();
    } catch (error: any) {
      toast({
        title: "Error updating face tags",
        description: error.message,
        variant: "destructive",
      });
      // Revert on error
      fetchPersonAndPhotos();
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
      fetchPersonAndPhotos();
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
                  <img
                    src={person.thumbnailPath}
                    alt={person.name || "Person"}
                    className="w-16 h-16 rounded-2xl object-cover"
                  />
                  
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
                  showFaces ? (
                    <FacePhotoCard
                      key={photo.id}
                      photo={photo}
                      personId={person.id}
                      isSelected={selectedPhotos.has(photo.id)}
                      onSelect={handleSelectPhoto}
                      onClick={() => handlePhotoClick(photo)}
                      isSelectionMode={isSelectionMode}
                    />
                  ) : (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      isSelected={selectedPhotos.has(photo.id)}
                      onSelect={handleSelectPhoto}
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
