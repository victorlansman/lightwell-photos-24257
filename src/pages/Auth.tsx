import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, Users } from "lucide-react";
import { useInviteDetails } from "@/hooks/useInvites";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  // Fetch invite details if token present
  const { data: inviteDetails, isLoading: inviteLoading, error: inviteError } =
    useInviteDetails(inviteToken);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // If logged in with invite token, go to acceptance page
        if (inviteToken) {
          navigate(`/invite/${inviteToken}/accept`);
        } else {
          navigate("/");
        }
      }
      setCheckingAuth(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (inviteToken) {
          navigate(`/invite/${inviteToken}/accept`);
        } else {
          navigate("/");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, inviteToken]);

  // Pre-fill email from invite
  useEffect(() => {
    if (inviteDetails && !email) {
      // Don't pre-fill email - let user enter their own
      // (invite might be sent to different email than they use)
    }
  }, [inviteDetails, email]);

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: inviteToken
              ? `${window.location.origin}/invite/${inviteToken}/accept`
              : `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: inviteToken
            ? "Redirecting to collection invite..."
            : "You can now sign in.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth || inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show expired invite error
  if (inviteError || inviteDetails?.is_expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invite Expired</CardTitle>
            <CardDescription>
              This invitation link has expired or is no longer valid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteDetails && (
              <p className="text-sm text-muted-foreground">
                You were invited to <strong>{inviteDetails.collection.name}</strong> by{" "}
                <strong>{inviteDetails.invited_by.email}</strong>.
              </p>
            )}
            <p className="text-sm">
              Please contact the person who invited you to request a new invitation link.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Continue to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Invite Preview */}
        {inviteDetails && (
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">You've Been Invited!</CardTitle>
              </div>
              <CardDescription>
                <strong>{inviteDetails.invited_by.email}</strong> invited you to join{" "}
                <strong>{inviteDetails.collection.name}</strong> as a{" "}
                <strong>{inviteDetails.role}</strong>.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Auth Form */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {inviteDetails ? "Sign In to Accept" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground">
            {inviteDetails
              ? "Create an account or sign in to join the collection"
              : "Sign in to access your photo collections"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <form onSubmit={handlePasswordAuth} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                <>{isSignUp ? "Sign up" : "Sign in"}</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary hover:underline"
              disabled={loading}
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
