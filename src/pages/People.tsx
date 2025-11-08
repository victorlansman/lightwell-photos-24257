import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PeopleGallery } from "@/components/PeopleGallery";
import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PersonCluster } from "@/types/person";

export default function People() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [people, setPeople] = useState<PersonCluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchPeople();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchPeople = async () => {
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

      if (!collectionsData || collectionsData.length === 0) {
        setLoading(false);
        return;
      }

      const collectionIds = collectionsData.map(c => c.collection_id);

      // Fetch all people from user's collections with their thumbnails
      const { data: peopleData, error } = await supabase
        .from("people")
        .select(`
          id,
          name,
          thumbnail_url,
          collection_id,
          photo_people (
            id,
            thumbnail_url,
            photo:photos (
              id,
              path
            )
          )
        `)
        .in("collection_id", collectionIds);

      if (error) throw error;

      // Transform data to PersonCluster format
      const clusters: PersonCluster[] = (peopleData || []).map(person => {
        const photos = person.photo_people?.map((pp: any) => pp.photo.path) || [];
        
        // Prioritize thumbnail URLs:
        // 1. Use person's thumbnail_url if available (for named people)
        // 2. Use first face's thumbnail_url if available (for unnamed clusters)
        // 3. Fall back to first photo path
        // 4. Fall back to placeholder
        const firstFaceThumbnail = person.photo_people?.[0]?.thumbnail_url;
        const thumbnailUrl = person.thumbnail_url || 
          firstFaceThumbnail ||
          (photos.length > 0 
            ? (photos[0].startsWith('/') 
                ? photos[0] 
                : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${photos[0]}`)
            : "/placeholder.svg");
            
        return {
          id: person.id,
          name: person.name,
          thumbnailPath: thumbnailUrl,
          photoCount: photos.length,
          photos: photos.map((path: string) => 
            path.startsWith('/') 
              ? path 
              : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${path}`
          ),
        };
      });

      // Sort by photo count (descending) and filter out people with 0 photos
      const sortedAndFiltered = clusters
        .filter(cluster => cluster.photoCount > 0)
        .sort((a, b) => b.photoCount - a.photoCount);

      setPeople(sortedAndFiltered);
    } catch (error: any) {
      toast({
        title: "Error loading people",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
    // Merge people in database
    const [firstId, ...restIds] = clusterIds;
    
    try {
      // Update all photo_people records to point to the first person
      for (const personId of restIds) {
        await supabase
          .from("photo_people")
          .update({ person_id: firstId })
          .eq("person_id", personId);
        
        // Delete the merged person
        await supabase
          .from("people")
          .delete()
          .eq("id", personId);
      }

      toast({
        title: "Success",
        description: `Merged ${clusterIds.length} people`,
      });

      // Refresh data
      fetchPeople();
      setSelectedClusters(new Set());
      setIsSelectionMode(false);
    } catch (error: any) {
      toast({
        title: "Error merging people",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleHide = async (clusterIds: string[]) => {
    // For now, just remove from local state
    // In a real app, you might want to add a "hidden" flag to the database
    setPeople((prev) => prev.filter((p) => !clusterIds.includes(p.id)));
    setSelectedClusters(new Set());
    setIsSelectionMode(false);
    
    toast({
      title: "Success",
      description: `Hidden ${clusterIds.length} people`,
    });
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
