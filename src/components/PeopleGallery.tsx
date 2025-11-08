import { PersonCluster } from "@/types/person";
import { PersonClusterCard } from "./PersonClusterCard";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";

interface PeopleGalleryProps {
  people: PersonCluster[];
  selectedClusters: Set<string>;
  isSelectionMode: boolean;
  onSelectCluster: (id: string) => void;
  onToggleSelectionMode: () => void;
  onMerge: (clusterIds: string[]) => void;
  onHide: (clusterIds: string[]) => void;
}

export function PeopleGallery({
  people,
  selectedClusters,
  isSelectionMode,
  onSelectCluster,
  onToggleSelectionMode,
  onMerge,
  onHide,
}: PeopleGalleryProps) {
  const navigate = useNavigate();
  
  // Separate named and unknown people
  const namedPeople = people.filter(p => p.name !== null);
  // Only show unnamed people with more than 1 photo (clusters)
  const unknownPeople = people.filter(p => p.name === null && p.photoCount > 1);
  
  const handleMerge = () => {
    if (selectedClusters.size < 2) {
      toast.error("Select at least 2 clusters to merge");
      return;
    }
    onMerge(Array.from(selectedClusters));
    toast.success(`Merged ${selectedClusters.size} clusters`);
  };

  const handleHide = () => {
    if (selectedClusters.size === 0) {
      toast.error("Select at least 1 cluster to hide");
      return;
    }
    onHide(Array.from(selectedClusters));
    toast.success(`Hidden ${selectedClusters.size} cluster(s)`);
  };

  return (
    <div className="space-y-8">
      {/* Header with Edit button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground mt-1">
            {namedPeople.length} named, {unknownPeople.length} unnamed
          </p>
        </div>
        <Button
          variant={isSelectionMode ? "default" : "outline"}
          onClick={onToggleSelectionMode}
        >
          {isSelectionMode ? "Done" : "Select"}
        </Button>
      </div>

      {/* Selection actions */}
      {isSelectionMode && selectedClusters.size > 0 && (
        <div className="flex gap-2 p-4 bg-muted rounded-lg animate-fade-in">
          <Button onClick={handleMerge} disabled={selectedClusters.size < 2}>
            Merge ({selectedClusters.size})
          </Button>
          <Button variant="outline" onClick={handleHide}>
            Hide ({selectedClusters.size})
          </Button>
        </div>
      )}

      {/* Named People Section */}
      {namedPeople.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Named People</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
            {namedPeople.map((cluster) => (
              <PersonClusterCard
                key={cluster.id}
                cluster={cluster}
                isSelected={selectedClusters.has(cluster.id)}
                isSelectionMode={isSelectionMode}
                onSelect={onSelectCluster}
                onClick={() => navigate(`/people/${cluster.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unnamed People Section */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold text-foreground">Unnamed People</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
          {/* Browse all photos cluster */}
          <div
            className="flex flex-col items-center gap-2 cursor-pointer group"
            onClick={() => navigate('/unknown')}
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-dashed border-primary/40 flex items-center justify-center transition-all duration-200 group-hover:shadow-elevation-hover group-hover:scale-[1.02]">
                <Users className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">Browse All Photos</div>
              <div className="text-sm text-muted-foreground">
                All untagged faces
              </div>
            </div>
          </div>

          {/* Unnamed person clusters */}
          {unknownPeople.map((cluster, index) => (
            <PersonClusterCard
              key={cluster.id}
              cluster={cluster}
              isSelected={selectedClusters.has(cluster.id)}
              isSelectionMode={isSelectionMode}
              onSelect={onSelectCluster}
              onClick={() => navigate(`/people/${cluster.id}`)}
              unnamedIndex={index + 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
