import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useInviteDetails, useAcceptInvite } from "@/hooks/useInvites";
import { Loader2, Users, CheckCircle } from "lucide-react";

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: invite, isLoading, error } = useInviteDetails(token || null);
  const acceptInvite = useAcceptInvite();

  // Redirect to auth if not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate(`/auth?invite=${token}`);
      }
    });
  }, [navigate, token]);

  const handleAccept = async () => {
    if (!token) return;

    try {
      const result = await acceptInvite.mutateAsync(token);
      toast({
        title: "Successfully joined collection!",
        description: `You are now a member of ${result.collection.name}`,
      });
      navigate("/");
    } catch (error: any) {
      // Handle specific error cases
      if (error.message.includes("already") || error.message.includes("409")) {
        toast({
          title: "Already a member",
          description: "You're already a member of this collection",
        });
        navigate("/");
      } else if (error.message.includes("expired") || error.message.includes("410")) {
        toast({
          title: "Invite expired",
          description: "This invitation has expired. Please request a new one.",
          variant: "destructive",
        });
      } else if (error.message.includes("email") || error.message.includes("403")) {
        toast({
          title: "Email mismatch",
          description: "This invite was sent to a different email address",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to accept invite",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleDecline = () => {
    toast({
      title: "Invitation declined",
      description: "You have declined the invitation",
    });
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has been cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.is_expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired and is no longer valid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You were invited to <strong>{invite.collection.name}</strong> by{" "}
              <strong>{invite.invited_by.email}</strong>.
            </p>
            <p className="text-sm">
              Please contact them to request a new invitation.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle>Collection Invitation</CardTitle>
          </div>
          <CardDescription>
            <strong>{invite.invited_by.email}</strong> has invited you to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Collection Info */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-lg mb-1">{invite.collection.name}</h3>
            <p className="text-sm text-muted-foreground">
              Your role: <strong className="text-foreground">{invite.role}</strong>
            </p>
          </div>

          {/* Terms */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Terms & Conditions</h4>
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p>{invite.terms_text}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleDecline}
              variant="outline"
              className="flex-1"
              disabled={acceptInvite.isPending}
            >
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-1"
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept & Join
                </>
              )}
            </Button>
          </div>

          {/* Expires info */}
          <p className="text-xs text-muted-foreground text-center">
            This invitation expires on {new Date(invite.expires_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
