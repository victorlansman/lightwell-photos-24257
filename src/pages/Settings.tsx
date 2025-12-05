import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionMembers, usePendingInvites, useLeaveCollection } from "@/hooks/useInvites";
import { azureApi } from "@/lib/azureApiClient";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, LogOut } from "lucide-react";
import { MembersList } from "@/components/MembersList";
import { PendingInvitesList } from "@/components/PendingInvitesList";
import { InviteForm } from "@/components/InviteForm";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveConfirmText, setLeaveConfirmText] = useState('');

  // Get tab from URL params (default to members)
  const activeTab = searchParams.get("tab") || "members";

  // Get all user collections
  const { data: collections, isLoading: collectionsLoading } = useCollections();

  // Leave collection mutation
  const leaveCollection = useLeaveCollection(selectedCollectionId);

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

  // Check if current user is the last owner (for cascade delete warning)
  const ownerCount = members?.filter(m => m.role === 'owner').length ?? 0;
  const isLastOwner = isOwner && ownerCount === 1;

  // Debug logging
  console.log('[Leave Collection Debug]', {
    members: members?.map(m => ({ email: m.email, role: m.role })),
    ownerCount,
    isOwner,
    isLastOwner,
    selectedCollection: selectedCollection?.name
  });

  // Handler for leaving collection
  const handleLeaveCollection = async () => {
    if (!currentUserId) return;
    setIsLeaving(true);
    try {
      const result = await leaveCollection.mutateAsync(currentUserId);

      if (result.collection_deleted) {
        toast({
          title: "Collection deleted",
          description: `Collection and ${result.blobs_deleted ?? 0} photos have been permanently deleted.`,
        });
        // Navigate to home since collection no longer exists
        navigate("/");
      } else {
        toast({
          title: "Left collection",
          description: `You have left "${selectedCollection?.name}".`,
        });
        // Select another collection if available
        const remainingCollections = collections?.filter(c => c.id !== selectedCollectionId);
        if (remainingCollections && remainingCollections.length > 0) {
          setSelectedCollectionId(remainingCollections[0].id);
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to leave collection",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLeaving(false);
      setLeaveDialogOpen(false);
    }
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

                  {/* Collection Actions */}
                  {selectedCollectionId && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Collection Actions</CardTitle>
                        <CardDescription>
                          Manage your membership in "{selectedCollection?.name}"
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-3">
                        {/* Leave Collection */}
                        <AlertDialog
                          open={leaveDialogOpen}
                          onOpenChange={(open) => {
                            setLeaveDialogOpen(open);
                            if (!open) setLeaveConfirmText('');
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button variant="outline">
                              <LogOut className="h-4 w-4 mr-2" />
                              Leave Collection
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {isLastOwner ? "⚠️ Warning: You are the last owner" : "Leave collection?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                  {isLastOwner ? (
                                    <>
                                      <p className="font-semibold text-destructive">
                                        Leaving will permanently delete this collection and all {selectedCollection?.photo_count ?? 0} photos.
                                      </p>
                                      <p>This cannot be undone. All photos and their data will be deleted.</p>
                                      <div className="pt-2">
                                        <p className="text-sm mb-2">Type <span className="font-mono font-bold">delete</span> to confirm:</p>
                                        <Input
                                          value={leaveConfirmText}
                                          onChange={(e) => setLeaveConfirmText(e.target.value)}
                                          placeholder="delete"
                                          disabled={isLeaving}
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <p>You will lose access to "{selectedCollection?.name}" and all its photos.</p>
                                  )}
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleLeaveCollection}
                                disabled={isLeaving || (isLastOwner && leaveConfirmText.toLowerCase() !== 'delete')}
                                className={isLastOwner ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                              >
                                {isLeaving ? "Deleting..." : isLastOwner ? "Delete Collection" : "Leave"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Delete Collection (owner shortcut - same as leaving as last owner) */}
                        {isOwner && !isLastOwner && (
                          <p className="text-sm text-muted-foreground self-center">
                            Transfer ownership to another member before deleting.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

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
                  {/* Delete Account */}
                  <Card className="border-destructive">
                    <CardHeader>
                      <CardTitle className="text-destructive">Delete Account</CardTitle>
                      <CardDescription>Permanently delete your account and all associated data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AlertDialog
                        open={deleteDialogOpen}
                        onOpenChange={(open) => {
                          setDeleteDialogOpen(open);
                          if (!open) setDeleteConfirmText('');
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            Delete My Account
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Warning: Permanent Account Deletion</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-3">
                                <p className="font-semibold text-destructive">
                                  You will permanently lose access to all collections, photos, and data.
                                </p>
                                <p>This action cannot be undone.</p>
                                <div className="pt-2">
                                  <p className="text-sm mb-2">Type <span className="font-mono font-bold">delete</span> to confirm:</p>
                                  <Input
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="delete"
                                  />
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async (e) => {
                                e.preventDefault();

                                // Fire backend delete (don't await - runs in background)
                                azureApi.deleteAccount().catch(err => {
                                  console.error('Account deletion error:', err);
                                });

                                // Sign out and redirect IMMEDIATELY
                                await supabase.auth.signOut();
                                navigate("/auth", { replace: true });
                              }}
                              disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Account
                            </AlertDialogAction>
                          </AlertDialogFooter>
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
