import { PersonCluster } from "@/types/person";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PersonClusterCardProps {
  cluster: PersonCluster;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (id: string) => void;
  onClick: () => void;
}

export function PersonClusterCard({
  cluster,
  isSelected,
  isSelectionMode,
  onSelect,
  onClick,
}: PersonClusterCardProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer group"
      onClick={() => {
        if (isSelectionMode) {
          onSelect(cluster.id);
        } else {
          onClick();
        }
      }}
    >
      <div className="relative">
        <img
          src={cluster.thumbnailPath}
          alt={cluster.name || "Unlabeled person"}
          className={cn(
            "w-32 h-32 rounded-3xl object-cover transition-all duration-200",
            isSelected && "ring-4 ring-primary",
            "group-hover:shadow-elevation-hover group-hover:scale-[1.02]"
          )}
        />
        
        {/* Selection indicator */}
        {isSelectionMode && (
          <div
            className={cn(
              "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200",
              isSelected
                ? "bg-primary border-primary"
                : "bg-card/80 border-card backdrop-blur-sm"
            )}
          >
            {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <div className="font-medium text-foreground">
          {cluster.name || "Name?"}
        </div>
        {cluster.name && (
          <div className="text-sm text-muted-foreground">
            {cluster.photoCount} {cluster.photoCount === 1 ? "photo" : "photos"}
          </div>
        )}
      </div>
    </div>
  );
}
