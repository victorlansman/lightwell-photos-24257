import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PendingInvite } from "@/lib/azureApiClient";
import { useCancelInvite } from "@/hooks/useInvites";
import { useToast } from "@/hooks/use-toast";
import { Clock, X } from "lucide-react";

interface PendingInvitesListProps {
  invites: PendingInvite[];
  collectionId: string;
}

export function PendingInvitesList({ invites, collectionId }: PendingInvitesListProps) {
  const { toast } = useToast();
  const cancelInvite = useCancelInvite(collectionId);

  const handleCancel = async (inviteId: string, email: string) => {
    try {
      await cancelInvite.mutateAsync(inviteId);
      toast({
        title: "Invite cancelled",
        description: `Invitation to ${email} has been cancelled`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to cancel invite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    return `Expires in ${diffDays} days`;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-primary text-primary-foreground';
      case 'admin': return 'bg-blue-500 text-white';
      case 'viewer': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invites ({invites.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 border border-dashed rounded-lg"
            >
              <div className="flex-1">
                <p className="font-medium">{invite.email}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{getTimeUntilExpiry(invite.expires_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Role Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(invite.role)}`}>
                  {invite.role}
                </span>

                {/* Cancel Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cancel the invitation to {invite.email}? They will not be able to join using the existing invite link.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Invite</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel(invite.id, invite.email)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancel Invite
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
