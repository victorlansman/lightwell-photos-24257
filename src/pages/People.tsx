import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PeopleGallery } from "@/components/PeopleGallery";
import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PersonCluster } from "@/types/person";
import { useCollections } from "@/hooks/useCollections";
import { usePeople } from "@/hooks/usePeople";

export default function People() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // TODO: Multi-collection support - currently showing first collection only
  // Should fetch people from all collections and aggregate
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;
  const { data: people = [], isLoading: peopleLoading } = usePeople(firstCollectionId);

  const loading = collectionsLoading || peopleLoading;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSelectCluster = (id: string) => {
    setSelectedClusters((prev) => {
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
      setSelectedClusters(new Set());
    }
  };

  const handleMerge = async (clusterIds: string[]) => {
    // TODO: Implement merge endpoint in Azure backend
    // For now, show not implemented message
    toast({
      title: "Not yet implemented",
      description: "Merge functionality will be added after Azure migration is complete",
      variant: "destructive",
    });
    console.warn('Merge not implemented for Azure backend yet', { clusterIds });
  };

  const handleHide = async (clusterIds: string[]) => {
    // TODO: Implement hide/archive endpoint in Azure backend
    // For now, show not implemented message
    toast({
      title: "Not yet implemented",
      description: "Hide functionality will be added after Azure migration is complete",
      variant: "destructive",
    });
    console.warn('Hide not implemented for Azure backend yet', { clusterIds });
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
          <main className="flex-1 p-6">
            <PeopleGallery
              people={people}
              selectedClusters={selectedClusters}
              isSelectionMode={isSelectionMode}
              onSelectCluster={handleSelectCluster}
              onToggleSelectionMode={handleToggleSelectionMode}
              onMerge={handleMerge}
              onHide={handleHide}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
