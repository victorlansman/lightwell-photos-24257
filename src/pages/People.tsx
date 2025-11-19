import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PeopleGallery } from "@/components/PeopleGallery";
import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useCollections } from "@/hooks/useCollections";
import { useAllPeople } from "@/hooks/useAlbumPhotos";
import { azureApi } from "@/lib/azureApiClient";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PersonThumbnail } from "@/components/PersonThumbnail";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";
import { PersonCluster } from "@/types/person";

// Component for merge dialog option with photo URL (outside component to enable proper memo)
const MergePersonOption = memo(({ person }: { person: PersonCluster }) => {
  // Skip fetch if no thumbnail path (prevents 404s)
  const { url: photoUrl } = usePhotoUrl(person.thumbnailPath || '', { thumbnail: true });

  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent">
      <RadioGroupItem value={person.id} id={person.id} />
      <Label htmlFor={person.id} className="flex items-center gap-3 cursor-pointer flex-1">
        <PersonThumbnail
          photoUrl={photoUrl || ''}
          bbox={person.thumbnailBbox}
          size="md"
        />
        <div className="flex flex-col">
          <span className="font-medium">{person.name || `Unnamed cluster`}</span>
          <span className="text-sm text-muted-foreground">
            {person.photoCount} photo{person.photoCount !== 1 ? 's' : ''}
          </span>
        </div>
      </Label>
    </div>
  );
});

export default function People() {
  const navigate = useNavigate();
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);

  // TODO: Multi-collection support - currently showing first collection only
  // Should fetch people from all collections and aggregate
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const firstCollectionId = collections?.[0]?.id;

  // Use the refactored useAllPeople hook that handles both named people and clusters
  const { allPeople, isLoading: peopleLoading, refetch: refetchPeople } = useAllPeople(firstCollectionId);

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
    if (clusterIds.length !== 2) {
      toast.error('Please select exactly 2 people to merge');
      return;
    }

    // Default to person with most photos
    const person1 = allPeople.find(p => p.id === clusterIds[0]);
    const person2 = allPeople.find(p => p.id === clusterIds[1]);

    const defaultTarget = (person1 && person2)
      ? (person1.photoCount >= person2.photoCount ? person1.id : person2.id)
      : clusterIds[0];

    setMergeTarget(defaultTarget);
    setShowMergeDialog(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeTarget) return;

    const clusterIds = Array.from(selectedClusters);
    const sourceId = clusterIds.find(id => id !== mergeTarget);

    if (!sourceId) {
      toast.error('Invalid merge selection');
      return;
    }

    try {
      const result = await azureApi.mergePeople(mergeTarget, sourceId);

      toast.success(`Merged ${result.faces_merged} faces into one person`);

      // Refresh people list
      refetchPeople();

      // Exit selection mode and close dialog
      setIsSelectionMode(false);
      setSelectedClusters(new Set());
      setShowMergeDialog(false);
      setMergeTarget(null);
    } catch (error) {
      console.error('Failed to merge people:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to merge people');
    }
  };

  const handleHide = async (clusterIds: string[]) => {
    if (clusterIds.length === 0) return;

    try {
      // Delete each selected person with cascade mode (deletes their face tags)
      const deletePromises = clusterIds.map(personId =>
        azureApi.deletePerson(personId, 'cascade')
      );

      const results = await Promise.all(deletePromises);

      // Sum up affected faces
      const totalFacesAffected = results.reduce((sum, r) => sum + r.faces_affected, 0);

      toast.success(`Deleted ${clusterIds.length} person(s), ${totalFacesAffected} face tags removed`);

      // Refresh people list
      refetchPeople();

      // Exit selection mode
      setIsSelectionMode(false);
      setSelectedClusters(new Set());
    } catch (error) {
      console.error('Failed to delete person(s):', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete person(s)');
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

  const selectedPersonsArray = Array.from(selectedClusters);
  const selectedPersons = allPeople.filter(p => selectedPersonsArray.includes(p.id));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <PeopleGallery
              people={allPeople}
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

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Duplicate People</DialogTitle>
            <DialogDescription>
              Choose which person to keep. All faces from the other person will be reassigned to the selected one.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={mergeTarget || undefined} onValueChange={setMergeTarget}>
            {selectedPersons.map((person) => (
              <MergePersonOption key={person.id} person={person} />
            ))}
          </RadioGroup>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMergeDialog(false);
                setMergeTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmMerge} disabled={!mergeTarget}>
              Merge People
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
