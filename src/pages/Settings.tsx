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
                              This action cannot be undone. This will permanently delete your account and remove your access to all collections.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) throw new Error("Not authenticated");

                                // Sign out first
                                await supabase.auth.signOut();

                                toast({
                                  title: "Account deletion requested",
                                  description: "Please contact support to complete account deletion.",
                                });

                                navigate("/auth");
                              } catch (error: any) {
                                toast({
                                  title: "Error",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
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
