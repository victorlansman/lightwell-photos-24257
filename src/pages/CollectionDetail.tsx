import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Users } from "lucide-react";
import { PhotoFilters } from "@/components/PhotoFilters";
import { UploadPhotosDialog } from "@/components/UploadPhotosDialog";
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import { AlbumViewContainer } from "@/components/AlbumViewContainer";
import { useCollection } from "@/hooks/useCollections";
import { useApiAuth } from "@/contexts/ApiAuthContext";
import { usePhotosWithClusters, useAllPeople, PhotoFilters as AlbumPhotoFilters } from "@/hooks/useAlbumPhotos";

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useApiAuth();

  // Fetch collection
  const { data: collection, isLoading: collectionLoading } = useCollection(id);

  // Filter states
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Dialog states
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Build filters object
  const filters: AlbumPhotoFilters = {
    yearRange,
    personIds: selectedPeople.length > 0 ? selectedPeople : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    favoriteOnly: showFavoritesOnly,
  };

  // Use new hooks
  const { photos, allPhotos, isLoading: photosLoading, hasMore, isLoadingMore, loadMore, refetch } = usePhotosWithClusters(id, filters);
  const { allPeople } = useAllPeople(id);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  const loading = collectionLoading || photosLoading;
  const canUpload = collection?.user_role === "owner" || collection?.user_role === "admin";
  const canInvite = collection?.user_role === "owner";

  if (loading || !collection) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
                  {photos.length} {photos.length === 1 ? "photo" : "photos"}
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

      <AlbumViewContainer
        photos={photos}
        allPeople={allPeople}
        collectionId={id!}
        isLoading={photosLoading}
        showViewControls
        showFilters
        enableSelection
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        onPhotoFacesUpdated={async () => {
          await refetch();
        }}
        renderFilters={() => (
          <PhotoFilters
            photos={allPhotos}
            yearRange={yearRange}
            onYearRangeChange={setYearRange}
            selectedPeople={selectedPeople}
            onSelectedPeopleChange={setSelectedPeople}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            showFavoritesOnly={showFavoritesOnly}
            onShowFavoritesOnlyChange={setShowFavoritesOnly}
          />
        )}
      />

      <UploadPhotosDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        collectionId={id!}
      />

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        collectionId={id!}
      />
    </div>
  );
}
