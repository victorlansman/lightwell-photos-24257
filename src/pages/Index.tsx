import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { AlbumViewContainer } from "@/components/AlbumViewContainer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useCollections } from "@/hooks/useCollections";
import { usePhotosWithClusters, useAllPeople } from "@/hooks/useAlbumPhotos";

const Index = () => {
  const navigate = useNavigate();

  // Multi-collection support - currently showing first collection only
  const { data: collections } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Use new hooks
  const { photos, isLoading, hasMore, isLoadingMore, loadMore, refetch } = usePhotosWithClusters(firstCollectionId);
  const { allPeople, refetch: refetchPeople } = useAllPeople(firstCollectionId);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <AlbumViewContainer
            photos={photos}
            allPeople={allPeople}
            collectionId={firstCollectionId!}
            isLoading={isLoading}
            defaultZoomLevel={4}
            showViewControls
            enableSelection
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
            onPhotoFacesUpdated={async () => {
              console.log('[Index] onPhotoFacesUpdated called, refetching photos and people...');
              await refetch();
              await refetchPeople();
              console.log('[Index] Refetch complete, people data updated');
            }}
            renderHeader={() => (
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Timeline</h1>
            )}
          />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
