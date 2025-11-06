import { X, UserX, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineActionBarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onToggleSelectAll: () => void;
  onRemove?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  personName?: string;
  className?: string;
}

export function InlineActionBar({ 
  selectedCount,
  totalCount,
  onClearSelection, 
  onToggleSelectAll,
  onRemove,
  onShare,
  onDelete,
  personName,
  className
}: InlineActionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-sm font-medium text-foreground px-3 py-2">
        {selectedCount} selected
      </span>

      <div className="h-6 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleSelectAll}
        className="h-9"
      >
        {allSelected ? "Unselect All" : "Select All"}
      </Button>

      <div className="h-6 w-px bg-border" />

      <Button 
        variant="ghost" 
        size="sm"
        onClick={onShare}
        className="h-9 gap-2"
      >
        Share
        <X className="h-4 w-4" />
      </Button>

      {onRemove && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-9 gap-2"
          >
            Not {personName}
          </Button>
        </>
      )}

      <Button 
        variant="ghost" 
        size="sm"
        onClick={onDelete}
        className="h-9 gap-2 text-destructive hover:text-destructive"
      >
        Delete
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
