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
  created_at: string;
  is_favorite: boolean;
  filename?: string;
  tagged_people?: string[];
  user_notes?: string;
  faces?: FaceDetection[];
  taken_at?: string | null;
  tags?: string[];
}
