export interface FaceDetection {
  personId: string | null;
  personName: string | null;
  boundingBox: {
    x: number; // percentage from left
    y: number; // percentage from top
    width: number; // percentage of image width
    height: number; // percentage of image height
  };
}

export interface Photo {
  id: string;
  path: string;
  thumbnail_url: string | null;  // DEPRECATED - now generated via getPhotoUrl()
  original_filename: string | null;
  created_at: string;
  is_favorite: boolean;
  title: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  rotation: number;
  estimated_year: number | null;
  user_corrected_year: number | null;
  tags: string[];
  people: Array<{
    id: string;
    name: string;
    face_bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null;
  }>;
  // Legacy fields (kept for backwards compatibility)
  filename?: string;
  tagged_people?: string[];
  user_notes?: string;
  faces?: FaceDetection[];
  taken_at?: string | null;
}
