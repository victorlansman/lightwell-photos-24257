import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

  // Get tab from URL params (default to members)
  const activeTab = searchParams.get("tab") || "members";

  // Get all user collections
  const { data: collections, isLoading: collectionsLoading } = useCollections();

  // Set initial collection when collections load
  useEffect(() => {
    if (collections && collections.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const selectedCollection = collections?.find(c => c.id === selectedCollectionId);

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

              <Tabs value={activeTab} onValueChange={(tab) => navigate(`/settings?tab=${tab}`)} className="w-full">
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
                      {/* Collection Selector */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Collection</label>
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
                                {collection.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

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
