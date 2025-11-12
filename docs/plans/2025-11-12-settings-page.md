# Settings Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task with code review between tasks.

**Goal:** Create a Settings page where users can view collection members/roles, invite new users, change email, and delete their account.

**Architecture:** Settings page at `/settings` displays collection member management UI and account settings. Frontend is complete with placeholder "Not Implemented" messages for backend endpoints. Uses React hooks (useState, useEffect), React Query for API calls, and UI components from shadcn.

**Tech Stack:** React, React Router, TypeScript, Tailwind CSS, shadcn/ui Button/Input/Dialog/Table components, React Query hooks

---

## Task 1: Fix Auth Redirect

**Files:**
- Modify: `src/pages/Auth.tsx:19`

**Step 1: Read Auth.tsx to see current redirect**

Run: `cat src/pages/Auth.tsx | grep -A 2 -B 2 "navigate"`
Expected: Find lines with `navigate("/collections")`

**Step 2: Update redirect to timeline**

In `src/pages/Auth.tsx`, change line with:
```typescript
navigate("/collections");
```

To:
```typescript
navigate("/");
```

Do this in TWO places (signup and login success paths).

**Step 3: Verify change**

Run: `grep "navigate" src/pages/Auth.tsx`
Expected: Should show `navigate("/")` twice

**Step 4: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "fix: redirect to timeline instead of collections after login"
```

---

## Task 2: Create Settings Page Component

**Files:**
- Create: `src/pages/Settings.tsx`
- Test: N/A (no unit tests for UI component)

**Step 1: Write Settings.tsx shell**

Create file `src/pages/Settings.tsx` with:

```typescript
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCollections } from "@/hooks/useCollections";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Get current user's collection (first collection)
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const collectionId = collections?.[0]?.id;

  const handleChangeEmail = async () => {
    if (!newEmail) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }

    toast({
      title: "Not yet implemented",
      description: "Email change functionality will be available when backend endpoints are ready",
      variant: "destructive",
    });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    toast({
      title: "Not yet implemented",
      description: "Account deletion functionality will be available when backend endpoints are ready",
      variant: "destructive",
    });
    setIsDeleting(false);
  };

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

              <Tabs defaultValue="members" className="w-full">
                <TabsList>
                  <TabsTrigger value="members">Collection Members</TabsTrigger>
                  <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>

                {/* Collection Members Tab */}
                <TabsContent value="members" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Collection Members</CardTitle>
                      <CardDescription>Manage who has access to your photo collection</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Members List Placeholder */}
                      <div className="rounded-lg border p-4 text-center text-muted-foreground">
                        Members list coming soon (requires backend endpoint)
                      </div>

                      {/* Invite Section */}
                      <Card className="border-dashed">
                        <CardHeader>
                          <CardTitle className="text-lg">Invite New User</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4">
                            <Input
                              placeholder="Email address"
                              type="email"
                              disabled
                            />
                            <select className="w-full px-3 py-2 border rounded-md bg-background text-foreground" disabled>
                              <option>Owner</option>
                              <option>Editor</option>
                              <option>Viewer</option>
                            </select>
                            <Button disabled>
                              Send Invite
                            </Button>
                            <p className="text-sm text-muted-foreground">
                              Invite functionality requires backend endpoints
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Account Tab */}
                <TabsContent value="account" className="space-y-4">
                  {/* Change Email */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Email Address</CardTitle>
                      <CardDescription>Update your account email</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">New Email</label>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          disabled
                        />
                      </div>
                      <Button disabled>
                        Update Email
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Email change requires backend endpoint
                      </p>
                    </CardContent>
                  </Card>

                  {/* Delete Account */}
                  <Card className="border-destructive">
                    <CardHeader>
                      <CardTitle className="text-destructive">Delete Account</CardTitle>
                      <CardDescription>Permanently delete your account and all associated data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            Delete My Account
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Account</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete your account and all your photo data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogContent>
                      </AlertDialog>
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

**Step 2: Verify file is created**

Run: `ls -la src/pages/Settings.tsx`
Expected: File exists with 200+ lines

**Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: create settings page with member and account tabs"
```

---

## Task 3: Add Route to App Router

**Files:**
- Modify: Main routing file (find it first)

**Step 1: Find the routing file**

Run: `find src -name "App.tsx" -o -name "main.tsx" -o -name "routes.tsx" -o -name "Router.tsx" | head -5`
Expected: Locate main routing configuration file

**Step 2: Add Settings route**

In the router configuration, add this route (exact location depends on routing setup):

```typescript
{
  path: "/settings",
  element: <Settings />,
}
```

Make sure to import: `import Settings from "@/pages/Settings";`

**Step 3: Verify route added**

Run: `grep -n "settings" src/[App|main|routes|Router].tsx`
Expected: Should see `/settings` path defined

**Step 4: Commit**

```bash
git add src/[App|main|routes|Router].tsx
git commit -m "feat: add /settings route to router"
```

---

## Task 4: Add Menu Item to Header

**Files:**
- Modify: `src/components/Header.tsx:60-80`

**Step 1: Read current user menu in Header**

Run: `sed -n '60,80p' src/components/Header.tsx`
Expected: See User menu dropdown with Log out option

**Step 2: Add "My Collection" menu item**

In `src/components/Header.tsx`, find the DropdownMenuContent with "Log out" and add before it:

```typescript
<DropdownMenuItem onClick={() => navigate("/settings")}>
  <Settings className="h-4 w-4 mr-2" />
  My Collection
</DropdownMenuItem>
<DropdownMenuSeparator />
```

Add import: `import { Settings } from "lucide-react";` (if not already imported)

**Step 3: Verify change**

Run: `grep "My Collection" src/components/Header.tsx`
Expected: See "My Collection" in file

**Step 4: Test locally (manual)**

In browser, click User menu icon → should see "My Collection" option

**Step 5: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add 'My Collection' menu item to header"
```

---

## Task 5: Verify Build and Test Routing

**Files:**
- N/A (build verification only)

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Manual routing test**

- Navigate to app
- Login (if needed)
- Click User menu → "My Collection"
- Should go to `/settings` page
- Should see tabs for "Collection Members" and "Account"
- All buttons should show "Not yet implemented" messages

**Step 3: Commit final state**

```bash
git add .
git commit -m "chore: verify settings page routing and UI"
```

---

## Backend Requirements (For Your Backend Repo)

When ready to implement backend endpoints, add these to your Azure API:

```
GET /collections/{collectionId}/members
  Response: { members: [{ id, email, role, joined_at }, ...] }

POST /collections/{collectionId}/invite
  Body: { email, role: "owner|editor|viewer" }
  Response: { success: true, message: "Invite sent" }

DELETE /collections/{collectionId}/members/{userId}
  Response: { success: true }

PATCH /auth/profile
  Body: { email: "new@email.com" }
  Response: { success: true }

DELETE /auth/account
  Body: { confirmation: "DELETE" }
  Response: { success: true }

GET /collections/{collectionId}/role
  Response: { role: "owner|editor|viewer" }
```

---

## Unresolved Questions

None - plan is complete and self-contained.

---

**Plan complete and saved to `docs/plans/2025-11-12-settings-page.md`.**

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you prefer?**