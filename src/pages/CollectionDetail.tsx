import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Users, Settings, Heart, User } from "lucide-react";
import { PhotoFilters } from "@/components/PhotoFilters";
import { CollectionPhotoGrid } from "@/components/CollectionPhotoGrid";
import { UploadPhotosDialog } from "@/components/UploadPhotosDialog";
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import { PhotoLightbox } from "@/components/PhotoLightbox";

interface Photo {
  id: string;
  path: string;
  thumbnail_url: string | null;
  original_filename: string;
  taken_at: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  camera_model: string | null;
  location: any;
  created_at: string;
  is_favorite?: boolean;
  people?: any[];
}

interface Collection {
  id: string;
  name: string;
  shopify_order_id: string | null;
  user_role: string;
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  
  // Filter states
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchCollection();
    fetchPhotos();
  }, [id]);

  useEffect(() => {
    applyFilters();
  }, [photos, yearRange, selectedPeople, selectedTags, showFavoritesOnly]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCollection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      const { data: memberData, error } = await supabase
        .from("collection_members")
        .select(`
          role,
          collection:collections (
            id,
            name,
            shopify_order_id
          )
        `)
        .eq("collection_id", id)
        .eq("user_id", userData.id)
        .single();

      if (error) throw error;

      setCollection({
        ...memberData.collection,
        user_role: memberData.role,
      });
    } catch (error: any) {
      toast({
        title: "Error loading collection",
        description: error.message,
        variant: "destructive",
      });
      navigate("/collections");
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      const { data: photosData, error } = await supabase
        .from("photos")
        .select(`
          *,
          photo_people (
            person:people (
              id,
              name
            ),
            face_bbox
          )
        `)
        .eq("collection_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Check favorites
      const { data: favoritesData } = await supabase
        .from("favorites")
        .select("photo_id")
        .eq("user_id", userData.id);

      const favoriteIds = new Set(favoritesData?.map(f => f.photo_id) || []);

      const photosWithFavorites = (photosData || []).map(photo => ({
        ...photo,
        is_favorite: favoriteIds.has(photo.id),
        people: photo.photo_people?.map((pp: any) => ({
          ...pp.person,
          face_bbox: pp.face_bbox,
        })) || [],
      }));

      setPhotos(photosWithFavorites);
    } catch (error: any) {
      toast({
        title: "Error loading photos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyFilters = () => {
    let filtered = [...photos];

    // Year filter
    filtered = filtered.filter(photo => {
      if (!photo.taken_at) return true;
      const year = new Date(photo.taken_at).getFullYear();
      return year >= yearRange[0] && year <= yearRange[1];
    });

    // People filter
    if (selectedPeople.length > 0) {
      filtered = filtered.filter(photo =>
        photo.people?.some(person => selectedPeople.includes(person.id))
      );
    }

    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(photo =>
        selectedTags.some(tag => photo.tags.includes(tag))
      );
    }

    // Favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter(photo => photo.is_favorite);
    }

    setFilteredPhotos(filtered);
  };

  const handleToggleFavorite = async (photoId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      if (photo.is_favorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userData.id)
          .eq("photo_id", photoId);
      } else {
        await supabase
          .from("favorites")
          .insert({
            user_id: userData.id,
            photo_id: photoId,
          });
      }

      setPhotos(photos.map(p =>
        p.id === photoId ? { ...p, is_favorite: !p.is_favorite } : p
      ));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const canUpload = collection?.user_role === "owner" || collection?.user_role === "admin";
  const canInvite = collection?.user_role === "owner";

  if (loading || !collection) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/collections")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{collection.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredPhotos.length} {filteredPhotos.length === 1 ? "photo" : "photos"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canInvite && (
                <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              )}
              {canUpload && (
                <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <PhotoFilters
          photos={photos}
          yearRange={yearRange}
          onYearRangeChange={setYearRange}
          selectedPeople={selectedPeople}
          onSelectedPeopleChange={setSelectedPeople}
          selectedTags={selectedTags}
          onSelectedTagsChange={setSelectedTags}
          showFavoritesOnly={showFavoritesOnly}
          onShowFavoritesOnlyChange={setShowFavoritesOnly}
        />

        <CollectionPhotoGrid
          photos={filteredPhotos}
          onPhotoClick={setLightboxPhoto}
          onToggleFavorite={handleToggleFavorite}
        />
      </main>

      <UploadPhotosDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        collectionId={id!}
        onUploadComplete={fetchPhotos}
      />

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        collectionId={id!}
      />

      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}
