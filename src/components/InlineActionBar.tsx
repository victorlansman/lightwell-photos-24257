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
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="h-9 gap-2"
      >
        <X className="h-4 w-4" />
        <span>{selectedCount} Selected</span>
      </Button>

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
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Share {selectedCount}</span>
        <span className="sm:hidden">{selectedCount}</span>
      </Button>

      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-9 gap-2"
        >
          <UserX className="h-4 w-4" />
          <span className="hidden sm:inline">Not {personName}</span>
          <span className="sm:hidden">Not {personName}</span>
        </Button>
      )}

      <Button 
        variant="ghost" 
        size="sm"
        onClick={onDelete}
        className="h-9 gap-2 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden sm:inline">Delete {selectedCount}</span>
        <span className="sm:hidden">{selectedCount}</span>
      </Button>
    </div>
  );
}
