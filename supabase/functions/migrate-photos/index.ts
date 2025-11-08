import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const photoMappings = [
  { filename: 'family-christmas-2023.jpg', url: '/photos/family-christmas-2023.jpg' },
  { filename: 'summer-vacation-parents.jpg', url: '/photos/summer-vacation-parents.jpg' },
  { filename: 'birthday-kids.jpg', url: '/photos/birthday-kids.jpg' },
  { filename: 'thanksgiving-dinner-2023.jpg', url: '/photos/thanksgiving-dinner-2023.jpg' },
  { filename: 'john-portrait.jpg', url: '/photos/john-portrait.jpg' },
  { filename: 'sarah-portrait.jpg', url: '/photos/sarah-portrait.jpg' },
  { filename: 'playground-kids.jpg', url: '/photos/playground-kids.jpg' },
  { filename: 'anniversary-couple.jpg', url: '/photos/anniversary-couple.jpg' },
  { filename: 'school-event-emily-john.jpg', url: '/photos/school-event-emily-john.jpg' },
  { filename: 'unknown-coffee-shop.jpg', url: '/photos/unknown-coffee-shop.jpg' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { collectionId, baseUrl } = await req.json();
    
    console.log('Starting photo migration for collection:', collectionId);
    
    const results = [];
    
    for (const photo of photoMappings) {
      try {
        // Fetch the photo from the public URL
        const photoUrl = `${baseUrl}${photo.url}`;
        console.log('Fetching photo:', photoUrl);
        
        const response = await fetch(photoUrl);
        if (!response.ok) {
          console.error(`Failed to fetch ${photo.filename}:`, response.statusText);
          results.push({ filename: photo.filename, success: false, error: 'Failed to fetch' });
          continue;
        }
        
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        // Upload to storage with collection-based path
        const timestamp = Date.now();
        const storagePath = `${collectionId}/${timestamp}-${photo.filename}`;
        
        console.log('Uploading to storage:', storagePath);
        
        const { error: uploadError } = await supabaseClient
          .storage
          .from('photos')
          .upload(storagePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false
          });
        
        if (uploadError) {
          console.error(`Upload error for ${photo.filename}:`, uploadError);
          results.push({ filename: photo.filename, success: false, error: uploadError.message });
          continue;
        }
        
        // Update database records
        const { error: updateError } = await supabaseClient
          .from('photos')
          .update({ path: storagePath })
          .eq('path', photo.url)
          .eq('collection_id', collectionId);
        
        if (updateError) {
          console.error(`Database update error for ${photo.filename}:`, updateError);
          results.push({ filename: photo.filename, success: false, error: updateError.message });
          continue;
        }
        
        console.log(`Successfully migrated ${photo.filename}`);
        results.push({ 
          filename: photo.filename, 
          success: true, 
          oldPath: photo.url,
          newPath: storagePath 
        });
        
      } catch (error) {
        console.error(`Error processing ${photo.filename}:`, error);
        results.push({ 
          filename: photo.filename, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Migration complete: ${successCount}/${results.length} photos migrated`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in migrate-photos function:', error);
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