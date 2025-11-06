import { PersonCluster } from "@/types/person";
import { PersonClusterCard } from "./PersonClusterCard";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
    <div className="space-y-6">
      {/* Header with Edit button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground mt-1">
            {people.length} {people.length === 1 ? "person" : "people"}
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

      {/* Gallery grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
        {people.map((cluster) => (
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
  );
}
