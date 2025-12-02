import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PersonThumbnail } from "@/components/PersonThumbnail";
import { ThumbnailSelectionCard } from "@/components/ThumbnailSelectionCard";
import { NamingDialog } from "@/components/NamingDialog";
import { AlbumViewContainer } from "@/components/AlbumViewContainer";
import { PersonCluster } from "@/types/person";
import { Photo } from "@/types/photo";
import { ArrowLeft, Pencil } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";
import { usePeople } from "@/hooks/usePeople";
import { useUpdatePerson } from "@/hooks/useFaces";
import { azureApi } from "@/lib/azureApiClient";
import { usePhotosWithClusters, useAllPeople } from "@/hooks/useAlbumPhotos";
import { useClusterMetadata } from "@/hooks/useClusterMetadata";
import { toast } from "sonner";

export default function PersonAlbum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Multi-collection support - currently showing first collection only
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Fetch named people only (not clusters)
  const { data: namedPeople = [], isLoading: peopleLoading, refetch: refetchPeople } = usePeople(firstCollectionId);

  // Find if this ID is a named person
  const person = useMemo(() => {
    return namedPeople.find(p => p.id === id) || null;
  }, [namedPeople, id]);

  const isNamedPerson = !!person;

  // For named persons: use person_id filter (server-side)
  // For clusters: use cluster_ids filter (server-side)
  const { photos, isLoading: photosLoading, hasMore, isLoadingMore, loadMore, refetch } = usePhotosWithClusters(
    firstCollectionId,
    isNamedPerson
      ? { personIds: [id!] }
      : { clusterIds: [id!] }  // USE CLUSTER FILTER for unnamed clusters
  );

  // For clusters: need metadata for the header
  const { data: clusterMetadata = [], isLoading: clusterLoading, refetch: refetchClusterMetadata } = useClusterMetadata(
    firstCollectionId,
    isNamedPerson ? [] : [id!]  // Only fetch if viewing cluster
  );

  const cluster = clusterMetadata[0] || null;
  const isCluster = !!cluster && !isNamedPerson;

  // Build display person from either named person or cluster metadata
  const displayPerson = useMemo((): PersonCluster | undefined => {
    if (isNamedPerson && person) {
      return {
        id: person.id,
        name: person.name,
        representativeFaceId: person.representativeFaceId,
        photoCount: person.photoCount,
        photos: [],
      };
    }

    if (cluster) {
      const photoIds = Array.from(new Set(cluster.faces.map(f => f.photo_id)));

      return {
        id: cluster.id,
        name: null,
        representativeFaceId: cluster.representative_face_id,
        photoCount: photoIds.length,
        photos: photoIds,
      };
    }

    return undefined;
  }, [isNamedPerson, person, cluster]);

  // Only need allPeople for lightbox face tags (load lazily)
  const { allPeople, refetch: refetchAllPeople } = useAllPeople(firstCollectionId, {
    enabled: false,  // Don't block page load - we'll load on-demand later
  });

  // UI state
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [isChoosingThumbnail, setIsChoosingThumbnail] = useState(false);

  // Mutations
  const updatePersonMutation = useUpdatePerson();

  // Loading state - only wait for photos and person/cluster metadata
  const loading = collectionsLoading || peopleLoading || photosLoading || (!isNamedPerson && clusterLoading);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSelectFaceForThumbnail = async (_face: unknown, photoId: string) => {
    if (!displayPerson || isCluster) return;

    try {
      await updatePersonMutation.mutateAsync({
        personId: displayPerson.id,
        request: { representative_photo_id: photoId },
      });

      await refetchPeople();
      setIsChoosingThumbnail(false);
      toast.success("Thumbnail updated");
    } catch (error: any) {
      console.error("[handleSelectFaceForThumbnail] Failed:", error);
      toast.error("Failed to update thumbnail");
    }
  };

  const handleNameSave = async (name: string, existingPersonId?: string) => {
    if (!displayPerson) return;

    try {
      if (isCluster && cluster && firstCollectionId) {
        let personId: string;

        if (existingPersonId) {
          personId = existingPersonId;
        } else {
          const newPerson = await azureApi.createPerson({
            name,
            collection_id: firstCollectionId,
          });
          personId = newPerson.id;
        }

        const result = await azureApi.labelCluster(cluster.id, personId);
        await refetchPeople();
        navigate("/people");
      } else if (person) {
        // Update existing named person
        await updatePersonMutation.mutateAsync({
          personId: person.id,
          request: { name },
        });

        await refetchPeople();
        toast.success("Name updated");
      }
    } catch (error: any) {
      console.error("[handleNameSave] Failed:", error);
    }
  };

  const handleMerge = (targetPerson: PersonCluster) => {
    navigate("/people");
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

          {/* Choose Thumbnail UI */}
          {isChoosingThumbnail && (
            <div className="border-b border-border px-4 py-3 flex items-center gap-4">
              <h2 className="text-xl font-semibold text-primary">Choose New Thumbnail</h2>
              <Button
                variant="outline"
                onClick={() => {
                  setIsChoosingThumbnail(false);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          <AlbumViewContainer
            photos={photos}
            allPeople={allPeople}
            collectionId={firstCollectionId!}
            isLoading={photosLoading}
            personId={id}
            showViewControls
            enableSelection
            hasMore={isCluster ? false : hasMore}
            isLoadingMore={isCluster ? false : isLoadingMore}
            onLoadMore={isCluster ? undefined : loadMore}
            onPhotoFacesUpdated={async () => {
              // Refetch appropriate data based on whether viewing cluster or person
              if (isCluster) {
                await refetchClusterMetadata();
              } else {
                await refetch();
              }
              await refetchAllPeople();
            }}
            onFaceClick={isChoosingThumbnail ? handleSelectFaceForThumbnail : undefined}
            renderHeader={() => (
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/people")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <div className="relative">
                  <PersonThumbnail
                    faceId={displayPerson.representativeFaceId}
                    size="sm"
                  />
                  {!isCluster && (
                    <button
                      onClick={() => {
                        setIsChoosingThumbnail(true);
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
            )}
          />
        </div>
      </div>

      <NamingDialog
        isOpen={isNamingDialogOpen}
        onClose={() => setIsNamingDialogOpen(false)}
        currentPerson={displayPerson}
        allPeople={namedPeople}
        onNameSave={handleNameSave}
        onMerge={handleMerge}
      />
    </SidebarProvider>
  );
}
