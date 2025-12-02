import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonCluster } from "@/types/person";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PersonThumbnail } from "./PersonThumbnail";

interface NamingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPerson: PersonCluster;
  allPeople: PersonCluster[];
  onNameSave: (name: string, existingPersonId?: string) => void;
  onMerge: (targetPerson: PersonCluster) => void;
}

export function NamingDialog({
  isOpen,
  onClose,
  currentPerson,
  allPeople,
  onNameSave,
  onMerge,
}: NamingDialogProps) {
  const [name, setName] = useState(currentPerson.name || "");
  const [suggestions, setSuggestions] = useState<PersonCluster[]>([]);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<PersonCluster | null>(null);

  useEffect(() => {
    // Filter people - exclude current person and show only named people
    const namedPeople = allPeople.filter(
      (person) => person.id !== currentPerson.id && person.name
    );

    if (name.trim()) {
      // Filter by search term if user is typing
      const filtered = namedPeople.filter((person) =>
        person.name!.toLowerCase().includes(name.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      // Show all named people when search is empty
      setSuggestions(namedPeople);
    }
  }, [name, allPeople, currentPerson.id]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const exactMatch = allPeople.find(
      (p) => p.id !== currentPerson.id && p.name?.toLowerCase() === name.toLowerCase()
    );

    if (exactMatch) {
      setSelectedMergeTarget(exactMatch);
    } else {
      onNameSave(name.trim());
      onClose();
      setName("");
    }
  };

  const handleMergeConfirm = () => {
    if (selectedMergeTarget) {
      // Pass the existing person's ID to label the cluster with that person
      onNameSave(selectedMergeTarget.name || "", selectedMergeTarget.id);
      onClose();
      setName("");
      setSelectedMergeTarget(null);
    }
  };

  const handleMergeCancel = () => {
    setSelectedMergeTarget(null);
  };

  const handleSuggestionClick = (person: PersonCluster) => {
    setSelectedMergeTarget(person);
  };

  return (
    <>
      <Dialog open={isOpen && !selectedMergeTarget} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentPerson.name ? "Rename This Person" : "Name This Person"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Add Name</Label>
              <Input
                id="name"
                placeholder="Type a name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
                autoFocus
              />
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <Label>{name.trim() ? "Results" : "Or select an existing person"}</Label>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-2 space-y-1">
                    {suggestions.map((person) => (
                      <PersonSuggestionButton
                        key={person.id}
                        person={person}
                        onClick={() => handleSuggestionClick(person)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              {currentPerson.name ? "Rename" : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!selectedMergeTarget} onOpenChange={handleMergeCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge All Photos of These 2 People?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <p>
                  This will combine all photos from both clusters into one.
                </p>
                <div className="flex gap-4 justify-center">
                  <MergeThumbnail person={currentPerson} />
                  <div className="flex items-center text-2xl text-muted-foreground">
                    +
                  </div>
                  {selectedMergeTarget && <MergeThumbnail person={selectedMergeTarget} />}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMergeCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergeConfirm}>
              Merge Photos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper component for person suggestion with thumbnail loading
function PersonSuggestionButton({ person, onClick }: { person: PersonCluster; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
    >
      <PersonThumbnail
        faceId={person.representativeFaceId}
        size="sm"
        className="!w-12 !h-12"
      />
      <div>
        <div className="font-medium text-foreground">
          {person.name}
        </div>
        <div className="text-sm text-muted-foreground">
          {person.photoCount}{" "}
          {person.photoCount === 1 ? "photo" : "photos"}
        </div>
      </div>
    </button>
  );
}

// Helper component for merge dialog thumbnails
function MergeThumbnail({ person }: { person: PersonCluster }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <PersonThumbnail
        faceId={person.representativeFaceId}
        size="lg"
        className="!w-20 !h-20 !rounded-2xl"
      />
      <span className="text-sm font-medium">
        {person.name || "Unlabeled"}
      </span>
    </div>
  );
}
