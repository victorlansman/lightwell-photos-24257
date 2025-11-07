import { useState } from "react";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PhotoGrid } from "@/components/PhotoGrid";
import { AlbumViewControls } from "@/components/AlbumViewControls";
import { InlineActionBar } from "@/components/InlineActionBar";
import { Lightbox } from "@/components/Lightbox";
import { SharePhotosDialog } from "@/components/SharePhotosDialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { mockPhotos } from "@/data/mockPhotos";
import { mockPeople } from "@/data/mockPeople";
import { Photo, FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { toast } from "sonner";

const Index = () => {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(true);
  const [cropSquare, setCropSquare] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>(mockPhotos);
  const [people, setPeople] = useState<PersonCluster[]>(mockPeople);
  const [showShareDialog, setShowShareDialog] = useState(false);

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

  const handleDelete = () => {
    const remainingPhotos = photos.filter(p => !selectedPhotos.has(p.id));
    setPhotos(remainingPhotos);
    toast.success(`Deleted ${selectedPhotos.size} photo(s)`);
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleToggleFavorite = (photoId: string) => {
    setPhotos((prevPhotos) =>
      prevPhotos.map((p) =>
        p.id === photoId ? { ...p, is_favorite: !p.is_favorite } : p
      )
    );
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
        return prevPeople.map(p => {
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
