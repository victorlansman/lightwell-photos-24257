import { X, UserX, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  onRemove?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  personName?: string;
}

export function ActionBar({ 
  selectedCount, 
  onClearSelection, 
  onSelectAll,
  onRemove,
  onShare,
  onDelete,
  personName
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-elevation-3 px-4 py-3 flex items-center gap-3 transition-all duration-300 z-50 flex-wrap max-w-[calc(100vw-2rem)]",
        selectedCount > 0
          ? "translate-y-0 opacity-100"
          : "translate-y-16 opacity-0 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-2">
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 gap-2"
          >
            <UserX className="h-4 w-4" />
            <span className="hidden sm:inline">
              Not {personName}
            </span>
          </Button>
        )}
        {onSelectAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            className="h-8"
          >
            Select All
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1">
        {onShare && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onShare}
            className="h-8 gap-2"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              Share {selectedCount}
            </span>
          </Button>
        )}
        {onDelete && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onDelete}
            className="h-8 gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              Delete {selectedCount}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
