# Invite System Frontend Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate backend invite system into frontend - allow owners to invite users, users to accept invites via email link, and manage collection members.

**Architecture:** Three-page flow: (1) Auth page detects invite token and preserves through signup, (2) Dedicated invite acceptance page shows terms and confirms, (3) Settings page for owners to manage members and send invites. Backend APIs handle validation, email sending, and membership creation.

**Tech Stack:** React, TypeScript, React Query, React Router, Supabase Auth, Azure API Client

---

## Phase 0: Cleanup Legacy Code

### Task 0: Remove Old Invite Component

**Files:**
- Delete: `src/components/InviteMemberDialog.tsx`

**Step 1: Delete legacy component**

This component uses old Supabase-direct architecture and is incompatible with new Azure backend invite system.

Run: `git rm src/components/InviteMemberDialog.tsx`

**Step 2: Commit**

```bash
git commit -m "chore: remove legacy InviteMemberDialog (replaced by new invite system)"
```

---

## Phase 1: API Client Foundation

### Task 1: Add TypeScript Interfaces

**Files:**
- Modify: `src/lib/azureApiClient.ts:26-34` (after Collection interface)

**Step 1: Add invite-related type definitions**

Add these interfaces after the `Collection` interface (around line 34):

```typescript
export interface InviteDetails {
  id: string;
  collection: {
    id: string;
    name: string;
  };
  invited_by: {
    id: string;
    email: string;
    name?: string;
  };
  role: 'owner' | 'admin' | 'viewer';
  terms_text: string;
  expires_at: string;
  is_expired: boolean;
}

export interface AcceptInviteResponse {
  message: string;
  collection: Collection;
}

export interface Member {
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  invited_by: string | null;
  joined_at: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  invited_by: string;
  expires_at: string;
}

export interface InviteRequest {
  email: string;
  role: 'owner' | 'admin' | 'viewer';
}

export interface InviteResponse {
  type?: 'pending';
  id?: string;
  user_id?: string;
  email: string;
  role: string;
  invited_by: string;
  joined_at?: string;
  expires_at?: string;
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add invite system TypeScript interfaces"
```

---

### Task 2: Add API Client Methods

**Files:**
- Modify: `src/lib/azureApiClient.ts:735` (before healthCheck method)

**Step 1: Add invite-related API methods**

Add these methods in the AzureApiClient class before the `healthCheck` method:

```typescript
  // ==================== Invite System ====================

  /**
   * Get invite details (no auth required).
   * Used to preview invite before user signs in.
   */
  async getInviteDetails(token: string): Promise<InviteDetails> {
    return this.request(`/v1/collections/invite/${token}/details`);
  }

  /**
   * Accept an invite (requires auth).
   * Creates collection membership for authenticated user.
   */
  async acceptInvite(token: string): Promise<AcceptInviteResponse> {
    return this.request(`/v1/collections/accept-invite/${token}`, {
      method: 'POST',
    });
  }

  /**
   * Get collection members (requires membership).
   */
  async getCollectionMembers(collectionId: string): Promise<Member[]> {
    const response = await this.request<{ members: Member[] }>(
      `/v1/collections/${collectionId}/members`
    );
    return response.members;
  }

  /**
   * Get pending invites for a collection (owners only).
   */
  async getPendingInvites(collectionId: string): Promise<PendingInvite[]> {
    const response = await this.request<{ invites: PendingInvite[] }>(
      `/v1/collections/${collectionId}/invites`
    );
    return response.invites;
  }

  /**
   * Invite a user to a collection (owners only).
   * Returns immediate member if user exists, or pending invite if not.
   */
  async inviteToCollection(
    collectionId: string,
    request: InviteRequest
  ): Promise<InviteResponse> {
    return this.request(`/v1/collections/${collectionId}/invite`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Remove a member from a collection (owners only).
   */
  async removeMember(collectionId: string, userId: string): Promise<void> {
    return this.request(`/v1/collections/${collectionId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Cancel a pending invite (owners only).
   */
  async cancelInvite(collectionId: string, inviteId: string): Promise<void> {
    return this.request(`/v1/collections/${collectionId}/invites/${inviteId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Change a member's role (owners only).
   */
  async changeMemberRole(
    collectionId: string,
    userId: string,
    role: 'owner' | 'admin' | 'viewer'
  ): Promise<Member> {
    return this.request(`/v1/collections/${collectionId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/azureApiClient.ts
git commit -m "feat: add invite system API client methods"
```

---

## Phase 2: Auth Flow Integration

### Task 3: Create React Query Hooks

**Files:**
- Create: `src/hooks/useInvites.ts`

**Step 1: Create invite hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { azureApi, InviteRequest } from '@/lib/azureApiClient';

/**
 * Fetch invite details (no auth required).
 * Used on auth page to show invite preview.
 */
export function useInviteDetails(token: string | null) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => azureApi.getInviteDetails(token!),
    enabled: !!token,
    retry: false, // Don't retry on 404/410 errors
  });
}

/**
 * Accept an invite (requires auth).
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => azureApi.acceptInvite(token),
    onSuccess: () => {
      // Invalidate collections to show new collection
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

/**
 * Fetch collection members.
 */
export function useCollectionMembers(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId, 'members'],
    queryFn: () => azureApi.getCollectionMembers(collectionId!),
    enabled: !!collectionId,
  });
}

/**
 * Fetch pending invites (owners only).
 */
export function usePendingInvites(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collections', collectionId, 'invites'],
    queryFn: () => azureApi.getPendingInvites(collectionId!),
    enabled: !!collectionId,
  });
}

/**
 * Invite a user to collection (owners only).
 */
export function useInviteToCollection(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: InviteRequest) =>
      azureApi.inviteToCollection(collectionId, request),
    onSuccess: () => {
      // Refresh members and invites lists
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'members']
      });
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'invites']
      });
    },
  });
}

/**
 * Remove a member from collection (owners only).
 */
export function useRemoveMember(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      azureApi.removeMember(collectionId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'members']
      });
    },
  });
}

/**
 * Cancel a pending invite (owners only).
 */
export function useCancelInvite(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) =>
      azureApi.cancelInvite(collectionId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'invites']
      });
    },
  });
}

/**
 * Change member role (owners only).
 */
export function useChangeMemberRole(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'owner' | 'admin' | 'viewer' }) =>
      azureApi.changeMemberRole(collectionId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collections', collectionId, 'members']
      });
    },
  });
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useInvites.ts
git commit -m "feat: add React Query hooks for invite system"
```

---

### Task 4: Modify Auth Page for Invite Detection

**Files:**
- Modify: `src/pages/Auth.tsx`

**Step 1: Add invite token detection and preview**

Replace the entire Auth.tsx with this implementation:

```typescript
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
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Test in browser**

1. Run: `npm run dev`
2. Visit: `http://localhost:5173/auth`
3. Expected: Normal auth page loads
4. Visit: `http://localhost:5173/auth?invite=test-token`
5. Expected: Shows "Invite Expired" (since test token is invalid)

**Step 4: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "feat: add invite token detection and preview to Auth page"
```

---

### Task 5: Create Invite Accept Page

**Files:**
- Create: `src/pages/InviteAccept.tsx`

**Step 1: Create invite acceptance page**

```typescript
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
```

**Step 2: Add route to App.tsx**

Modify `src/App.tsx` to add the new route:

```typescript
// Add import at top
import InviteAccept from "./pages/InviteAccept";

// Add route before the "*" catch-all route (around line 38)
<Route path="/invite/:token/accept" element={<InviteAccept />} />
```

**Step 3: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Test in browser**

1. Run: `npm run dev`
2. Visit: `http://localhost:5173/invite/test-token/accept`
3. Expected: Redirects to auth page (not logged in)
4. Sign in, then revisit invite accept page
5. Expected: Shows "Invalid Invitation" (test token doesn't exist)

**Step 5: Commit**

```bash
git add src/pages/InviteAccept.tsx src/App.tsx
git commit -m "feat: add invite acceptance page with terms display"
```

---

## Phase 3: Settings Page Integration

### Task 6: Create Members List Component

**Files:**
- Create: `src/components/MembersList.tsx`

**Step 1: Create members list component**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Member } from "@/lib/azureApiClient";
import { useRemoveMember, useChangeMemberRole } from "@/hooks/useInvites";
import { useToast } from "@/hooks/use-toast";
import { UserMinus, Shield } from "lucide-react";
import { useState } from "react";

interface MembersListProps {
  members: Member[];
  collectionId: string;
  currentUserRole: 'owner' | 'admin' | 'viewer';
  currentUserId?: string;
}

export function MembersList({ members, collectionId, currentUserRole, currentUserId }: MembersListProps) {
  const { toast } = useToast();
  const removeMember = useRemoveMember(collectionId);
  const changeMemberRole = useChangeMemberRole(collectionId);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';

  const handleRemove = async (userId: string, email: string) => {
    try {
      await removeMember.mutateAsync(userId);
      toast({
        title: "Member removed",
        description: `${email} has been removed from the collection`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'admin' | 'viewer', email: string) => {
    setChangingRole(userId);
    try {
      await changeMemberRole.mutateAsync({ userId, role: newRole });
      toast({
        title: "Role updated",
        description: `${email}'s role changed to ${newRole}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingRole(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-primary text-primary-foreground';
      case 'admin': return 'bg-blue-500 text-white';
      case 'viewer': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const isOtherOwner = member.role === 'owner' && !isCurrentUser;
            const canModify = isOwner && !isOtherOwner;

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{member.email}</p>
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role Badge/Selector */}
                  {canModify ? (
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        handleRoleChange(member.user_id, role as any, member.email)
                      }
                      disabled={changingRole === member.user_id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                  )}

                  {/* Remove Button */}
                  {canModify && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove {member.email} from this collection? They will lose access to all photos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(member.user_id, member.email)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/MembersList.tsx
git commit -m "feat: add members list component with role management"
```

---

### Task 7: Create Pending Invites Component

**Files:**
- Create: `src/components/PendingInvitesList.tsx`

**Step 1: Create pending invites component**

```typescript
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
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PendingInvitesList.tsx
git commit -m "feat: add pending invites list component"
```

---

### Task 8: Create Invite Form Component

**Files:**
- Create: `src/components/InviteForm.tsx`

**Step 1: Create invite form component**

```typescript
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
}

export function InviteForm({ collectionId }: InviteFormProps) {
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

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg">Invite New Member</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/InviteForm.tsx
git commit -m "feat: add invite form component"
```

---

### Task 9: Integrate Components into Settings Page

**Files:**
- Modify: `src/pages/Settings.tsx`

**Step 1: Replace Settings.tsx with integrated version**

Replace entire file with this implementation:

```typescript
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionMembers, usePendingInvites } from "@/hooks/useInvites";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { MembersList } from "@/components/MembersList";
import { PendingInvitesList } from "@/components/PendingInvitesList";
import { InviteForm } from "@/components/InviteForm";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  // Get tab from URL params (default to members)
  const activeTab = searchParams.get("tab") || "members";

  // Get all user collections
  const { data: collections, isLoading: collectionsLoading } = useCollections();

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id);
    });
  }, []);

  // Set initial collection when collections load
  useEffect(() => {
    if (collections && collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const selectedCollection = collections?.find(c => c.id === selectedCollectionId);
  const isOwner = selectedCollection?.user_role === 'owner';

  // Fetch members and invites for selected collection
  const { data: members, isLoading: membersLoading } = useCollectionMembers(selectedCollectionId);
  const { data: invites, isLoading: invitesLoading } = usePendingInvites(
    isOwner ? selectedCollectionId : undefined
  );

  if (collectionsLoading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-3xl font-bold">Settings</h1>
              </div>

              <Tabs value={activeTab} onValueChange={(tab) => navigate(`/settings?tab=${tab}`)} className="w-full">
                <TabsList>
                  <TabsTrigger value="members">Collection Members</TabsTrigger>
                  <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>

                {/* Collection Members Tab */}
                <TabsContent value="members" className="space-y-4">
                  {/* Collection Selector */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Select Collection</CardTitle>
                      <CardDescription>
                        {isOwner
                          ? 'Manage members and invitations for your collection'
                          : 'View members of this collection'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select
                        value={selectedCollectionId}
                        onValueChange={setSelectedCollectionId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a collection" />
                        </SelectTrigger>
                        <SelectContent>
                          {collections?.map((collection) => (
                            <SelectItem key={collection.id} value={collection.id}>
                              {collection.name} ({collection.user_role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Members List */}
                  {membersLoading ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Loading members...
                      </CardContent>
                    </Card>
                  ) : members && members.length > 0 ? (
                    <MembersList
                      members={members}
                      collectionId={selectedCollectionId}
                      currentUserRole={selectedCollection?.user_role || 'viewer'}
                      currentUserId={currentUserId}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No members found
                      </CardContent>
                    </Card>
                  )}

                  {/* Pending Invites (Owners Only) */}
                  {isOwner && invites && invites.length > 0 && (
                    <PendingInvitesList
                      invites={invites}
                      collectionId={selectedCollectionId}
                    />
                  )}

                  {/* Invite Form */}
                  {isOwner ? (
                    <InviteForm collectionId={selectedCollectionId} />
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-8">
                        <p className="text-sm text-muted-foreground text-center">
                          Only collection owners can invite new members.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Account Tab */}
                <TabsContent value="account" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Account Settings</CardTitle>
                      <CardDescription>Manage your account preferences</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Account management features coming soon.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Test in browser**

1. Run: `npm run dev`
2. Navigate to Settings page
3. Expected: See collection selector, members list, and invite form (if owner)

**Step 4: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: integrate invite components into Settings page"
```

---

## Phase 4: Testing & Polish

### Task 10: End-to-End User Testing

**Manual Testing Checklist:**

**Step 1: Test invite flow as owner**

1. Sign in as collection owner
2. Go to Settings → Collection Members
3. Fill in invite form with test email
4. Submit invite
5. Expected: Success toast, email sent (check backend logs)

**Step 2: Test invite acceptance (happy path)**

1. Copy invite link from email or backend logs
2. Open in incognito/private browser
3. Click link → redirects to `/auth?invite={token}`
4. Expected: Shows invite preview card with collection name
5. Sign up with new account
6. Expected: Redirects to `/invite/{token}/accept`
7. Review terms and click "Accept & Join"
8. Expected: Success toast, redirects to home page, new collection visible

**Step 3: Test expired invite**

1. Manually expire an invite in database (or wait 7 days)
2. Click expired invite link
3. Expected: Shows "Invite Expired" page with contact info

**Step 4: Test already member scenario**

1. Accept an invite
2. Try to accept the same invite again
3. Expected: Shows "Already a member" toast, redirects to home

**Step 5: Test role-based UI**

1. Sign in as viewer
2. Go to Settings
3. Expected: Cannot see invite form or pending invites
4. Expected: See read-only message

**Step 6: Test member management (owners)**

1. Sign in as owner
2. View members list
3. Change member role
4. Expected: Role updates, success toast
5. Remove member
6. Expected: Member removed, success toast
7. Cancel pending invite
8. Expected: Invite cancelled, success toast

**Step 7: Commit test results**

Document any issues found and create GitHub issues if needed.

```bash
git add docs/
git commit -m "docs: add manual testing results for invite system"
```

---

### Task 11: Error Handling Polish

**Files:**
- Modify: `src/pages/InviteAccept.tsx`
- Modify: `src/pages/Auth.tsx`

**Step 1: Add better error messages**

Review error handling in both files and ensure:
- 404 errors show "Invite not found"
- 409 errors show "Already a member"
- 410 errors show "Invite expired"
- 403 errors show "Email mismatch"
- Network errors show "Connection failed"

**Step 2: Add loading states**

Ensure all async operations show loading indicators:
- Buttons show spinner when loading
- Pages show loading skeleton while fetching
- Disabled state prevents double-submissions

**Step 3: Test all error paths**

1. Invalid token → 404
2. Expired token → 410
3. Already member → 409
4. Wrong email → 403
5. Network offline → Connection error

**Step 4: Commit**

```bash
git add src/pages/InviteAccept.tsx src/pages/Auth.tsx
git commit -m "polish: improve error handling and loading states"
```

---

### Task 12: Accessibility Audit

**Files:**
- Review all new components

**Step 1: Keyboard navigation**

Test with Tab key:
- All interactive elements reachable
- Focus visible
- Logical tab order

**Step 2: Screen reader testing**

- Form labels properly associated
- Buttons have descriptive text
- Alerts announced properly

**Step 3: Color contrast**

- All text meets WCAG AA standards
- Error states clearly visible
- Focus indicators visible

**Step 4: ARIA attributes**

- Dialogs have proper roles
- Loading states announced
- Error messages associated with inputs

**Step 5: Commit accessibility fixes**

```bash
git add src/components/MembersList.tsx src/components/PendingInvitesList.tsx src/components/InviteForm.tsx src/pages/
git commit -m "a11y: improve accessibility of invite system"
```

---

### Task 13: Documentation

**Files:**
- Create: `docs/features/invite-system.md`

**Step 1: Create feature documentation**

```markdown
# Invite System

## Overview

The invite system allows collection owners to invite users via email. Invited users receive an email with a link to accept the invitation and join the collection.

## User Flows

### Sending an Invite (Owner)

1. Navigate to Settings → Collection Members
2. Fill in email and select role
3. Click "Send Invite"
4. User receives email with invite link

### Accepting an Invite (Invitee)

1. Click invite link in email
2. Redirected to auth page with invite preview
3. Sign in or sign up
4. Review collection terms
5. Accept invite
6. Join collection and see photos

## Components

- `src/components/MembersList.tsx` - Display and manage collection members
- `src/components/PendingInvitesList.tsx` - View pending invitations (owners)
- `src/components/InviteForm.tsx` - Send new invitations
- `src/pages/InviteAccept.tsx` - Accept invitation page

## API Endpoints

See `docs/handoff/frontend-invite-integration.md` for complete API documentation.

## Testing

See manual testing checklist in implementation plan.
```

**Step 2: Update main README**

Add invite system to features list in project README.

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: add invite system feature documentation"
```

---

## Completion Checklist

- [ ] Phase 0: Cleanup legacy code
- [ ] Phase 1: API client types and methods
- [ ] Phase 2: Auth flow integration
- [ ] Phase 3: Settings page integration
- [ ] Phase 4: Testing and polish
- [ ] All TypeScript compilation passes
- [ ] Manual testing completed
- [ ] Error handling polished
- [ ] Accessibility audit passed
- [ ] Documentation complete

## Notes

- Backend is deployed to production
- All endpoints tested and working
- Frontend implements read-only view for non-owners
- Expired invites show dedicated error page
- Each invite requires individual acceptance with terms

## Next Steps After Implementation

1. Deploy frontend to production
2. Update `APP_URL` environment variable in Supabase Edge Function
3. Test end-to-end with real email delivery
4. Monitor for errors in production
5. Gather user feedback
6. Consider future enhancements (resend invites, bulk invite, etc.)
