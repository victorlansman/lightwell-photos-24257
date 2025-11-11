import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Users } from "lucide-react";
import { PhotoFilters } from "@/components/PhotoFilters";
import { PhotoGrid } from "@/components/PhotoGrid";
import { UploadPhotosDialog } from "@/components/UploadPhotosDialog";
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import { Lightbox } from "@/components/Lightbox";
import { AlbumViewControls } from "@/components/AlbumViewControls";
import { Photo as AzurePhoto } from "@/lib/azureApiClient";
import { Photo, FaceDetection } from "@/types/photo";
import { useCollection } from "@/hooks/useCollections";
import { useCollectionPhotos, useToggleFavorite } from "@/hooks/usePhotos";
import { useUpdatePhotoFaces, useUpdatePerson, useCreatePerson } from "@/hooks/useFaces";
import { useApiAuth } from "@/contexts/ApiAuthContext";
import { PersonCluster } from "@/types/person";

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated } = useApiAuth();

  // Fetch collection and photos from Azure API
  const { data: collection, isLoading: collectionLoading } = useCollection(id);
  const { data: photos = [], isLoading: photosLoading, refetch: refetchPhotos } = useCollectionPhotos(id);
  const toggleFavoriteMutation = useToggleFavorite();
  const updateFacesMutation = useUpdatePhotoFaces();
  const updatePersonMutation = useUpdatePerson();
  const createPersonMutation = useCreatePerson();

  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [allPeople, setAllPeople] = useState<PersonCluster[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // View controls
  const [zoomLevel, setZoomLevel] = useState(4);
  const [showDates, setShowDates] = useState(true);
  const [cropSquare, setCropSquare] = useState(true);

  // Filter states
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  // Convert Azure API photos to local Photo type and apply filters
  useEffect(() => {
    const convertedPhotos: Photo[] = photos.map((azurePhoto: AzurePhoto) => {
      const faces: FaceDetection[] = azurePhoto.people.map(person => ({
        personId: person.id,
        personName: person.name,
        // Coordinates already in UI format (0-100) from API client
        boundingBox: person.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
      }));

      return {
        id: azurePhoto.id,
        path: azurePhoto.path,
        thumbnail_url: azurePhoto.thumbnail_url,
        original_filename: azurePhoto.path.split('/').pop() || null,
        created_at: azurePhoto.created_at,
        is_favorite: azurePhoto.is_favorite,
        title: azurePhoto.title,
        description: azurePhoto.description,
        width: azurePhoto.width,
        height: azurePhoto.height,
        rotation: azurePhoto.rotation,
        estimated_year: azurePhoto.estimated_year,
        user_corrected_year: azurePhoto.user_corrected_year,
        tags: azurePhoto.tags,
        people: azurePhoto.people,
        faces,
        taken_at: null, // Not provided by Azure API yet
        filename: azurePhoto.path.split('/').pop() || undefined,
      };
    });

    let filtered = [...convertedPhotos];

    // Year filter
    filtered = filtered.filter(photo => {
      const year = photo.user_corrected_year || photo.estimated_year;
      if (!year) return true;
      return year >= yearRange[0] && year <= yearRange[1];
    });

    // People filter
    if (selectedPeople.length > 0) {
      filtered = filtered.filter(photo =>
        photo.faces?.some(face => selectedPeople.includes(face.personId))
      );
    }

    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(photo =>
        selectedTags.some(tag => photo.tags?.includes(tag))
      );
    }

    // Favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter(photo => photo.is_favorite);
    }

    setFilteredPhotos(filtered);
  }, [photos, yearRange, selectedPeople, selectedTags, showFavoritesOnly]);

  // Extract unique people from photos for person selection
  useEffect(() => {
    const peopleMap = new Map<string, PersonCluster>();

    photos.forEach(photo => {
      photo.people.forEach(person => {
        if (!peopleMap.has(person.id)) {
          peopleMap.set(person.id, {
            id: person.id,
            name: person.name,
            photoCount: 1,
          });
        } else {
          const existing = peopleMap.get(person.id)!;
          existing.photoCount += 1;
        }
      });
    });

    setAllPeople(Array.from(peopleMap.values()));
  }, [photos]);

  const handleToggleFavorite = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    try {
      await toggleFavoriteMutation.mutateAsync({
        photoId,
        isFavorited: !photo.is_favorite,
      });

      toast({
        title: photo.is_favorite ? "Removed from favorites" : "Added to favorites",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update favorite",
        variant: "destructive",
      });
    }
  };

  const handlePhotoClick = (photo: Photo) => {
    if (!isSelectionMode) {
      setLightboxPhoto(photo);
    } else {
      handleSelectPhoto(photo.id);
    }
  };

  const handleSelectPhoto = (photoId: string) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handlePrevious = () => {
    if (!lightboxPhoto) return;
    const currentIndex = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredPhotos.length - 1;
    setLightboxPhoto(filteredPhotos[prevIndex]);
  };

  const handleNext = () => {
    if (!lightboxPhoto) return;
    const currentIndex = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
    const nextIndex = currentIndex < filteredPhotos.length - 1 ? currentIndex + 1 : 0;
    setLightboxPhoto(filteredPhotos[nextIndex]);
  };

  const handleUpdateFaces = async (photoId: string) => {
    // Refresh photos from server to get updated faces
    await refetchPhotos();
  };

  const handlePersonCreated = (_personId: string, _name: string) => {
    // Refresh photos to get updated people list
    refetchPhotos();
  };

  const loading = collectionLoading || photosLoading;
  const canUpload = collection?.user_role === "owner" || collection?.user_role === "admin";
  const canInvite = collection?.user_role === "owner";

  if (loading || !collection) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/collections")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{collection.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredPhotos.length} {filteredPhotos.length === 1 ? "photo" : "photos"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canInvite && (
                <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              )}
              {canUpload && (
                <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <PhotoFilters
          photos={filteredPhotos}
          yearRange={yearRange}
          onYearRangeChange={setYearRange}
          selectedPeople={selectedPeople}
          onSelectedPeopleChange={setSelectedPeople}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
          showFavoritesOnly={showFavoritesOnly}
          onShowFavoritesOnlyChange={setShowFavoritesOnly}
        />

        <div className="mb-4">
          <AlbumViewControls
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            showDates={showDates}
            onToggleDates={() => setShowDates(!showDates)}
            cropSquare={cropSquare}
            onToggleCropSquare={() => setCropSquare(!cropSquare)}
          />
        </div>

        <PhotoGrid
          photos={filteredPhotos}
          selectedPhotos={selectedPhotos}
          onSelectPhoto={handleSelectPhoto}
          onPhotoClick={handlePhotoClick}
          zoomLevel={zoomLevel}
          showDates={showDates}
          cropSquare={cropSquare}
          isSelectionMode={isSelectionMode}
        />
      </main>

      <UploadPhotosDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        collectionId={id!}
        onUploadComplete={refetchPhotos}
      />

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        collectionId={id!}
      />

      <Lightbox
        photo={lightboxPhoto}
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToggleFavorite={handleToggleFavorite}
        onUpdateFaces={handleUpdateFaces}
        onPersonCreated={handlePersonCreated}
        allPeople={allPeople}
        collectionId={id!}
      />
    </div>
  );
}
