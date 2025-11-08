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
    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let { photoPath, bbox, faceId }: ThumbnailRequest = await req.json();
    
    // Validate bbox input
    if (!bbox || typeof bbox.x !== 'number' || typeof bbox.y !== 'number' || 
        typeof bbox.width !== 'number' || typeof bbox.height !== 'number' ||
        bbox.x < 0 || bbox.y < 0 || bbox.width <= 0 || bbox.height <= 0 ||
        bbox.x > 100 || bbox.y > 100 || bbox.width > 100 || bbox.height > 100) {
      throw new Error('Invalid bounding box parameters');
    }
    
    console.log('Generating thumbnail for:', { photoPath, bbox, faceId });

    let photoData: Blob;
    
    // Allowlist for URL validation
    const ALLOWED_DOMAIN = new URL(Deno.env.get('SUPABASE_URL') ?? '').hostname;
    
    // Validate and handle URL-based photo paths (SSRF protection)
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      console.log('Full URL detected, validating:', photoPath);
      
      try {
        const parsedUrl = new URL(photoPath);
        
        // Only allow Supabase storage URLs
        if (parsedUrl.hostname !== ALLOWED_DOMAIN) {
          throw new Error('URL domain not allowed');
        }
        
        // Block private IP ranges
        const hostname = parsedUrl.hostname;
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.match(/^10\./) ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
          hostname.match(/^192\.168\./) ||
          hostname.match(/^169\.254\./)
        ) {
          throw new Error('Private IP addresses not allowed');
        }
        
        console.log('URL validated, fetching from:', photoPath);
        const response = await fetch(photoPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch photo from URL: ${response.statusText}`);
        }
        photoData = await response.blob();
      } catch (error) {
        console.error('URL validation failed:', error);
        throw new Error('Invalid or disallowed URL');
      }
    } else if (photoPath.startsWith('/photos/')) {
      // Static public asset path - reject this since buckets are now private
      throw new Error('Static public paths are no longer supported');
    } else {
      // Relative storage path - use service role for storage access
      const supabaseServiceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const cleanPath = photoPath.replace(/^\/?photos\//, '');
      console.log('Downloading from storage bucket:', cleanPath);

      const { data, error: downloadError } = await supabaseServiceClient
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

    // Upload thumbnail to storage using service role
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const thumbnailPath = `face-${faceId}.jpg`;
    const { error: uploadError } = await supabaseServiceClient
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

    // Get the storage path (not public URL since bucket is private)
    const thumbnailUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/authenticated/thumbnails/${thumbnailPath}`;

    console.log('Thumbnail generated successfully:', thumbnailUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: thumbnailUrl 
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