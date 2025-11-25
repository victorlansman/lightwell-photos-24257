import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { AlbumViewContainer } from "@/components/AlbumViewContainer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { useCollections } from "@/hooks/useCollections";
import { usePhotosWithClusters, useAllPeople } from "@/hooks/useAlbumPhotos";

export default function UnknownPeople() {
  const navigate = useNavigate();

  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Fetch all photos
  const { photos: allPhotos, isLoading: photosLoading, hasMore, isLoadingMore, loadMore, refetch } = usePhotosWithClusters(firstCollectionId);
  const { allPeople, isLoading: peopleLoading, refetch: refetchPeople } = useAllPeople(firstCollectionId, {
    enabled: false,  // Don't load ALL clusters - not needed
  });

  // Filter to only unnamed individual faces (not in clusters)
  const clusterPersonIds = useMemo(() => {
    return new Set(
      allPeople.filter(p => !p.name).map(p => p.id)
    );
  }, [allPeople]);

  const unnamedPhotos = useMemo(() => {
    return allPhotos.filter(photo => {
      const hasUnnamedFace = photo.faces?.some(face =>
        !face.personName && !clusterPersonIds.has(face.personId || '')
      );
      return hasUnnamedFace;
    });
  }, [allPhotos, clusterPersonIds]);

  const loading = collectionsLoading || photosLoading || peopleLoading;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewContainer
            photos={unnamedPhotos}
            allPeople={allPeople}
            collectionId={firstCollectionId!}
            isLoading={photosLoading}
            showViewControls
            enableSelection
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
            onPhotoFacesUpdated={async () => {
              await refetch();
              await refetchPeople();
            }}
            renderHeader={() => (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4"
                  onClick={() => navigate("/people")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to People
                </Button>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Unnamed People</h1>
                <p className="text-muted-foreground mt-1">
                  {unnamedPhotos.length} {unnamedPhotos.length === 1 ? "photo" : "photos"} with untagged faces
                </p>
              </div>
            )}
            renderEmptyState={() => (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No photos with unnamed faces</p>
                <p className="text-sm text-muted-foreground mt-2">All faces have been tagged!</p>
              </div>
            )}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
