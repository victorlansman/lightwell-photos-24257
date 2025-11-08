import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PhotoGrid } from "@/components/PhotoGrid";
import { Lightbox } from "@/components/Lightbox";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Photo, FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { ArrowLeft } from "lucide-react";

export default function UnknownPeople() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allPeople, setAllPeople] = useState<PersonCluster[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) return;

      const { data: collectionsData } = await supabase
        .from("collection_members")
        .select("collection_id")
        .eq("user_id", userData.id);

      if (!collectionsData || collectionsData.length === 0) {
        setLoading(false);
        return;
      }

      const collectionIds = collectionsData.map(c => c.collection_id);

      // Fetch photos with unknown faces (null person_id in photo_people)
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select(`
          *,
          photo_people (
            person_id,
            person:people (
              id,
              name
            ),
            face_bbox
          )
        `)
        .in("collection_id", collectionIds)
        .order("taken_at", { ascending: false });

      if (photosError) throw photosError;

      // Filter to only photos that have at least one unknown face
      const photosWithUnknownFaces = (photosData || [])
        .map(photo => {
          const faces: FaceDetection[] = photo.photo_people?.map((pp: any) => ({
            personId: pp.person_id,
            personName: pp.person?.name || null,
            boundingBox: pp.face_bbox || { x: 0, y: 0, width: 10, height: 10 },
          })) || [];

          return {
            id: photo.id,
            path: photo.path.startsWith('/') 
              ? photo.path 
              : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/photos/${photo.path}`,
            title: photo.title || undefined,
            description: photo.description || undefined,
            taken_at: photo.taken_at,
            created_at: photo.created_at,
            tags: photo.tags || [],
            faces,
            is_favorite: false,
          };
        })
        .filter(photo => photo.faces.some(face => face.personId === null));

      setPhotos(photosWithUnknownFaces);

      // Fetch all people for tagging
      const { data: peopleData } = await supabase
        .from("people")
        .select("id, name, thumbnail_url, collection_id")
        .in("collection_id", collectionIds);

      const peopleList: PersonCluster[] = (peopleData || []).map(person => ({
        id: person.id,
        name: person.name,
        thumbnailPath: person.thumbnail_url || "/placeholder.svg",
        photoCount: 0,
        photos: [],
      }));

      setAllPeople(peopleList);
    } catch (error: any) {
      toast({
        title: "Error loading photos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoClick = (photo: Photo) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setSelectedPhoto(photo);
    setLightboxIndex(index);
  };

  const handleCloseLightbox = () => {
    setSelectedPhoto(null);
  };

  const handleUpdateFaces = async (photoId: string, faces: FaceDetection[]) => {
    // Delete existing photo_people entries
    await supabase
      .from("photo_people")
      .delete()
      .eq("photo_id", photoId);

    // Insert new face tags
    const insertData = faces.map(face => ({
      photo_id: photoId,
      person_id: face.personId,
      face_bbox: face.boundingBox,
    }));

    if (insertData.length > 0) {
      await supabase
        .from("photo_people")
        .insert(insertData);
    }

    // Update local state
    setPhotos(prev => 
      prev.map(p => p.id === photoId ? { ...p, faces } : p)
        .filter(p => p.faces.some(face => face.personId === null))
    );

    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto(prev => prev ? { ...prev, faces } : null);
    }
  };

  const handleUpdatePeople = async (personId: string, newName: string) => {
    await supabase
      .from("people")
      .update({ name: newName })
      .eq("id", personId);

    setAllPeople(prev => 
      prev.map(p => p.id === personId ? { ...p, name: newName } : p)
    );
  };

  if (loading) {
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
            <div className="space-y-6">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4"
                  onClick={() => navigate("/people")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to People
                </Button>
                <h1 className="text-3xl font-bold text-foreground">Unnamed People</h1>
                <p className="text-muted-foreground mt-1">
                  {photos.length} {photos.length === 1 ? "photo" : "photos"} with untagged faces
                </p>
              </div>

              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">No photos with unnamed faces</p>
                  <p className="text-sm text-muted-foreground mt-2">All faces have been tagged!</p>
                </div>
              ) : (
                <PhotoGrid 
                  photos={photos} 
                  onPhotoClick={handlePhotoClick}
                  selectedPhotos={new Set()}
                  onSelectPhoto={() => {}}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {selectedPhoto && (
        <Lightbox
          isOpen={true}
          photo={photos[lightboxIndex]}
          onClose={handleCloseLightbox}
          onNext={() => {
            const nextIndex = (lightboxIndex + 1) % photos.length;
            setLightboxIndex(nextIndex);
            setSelectedPhoto(photos[nextIndex]);
          }}
          onPrevious={() => {
            const prevIndex = (lightboxIndex - 1 + photos.length) % photos.length;
            setLightboxIndex(prevIndex);
            setSelectedPhoto(photos[prevIndex]);
          }}
          onUpdateFaces={handleUpdateFaces}
          onUpdatePeople={handleUpdatePeople}
          allPeople={allPeople}
        />
      )}
    </SidebarProvider>
  );
}
