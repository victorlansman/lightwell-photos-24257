import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mockPhotos } from "@/data/mockPhotos";
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
import { mockPeople } from "@/data/mockPeople";
import { PersonCluster } from "@/types/person";
import { Photo, FaceDetection } from "@/types/photo";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function PersonAlbum() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [people, setPeople] = useState<PersonCluster[]>(mockPeople);
  const [person, setPerson] = useState<PersonCluster | undefined>(
    people.find((p) => p.id === id)
  );
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(false);
  const [cropSquare, setCropSquare] = useState(true);

  if (!person) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6">
              <p>Person not found</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const [photos, setPhotos] = useState<Photo[]>(() => {
    // Get photos from mockPhotos that include this person
    return mockPhotos.filter(photo => 
      photo.faces?.some(face => face.personId === person.id)
    );
  });

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

  const handleRemovePhotos = () => {
    const remainingPhotos = person.photos.filter((_, index) => 
      !selectedPhotos.has(`${person.id}-${index}`)
    );
    
    setPerson({
      ...person,
      photos: remainingPhotos,
      photoCount: remainingPhotos.length,
    });
    
    toast.success(`Removed ${selectedPhotos.size} photo(s) from ${person.name || "this person"}`);
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleDeletePhotos = () => {
    const remainingPhotos = person.photos.filter((_, index) => 
      !selectedPhotos.has(`${person.id}-${index}`)
    );
    
    setPerson({
      ...person,
      photos: remainingPhotos,
      photoCount: remainingPhotos.length,
    });
    
    toast.success(`Deleted ${selectedPhotos.size} photo(s)`);
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handlePhotoClick = (photo: Photo) => {
    if (!isSelectionMode) {
      setLightboxPhoto(photo);
    }
  };

  const handleNameSave = (name: string) => {
    setPerson({ ...person, name });
    toast.success(`Person named: ${name}`);
  };

  const handleMerge = (targetPerson: PersonCluster) => {
    toast.success(`Merged with ${targetPerson.name}`);
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

  const handleUpdatePeople = (personId: string, personName: string, photoPath: string) => {
    setPeople((prevPeople) => {
      // Check if person already exists
      const existingPerson = prevPeople.find(p => p.id === personId);
      
      if (existingPerson) {
        // Update existing person
        const updatedPeople = prevPeople.map(p => {
          if (p.id === personId) {
            // Add photo if not already in the list
            const photos = p.photos.includes(photoPath) ? p.photos : [...p.photos, photoPath];
            return {
              ...p,
              name: personName,
              photoCount: photos.length,
              photos,
            };
          }
          return p;
        });
        
        // Also update local person state if it's the current person
        if (person && person.id === personId) {
          const updatedPerson = updatedPeople.find(p => p.id === personId);
          if (updatedPerson) {
            setPerson(updatedPerson);
          }
        }
        
        return updatedPeople;
      } else {
        // Create new person
        const newPerson: PersonCluster = {
          id: personId,
          name: personName,
          thumbnailPath: photoPath,
          photoCount: 1,
          photos: [photoPath],
        };
        return [...prevPeople, newPerson];
      }
    });
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
        allPeople={people}
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
