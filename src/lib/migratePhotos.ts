import { supabase } from "@/integrations/supabase/client";

export async function migratePhotosToStorage(collectionId: string) {
  const baseUrl = window.location.origin;
  
  const { data, error } = await supabase.functions.invoke('migrate-photos', {
    body: {
      collectionId,
      baseUrl
    }
  });

  if (error) {
    console.error('Migration error:', error);
    throw error;
  }

  return data;
}