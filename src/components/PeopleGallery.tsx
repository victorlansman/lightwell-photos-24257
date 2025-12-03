import { PersonCluster } from "@/types/person";
import { PersonClusterCard } from "./PersonClusterCard";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Users, Trash2, ChevronDown, Loader2 } from "lucide-react";

interface PeopleGalleryProps {
  namedPeople: PersonCluster[];
  namedPeopleHasMore: boolean;
  onLoadMoreNamed: () => void;
  isLoadingMoreNamed?: boolean;

  clusters: PersonCluster[];
  clustersHasMore: boolean;
  onLoadMoreClusters: () => void;
  isLoadingMoreClusters?: boolean;

  selectedClusters: Set<string>;
  isSelectionMode: boolean;
  onSelectCluster: (id: string) => void;
  onToggleSelectionMode: () => void;
  onMerge: (clusterIds: string[]) => void;
  onHide: (clusterIds: string[]) => void;
}

export function PeopleGallery({
  namedPeople,
  namedPeopleHasMore,
  onLoadMoreNamed,
  isLoadingMoreNamed = false,
  clusters,
  clustersHasMore,
  onLoadMoreClusters,
  isLoadingMoreClusters = false,
  selectedClusters,
  isSelectionMode,
  onSelectCluster,
  onToggleSelectionMode,
  onMerge,
  onHide,
}: PeopleGalleryProps) {
  const navigate = useNavigate();

  // Filter out people with 0 photos
  const visibleNamedPeople = namedPeople.filter(p => p.photoCount > 0);
  // Only show unnamed clusters with more than 1 photo
  const visibleClusters = clusters.filter(p => p.photoCount > 1);

  // Combine for selection operations
  const allPeople = [...visibleNamedPeople, ...visibleClusters];

  const handleMerge = () => {
    if (selectedClusters.size !== 2) {
      toast.error("Select exactly 2 people to merge");
      return;
    }

    const selectedIds = Array.from(selectedClusters);
    const selectedPeople = selectedIds.map(id => allPeople.find(p => p.id === id));
    const bothUnnamed = selectedPeople.every(p => p && p.name === null);

    if (bothUnnamed) {
      toast.error("Cannot merge two unnamed clusters. Name one first, then merge.");
      return;
    }

    onMerge(selectedIds);
  };

  const handleDelete = () => {
    if (selectedClusters.size === 0) {
      toast.error("Select at least 1 person to delete");
      return;
    }
    onHide(Array.from(selectedClusters));
  };

  return (
    <div className="space-y-8">
      {/* Header with Edit button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground mt-1">
            {visibleNamedPeople.length} named{namedPeopleHasMore ? '+' : ''}, {visibleClusters.length} unnamed{clustersHasMore ? '+' : ''}
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
          <Button onClick={handleMerge} disabled={selectedClusters.size !== 2}>
            Merge {selectedClusters.size === 2 ? '(2)' : `(select exactly 2)`}
          </Button>
          <div className="flex-1" />
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selectedClusters.size})
          </Button>
        </div>
      )}

      {/* Named People Section */}
      {(visibleNamedPeople.length > 0 || namedPeopleHasMore) && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Named People</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
            {visibleNamedPeople.map((person) => (
              <PersonClusterCard
                key={person.id}
                cluster={person}
                isSelected={selectedClusters.has(person.id)}
                isSelectionMode={isSelectionMode}
                onSelect={onSelectCluster}
                onClick={() => navigate(`/people/${person.id}`)}
              />
            ))}
          </div>
          {namedPeopleHasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMoreNamed}
                disabled={isLoadingMoreNamed}
              >
                {isLoadingMoreNamed ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Load More Named People
              </Button>
            </div>
          )}
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
          {visibleClusters.map((cluster, index) => (
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
        {clustersHasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={onLoadMoreClusters}
              disabled={isLoadingMoreClusters}
            >
              {isLoadingMoreClusters ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Load More Unnamed People
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
