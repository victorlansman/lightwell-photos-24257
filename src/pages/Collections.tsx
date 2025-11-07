import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, LogOut, Users, Image } from "lucide-react";
import { CreateCollectionDialog } from "@/components/CreateCollectionDialog";

interface Collection {
  id: string;
  name: string;
  shopify_order_id: string | null;
  created_at: string;
  photo_count: number;
  member_count: number;
  user_role: string;
}

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchCollections();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchCollections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's internal ID
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      // Fetch collections with member info
      const { data: memberData, error } = await supabase
        .from("collection_members")
        .select(`
          role,
          collection:collections (
            id,
            name,
            shopify_order_id,
            created_at
          )
        `)
        .eq("user_id", userData.id);

      if (error) throw error;

      // Fetch photo counts for each collection
      const collectionsWithCounts = await Promise.all(
        (memberData || []).map(async (member: any) => {
          const { count: photoCount } = await supabase
            .from("photos")
            .select("*", { count: "exact", head: true })
            .eq("collection_id", member.collection.id);

          const { count: memberCount } = await supabase
            .from("collection_members")
            .select("*", { count: "exact", head: true })
            .eq("collection_id", member.collection.id);

          return {
            ...member.collection,
            photo_count: photoCount || 0,
            member_count: memberCount || 0,
            user_role: member.role,
          };
        })
      );

      setCollections(collectionsWithCounts);
    } catch (error: any) {
      toast({
        title: "Error loading collections",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My Collections</h1>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              Photo Collections
            </h2>
            <p className="text-sm text-muted-foreground">
              {collections.length} {collections.length === 1 ? "collection" : "collections"}
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Collection
          </Button>
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Image className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No collections yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Create your first collection to start organizing photos
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Collection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/collections/${collection.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground line-clamp-2">
                    {collection.name}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {collection.user_role}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    <span>{collection.photo_count} photos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{collection.member_count} members</span>
                  </div>
                  {collection.shopify_order_id && (
                    <div className="text-xs text-muted-foreground/70 mt-2">
                      Order: {collection.shopify_order_id.split('/').pop()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateCollectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCollectionCreated={fetchCollections}
      />
    </div>
  );
}
