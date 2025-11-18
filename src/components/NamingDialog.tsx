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
    if (name.trim()) {
      const filtered = allPeople.filter(
        (person) =>
          person.id !== currentPerson.id &&
          person.name &&
          person.name.toLowerCase().includes(name.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
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
                <Label>Results</Label>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-2 space-y-1">
                    {suggestions.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => handleSuggestionClick(person)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <img
                          src={person.thumbnailPath}
                          alt={person.name || ""}
                          className="w-12 h-12 rounded-full object-cover"
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
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={currentPerson.thumbnailPath}
                      alt={currentPerson.name || "Unlabeled"}
                      className="w-20 h-20 rounded-2xl object-cover"
                    />
                    <span className="text-sm font-medium">
                      {currentPerson.name || "Unlabeled"}
                    </span>
                  </div>
                  <div className="flex items-center text-2xl text-muted-foreground">
                    +
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={selectedMergeTarget?.thumbnailPath}
                      alt={selectedMergeTarget?.name || ""}
                      className="w-20 h-20 rounded-2xl object-cover"
                    />
                    <span className="text-sm font-medium">
                      {selectedMergeTarget?.name}
                    </span>
                  </div>
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
