import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteToCollection } from "@/hooks/useInvites";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";

interface InviteFormProps {
  collectionId: string;
  embedded?: boolean; // When true, renders without Card wrapper
}

export function InviteForm({ collectionId, embedded = false }: InviteFormProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'owner' | 'admin' | 'viewer'>('viewer');
  const inviteUser = useInviteToCollection(collectionId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await inviteUser.mutateAsync({ email, role });

      if (result.type === 'pending') {
        toast({
          title: "Invitation sent!",
          description: `An invite email has been sent to ${email}`,
        });
      } else {
        toast({
          title: "Member added!",
          description: `${email} has been added to the collection`,
        });
      }

      // Reset form
      setEmail("");
      setRole('viewer');
    } catch (error: any) {
      toast({
        title: "Failed to send invite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email Address
        </label>
        <Input
          id="email"
          type="email"
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={inviteUser.isPending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="role" className="text-sm font-medium">
          Role
        </label>
        <Select
          value={role}
          onValueChange={(value) => setRole(value as any)}
          disabled={inviteUser.isPending}
        >
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer - Can view photos</SelectItem>
            <SelectItem value="admin">Admin - Can manage photos</SelectItem>
            <SelectItem value="owner">Owner - Full control</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={inviteUser.isPending}>
        {inviteUser.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Send Invite
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        If the user has an account, they'll be added immediately. Otherwise, they'll receive an email invitation.
      </p>
    </form>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg">Invite New Member</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
