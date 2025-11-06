export interface Photo {
  id: string;
  path: string;
  created_at: string;
  is_favorite: boolean;
  filename?: string;
  tagged_people?: string[];
  user_notes?: string;
}
