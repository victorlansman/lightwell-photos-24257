import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { photoPath, bbox, faceId }: ThumbnailRequest = await req.json();
    
    console.log('Generating thumbnail for:', { photoPath, bbox, faceId });

    let photoData: Blob;

    // Check if this is a public asset path (starts with /photos/)
    if (photoPath.startsWith('/photos/')) {
      // Fetch from public URL (static assets)
      const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/photos${photoPath}`;
      console.log('Fetching from public URL:', publicUrl);
      
      const response = await fetch(publicUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch photo from public URL: ${response.statusText}`);
      }
      photoData = await response.blob();
    } else {
      // Download from storage using storage client
      const cleanPath = photoPath.replace(/^\/?photos\//, '');
      console.log('Downloading from storage:', cleanPath);

      const { data, error: downloadError } = await supabaseClient
        .storage
        .from('photos')
        .download(cleanPath);

      if (downloadError || !data) {
        console.error('Error downloading photo:', downloadError);
        throw new Error(`Failed to download photo: ${downloadError?.message}`);
      }
      photoData = data;
    }

    // Convert blob to array buffer
    const arrayBuffer = await photoData.arrayBuffer();
    const photoBytes = new Uint8Array(arrayBuffer);
    
    // Decode image using imagescript
    const image = await Image.decode(photoBytes);
    
    console.log('Image dimensions:', image.width, 'x', image.height);

    // Calculate crop dimensions in pixels
    const cropX = Math.floor(image.width * bbox.x / 100);
    const cropY = Math.floor(image.height * bbox.y / 100);
    const cropWidth = Math.floor(image.width * bbox.width / 100);
    const cropHeight = Math.floor(image.height * bbox.height / 100);

    console.log('Crop dimensions:', { cropX, cropY, cropWidth, cropHeight });

    // Crop to bounding box
    const cropped = image.crop(cropX, cropY, cropWidth, cropHeight);
    
    // Resize to 512x512
    const resized = cropped.resize(512, 512);

    // Encode as JPEG
    const thumbnailBytes = await resized.encodeJPEG(85);

    // Upload thumbnail to storage
    const thumbnailPath = `face-${faceId}.jpg`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from('thumbnails')
      .upload(thumbnailPath, thumbnailBytes, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading thumbnail:', uploadError);
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabaseClient
      .storage
      .from('thumbnails')
      .getPublicUrl(thumbnailPath);

    console.log('Thumbnail generated successfully:', urlData.publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: urlData.publicUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-thumbnail function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});