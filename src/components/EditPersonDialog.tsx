import { FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { UserPlus, Search, Plus } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface EditPersonDialogProps {
  face: FaceDetection | null;
  isOpen: boolean;
  onClose: () => void;
  allPeople: PersonCluster[];
  onSelectPerson: (personId: string, personName: string | null) => void;
  onCreateNew: () => void;
  onDisassociate?: () => void;
}

export function EditPersonDialog({
  face,
  isOpen,
  onClose,
  allPeople,
  onSelectPerson,
  onCreateNew,
  onDisassociate,
}: EditPersonDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Reset search state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setShowAll(false);
    }
  }, [isOpen]);

  // Filter and sort people based on search, showAll state with smart suggestions
  const { displayedPeople, suggestions, hasMore, canAddNew } = useMemo(() => {
    const namedPeople = allPeople.filter(person => person.name !== null);
    const query = searchQuery.trim().toLowerCase();
    
    // Filter by search query
    let filtered = namedPeople.filter(person => {
      if (!query) return true;
      return person.name?.toLowerCase().includes(query);
    });

    // Determine if we can add a new person (search doesn't match any existing person)
    const canAddNew = query.length > 0 && !namedPeople.some(p => p.name?.toLowerCase() === query);

    // If searching, separate exact matches and partial matches as suggestions
    if (query.length > 0) {
      // Sort matches: exact first, then by photo count
      filtered.sort((a, b) => {
        const aExact = a.name?.toLowerCase() === query;
        const bExact = b.name?.toLowerCase() === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return b.photoCount - a.photoCount;
      });

      return {
        displayedPeople: filtered,
        suggestions: filtered.slice(0, 3), // Show top 3 as prominent suggestions
        hasMore: false,
        canAddNew
      };
    }

    // Without search: show only people with > 0 photos initially
    const peopleWithPhotos = filtered.filter(p => p.photoCount > 0);
    peopleWithPhotos.sort((a, b) => b.photoCount - a.photoCount);
    
    if (showAll) {
      return {
        displayedPeople: peopleWithPhotos,
        suggestions: [],
        hasMore: false,
        canAddNew
      };
    }

    // Show only first 6 people with photos
    const hasMore = peopleWithPhotos.length > 6;
    return {
      displayedPeople: peopleWithPhotos.slice(0, 6),
      suggestions: [],
      hasMore,
      canAddNew
    };
  }, [allPeople, searchQuery, showAll]);

  if (!face) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Person</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a person to reassign this face to:
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Suggestions
              </p>
              {suggestions.map((person) => (
                <Button
                  key={person.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 hover:bg-muted"
                  onClick={() => {
                    onSelectPerson(person.id, person.name);
                    onClose();
                  }}
                >
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage src={person.thumbnailPath} />
                    <AvatarFallback>
                      {person.name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium">{person.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.photoCount} {person.photoCount === 1 ? "photo" : "photos"}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {displayedPeople.length > suggestions.length && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {suggestions.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
                  All People
                </p>
              )}
              {displayedPeople.slice(suggestions.length).map((person) => (
                <Button
                  key={person.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => {
                    onSelectPerson(person.id, person.name);
                    onClose();
                  }}
                >
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage src={person.thumbnailPath} />
                    <AvatarFallback>
                      {person.name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium">{person.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.photoCount} {person.photoCount === 1 ? "photo" : "photos"}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {hasMore && !showAll && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAll(true)}
            >
              Show all
            </Button>
          )}

          {canAddNew && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Trigger person creation with pre-filled name
                // Don't generate UUID here - backend is ID authority
                onCreateNew();
                onClose();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add "{searchQuery.trim()}"
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onCreateNew();
              onClose();
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create New Person
          </Button>

          {face?.personName && onDisassociate && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                onDisassociate();
                onClose();
              }}
            >
              This is not {face.personName}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
