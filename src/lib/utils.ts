import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPhotoUrl(path: string): string {
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it's a static public path (starts with /), return as is
  if (path.startsWith('/')) {
    return path;
  }
  
  // Otherwise, it's a storage path - construct the storage URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/photos/${path}`;
}
