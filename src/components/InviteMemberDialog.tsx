import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  collectionId,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "viewer">("viewer");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get inviter's internal ID
      const { data: inviterData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!inviterData) throw new Error("User profile not found");

      // Check if user already exists
      let invitedUserId: string;
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        invitedUserId = existingUser.id;
      } else {
        // Create Supabase auth user and send magic link
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${window.location.origin}/collections/${collectionId}`,
        });

        if (authError) {
          // If admin API not available, use signInWithOtp to send magic link
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/collections/${collectionId}`,
            },
          });

          if (otpError) throw otpError;

          // Create user profile manually (will be completed on first login)
          const { data: newUser, error: userError } = await supabase
            .from("users")
            .insert({
              email,
              display_name: email.split("@")[0],
            })
            .select()
            .single();

          if (userError) throw userError;
          invitedUserId = newUser.id;
        } else {
          // User created via admin API
          const { data: newUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single();
          
          invitedUserId = newUser?.id || "";
        }
      }

      // Add to collection members
      const { error: memberError } = await supabase
        .from("collection_members")
        .insert({
          collection_id: collectionId,
          user_id: invitedUserId,
          role,
          invited_by: inviterData.id,
        });

      if (memberError) throw memberError;

      toast({
        title: "Invitation sent",
        description: `${email} has been invited as ${role}.`,
      });

      setEmail("");
      setRole("viewer");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error sending invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join this collection
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner - Full control</SelectItem>
                <SelectItem value="admin">Admin - Can upload & edit</SelectItem>
                <SelectItem value="viewer">Viewer - Can only view</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "owner" && "Can invite members and delete collection"}
              {role === "admin" && "Can upload, edit, and tag photos"}
              {role === "viewer" && "Can view photos and add favorites"}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
