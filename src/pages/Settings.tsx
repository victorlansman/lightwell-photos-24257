import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionMembers, usePendingInvites, useLeaveCollection } from "@/hooks/useInvites";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveConfirmText, setLeaveConfirmText] = useState('');

  // Get tab from URL params (default to members)
  const activeTab = searchParams.get("tab") || "members";

  // Get current user from API
  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id;

  // Get all user collections
  const { data: collections, isLoading: collectionsLoading } = useCollections();

  // Leave collection mutation
  const leaveCollection = useLeaveCollection(selectedCollectionId);

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
                <div>
                  <h1 className="text-3xl font-bold">Settings</h1>
                  {currentUser?.email && (
                    <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                  )}
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(tab) => navigate(`/settings?tab=${tab}`)} className="w-full">
                <TabsList>
                  <TabsTrigger value="members">Collection Members</TabsTrigger>
                  <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>

                {/* Collection Members Tab */}
                <TabsContent value="members" className="space-y-4">
                  {/* Collection Selector with Leave Action */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Select Collection</CardTitle>
                      <CardDescription>
                        {isOwner
                          ? 'Manage members and invitations for your collection'
                          : 'View members of this collection'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                              {collection.name} · {collection.photo_count} photos ({collection.user_role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedCollectionId && (
                        <div className="flex items-center gap-3 pt-2 border-t">
                          <AlertDialog
                            open={leaveDialogOpen}
                            onOpenChange={(open) => {
                              setLeaveDialogOpen(open);
                              if (!open) setLeaveConfirmText('');
                            }}
                          >
                            <AlertDialogTrigger asChild>
                              <Button variant={isLastOwner ? "destructive" : "outline"} size="sm">
                                <LogOut className="h-4 w-4 mr-2" />
                                {isLastOwner ? `Delete "${selectedCollection?.name}"` : `Leave "${selectedCollection?.name}"`}
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
                                  {isLeaving ? "Processing..." : isLastOwner ? "Delete Collection" : "Leave"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {isOwner && !isLastOwner && (
                            <p className="text-xs text-muted-foreground">
                              Transfer ownership to delete this collection.
                            </p>
                          )}
                        </div>
                      )}
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
                      collectionName={selectedCollection?.name}
                      photoCount={selectedCollection?.photo_count}
                      currentUserRole={selectedCollection?.user_role || 'viewer'}
                      currentUserId={currentUserId}
                      onCollectionDeleted={() => {
                        const remaining = collections?.filter(c => c.id !== selectedCollectionId);
                        if (remaining && remaining.length > 0) {
                          setSelectedCollectionId(remaining[0].id);
                        } else {
                          navigate("/");
                        }
                      }}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No members found
                      </CardContent>
                    </Card>
                  )}

                  {/* Invitations Section (Owners Only) */}
                  {isOwner ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>{selectedCollection?.name} Invitations</CardTitle>
                        <CardDescription>
                          Invite new members or manage pending invitations
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Pending Invites */}
                        {invites && invites.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Pending ({invites.length})
                            </h4>
                            <PendingInvitesList
                              invites={invites}
                              collectionId={selectedCollectionId}
                              embedded
                            />
                          </div>
                        )}

                        {/* Invite Form */}
                        <div className={invites && invites.length > 0 ? "pt-4 border-t" : ""}>
                          <InviteForm collectionId={selectedCollectionId} embedded />
                        </div>
                      </CardContent>
                    </Card>
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
                      <CardDescription>
                        Permanently delete your account ({currentUser?.email}) and its associated data
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Collections you own */}
                      {collections && collections.filter(c => c.user_role === 'owner').length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Collections you own (may be deleted):</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {collections.filter(c => c.user_role === 'owner').map(c => (
                              <li key={c.id} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                {c.name} ({c.photo_count} photos, {c.member_count} members)
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-muted-foreground italic">
                            Collections with co-owners will be maintained. Collections where you're the only owner will be permanently deleted.
                          </p>
                        </div>
                      )}

                      {/* Collections you're a member of */}
                      {collections && collections.filter(c => c.user_role !== 'owner').length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Collections you'll leave (won't be deleted):</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {collections.filter(c => c.user_role !== 'owner').map(c => (
                              <li key={c.id} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                {c.name} ({c.photo_count} photos)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

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
                                  Deleting account: {currentUser?.email}
                                </p>
                                <p>
                                  Collections you solely own will be permanently deleted, including all photos and member access.
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
