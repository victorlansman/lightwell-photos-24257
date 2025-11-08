import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPhotoUrl(path: string): string {
  // If it's already a full URL, return as is (for legacy data)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it's a static public path (starts with /), return as is
  if (path.startsWith('/')) {
    return path;
  }
  
  // For storage paths, we now use signed URLs via getSignedPhotoUrl
  // This is a fallback that constructs the authenticated storage URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/authenticated/photos/${path}`;
}

// Generate a signed URL for private photo access
export async function getSignedPhotoUrl(path: string): Promise<string> {
  // If it's already a full URL or static path, return as is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path;
  }
  
  const { supabase } = await import('@/integrations/supabase/client');
  
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 3600); // Valid for 1 hour
  
  if (error || !data) {
    console.error('Error generating signed URL for path:', path, 'Error:', error);
    return getPhotoUrl(path); // Fallback to authenticated URL
  }
  
  return data.signedUrl;
}
