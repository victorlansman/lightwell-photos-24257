import { ServerId } from './identifiers';
import { UiBoundingBox } from './coordinates';

export interface FaceDetection {
  personId: ServerId | null;
  personName: string | null;
  boundingBox: UiBoundingBox;
}

export interface Photo {
  id: ServerId;
  collection_id: ServerId;  // Collection this photo belongs to
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
    id: ServerId;
    name: string;
    face_bbox: UiBoundingBox | null;
  }>;
  // Legacy fields (kept for backwards compatibility)
  filename?: string;
  tagged_people?: string[];
  user_notes?: string;
  faces?: FaceDetection[];
  taken_at?: string | null;
}
