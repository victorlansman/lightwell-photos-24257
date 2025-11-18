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
import { ArrowLeft, Pencil } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";
import { usePeople } from "@/hooks/usePeople";
import { useUpdatePerson, useClusters } from "@/hooks/useFaces";
import { azureApi } from "@/lib/azureApiClient";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";
import { usePhotosWithClusters, useAllPeople } from "@/hooks/useAlbumPhotos";

export default function PersonAlbum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Multi-collection support - currently showing first collection only
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Fetch all people and clusters
  const { data: namedPeople = [], isLoading: peopleLoading, refetch: refetchPeople } = usePeople(firstCollectionId);
  const { data: clusterData = [], isLoading: clustersLoading } = useClusters(firstCollectionId);

  // Find if this ID is a person or a cluster
  const person = useMemo(() => {
    return namedPeople.find(p => p.id === id) || null;
  }, [namedPeople, id]);

  const cluster = useMemo(() => {
    return clusterData.find(c => c.id === id) || null;
  }, [clusterData, id]);

  const isCluster = !!cluster && !person;

  // Use new hooks with person filter
  const { photos, isLoading: photosLoading } = usePhotosWithClusters(
    firstCollectionId,
    { personIds: [id!] }
  );
  const { allPeople } = useAllPeople(firstCollectionId);

  // Find current person/cluster
  const displayPerson = allPeople.find(p => p.id === id);

  // Get thumbnail photo URL
  const { url: thumbnailUrl } = usePhotoUrl(displayPerson?.thumbnailPath || '');

  // UI state
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [isChoosingThumbnail, setIsChoosingThumbnail] = useState(false);
  const [showFaces, setShowFaces] = useState(false);

  // Mutations
  const updatePersonMutation = useUpdatePerson();

  const loading = collectionsLoading || peopleLoading || clustersLoading || photosLoading;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSelectFaceForThumbnail = async (face, photoId: string) => {
    if (!displayPerson || isCluster) return;

    try {
      const updateRequest = {
        name: displayPerson.name || undefined,
        thumbnail_url: photoId,
        thumbnail_bbox: {
          x: (face.boundingBox.x as number) / 100,
          y: (face.boundingBox.y as number) / 100,
          width: (face.boundingBox.width as number) / 100,
          height: (face.boundingBox.height as number) / 100,
        },
      };

      await updatePersonMutation.mutateAsync({
        personId: displayPerson.id,
        request: updateRequest,
      });

      await refetchPeople();
      setIsChoosingThumbnail(false);
      setShowFaces(false);
    } catch (error: any) {
      console.error("[handleSelectFaceForThumbnail] Failed:", error);
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
        await supabase
          .from("people")
          .update({ name })
          .eq("id", person.id);

        await refetchPeople();
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
      <div className="flex min-h-screen w-full flex-col">
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
                  setShowFaces(false);
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
            gridMode="faces"
            personId={id}
            showViewControls
            enableSelection
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
                  {thumbnailUrl ? (
                    <PersonThumbnail
                      photoUrl={thumbnailUrl}
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
            )}
          />
        </div>
      </div>

      <NamingDialog
        isOpen={isNamingDialogOpen}
        onClose={() => setIsNamingDialogOpen(false)}
        currentPerson={displayPerson}
        allPeople={namedPeople.map(p => ({
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
    </SidebarProvider>
  );
}
