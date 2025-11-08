import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { migratePhotosToStorage } from "@/lib/migratePhotos";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function MigratePhotos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [collectionId, setCollectionId] = useState<string>("");

  useEffect(() => {
    checkAuth();
    fetchCollectionId();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCollectionId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("supabase_user_id", user.id)
      .single();

    if (!userData) return;

    const { data: collectionData } = await supabase
      .from("collection_members")
      .select("collection_id")
      .eq("user_id", userData.id)
      .limit(1)
      .single();

    if (collectionData) {
      setCollectionId(collectionData.collection_id);
    }
  };

  const handleMigrate = async () => {
    if (!collectionId) {
      toast.error("No collection found");
      return;
    }

    setLoading(true);
    try {
      const result = await migratePhotosToStorage(collectionId);
      setResults(result);
      
      if (result.success) {
        toast.success(`Migration complete! ${result.summary.successful}/${result.summary.total} photos migrated`);
      } else {
        toast.error("Migration failed");
      }
    } catch (error: any) {
      toast.error(`Migration error: ${error.message}`);
      console.error("Migration error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Migrate Photos to Storage</CardTitle>
            <CardDescription>
              This will migrate all demo photos from static assets to Supabase storage.
              This only needs to be run once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Collection ID: <code className="bg-muted px-2 py-1 rounded">{collectionId || "Loading..."}</code>
              </p>
            </div>

            <Button 
              onClick={handleMigrate} 
              disabled={loading || !collectionId}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Migrating..." : "Start Migration"}
            </Button>

            {results && (
              <div className="mt-6 space-y-3">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Migration Results</h3>
                  <p className="text-sm text-muted-foreground">
                    Total: {results.summary.total} | 
                    Successful: {results.summary.successful} | 
                    Failed: {results.summary.failed}
                  </p>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results.results.map((result: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 p-3 bg-card rounded border text-sm"
                    >
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.filename}</div>
                        {result.success ? (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.newPath}
                          </div>
                        ) : (
                          <div className="text-xs text-red-500">
                            {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  Back to Photos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}