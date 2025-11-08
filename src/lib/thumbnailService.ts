import { supabase } from "@/integrations/supabase/client";

interface ThumbnailRequest {
  photoPath: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  faceId: string;
}

export async function generateThumbnail(
  photoPath: string,
  bbox: { x: number; y: number; width: number; height: number },
  faceId: string
): Promise<string | null> {
  try {
    console.log('Calling generate-thumbnail function:', { photoPath, bbox, faceId });
    
    const { data, error } = await supabase.functions.invoke('generate-thumbnail', {
      body: {
        photoPath,
        bbox,
        faceId
      } as ThumbnailRequest
    });

    if (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }

    if (data?.success && data?.thumbnailUrl) {
      console.log('Thumbnail generated successfully:', data.thumbnailUrl);
      return data.thumbnailUrl;
    }

    console.error('Thumbnail generation failed:', data);
    return null;
  } catch (error) {
    console.error('Error calling thumbnail function:', error);
    return null;
  }
}

export async function updateFaceThumbnail(faceId: string, thumbnailUrl: string) {
  const { error } = await supabase
    .from('photo_people')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', faceId);

  if (error) {
    console.error('Error updating face thumbnail:', error);
    throw error;
  }
}

export async function updatePersonThumbnail(personId: string, thumbnailUrl: string) {
  const { error } = await supabase
    .from('people')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', personId);

  if (error) {
    console.error('Error updating person thumbnail:', error);
    throw error;
  }
}