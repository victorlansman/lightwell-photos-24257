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
import { UserPlus, Search } from "lucide-react";
import { useState, useMemo } from "react";

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

  // Filter to only show named people, sort by photo count (descending) and filter by search query
  const filteredAndSortedPeople = useMemo(() => {
    return allPeople
      .filter(person => person.name !== null) // Only show named people
      .filter(person => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return person.name?.toLowerCase().includes(query);
      })
      .sort((a, b) => b.photoCount - a.photoCount);
  }, [allPeople, searchQuery]);

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
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAndSortedPeople.map((person) => (
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
                    {person.photoCount} photos
                  </p>
                </div>
              </Button>
            ))}
          </div>

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
