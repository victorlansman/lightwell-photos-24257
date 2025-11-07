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
import { UserPlus } from "lucide-react";

interface EditPersonDialogProps {
  face: FaceDetection | null;
  isOpen: boolean;
  onClose: () => void;
  allPeople: PersonCluster[];
  onSelectPerson: (personId: string, personName: string | null) => void;
  onCreateNew: () => void;
}

export function EditPersonDialog({
  face,
  isOpen,
  onClose,
  allPeople,
  onSelectPerson,
  onCreateNew,
}: EditPersonDialogProps) {
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

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allPeople.map((person) => (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
