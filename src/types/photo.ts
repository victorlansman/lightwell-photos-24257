import { ServerId } from './identifiers';
import { UiBoundingBox } from './coordinates';

/** Face with bounding box - only available from PhotoDetail */
export interface FaceDetection {
  personId: ServerId | null;
  personName: string | null;
  boundingBox: UiBoundingBox;
  clusterId?: string | null;
}

/** Person reference - lean version from list (no bbox) */
export interface PhotoPersonRef {
  id: ServerId | null;  // null for unlabeled faces
  name: string | null;
  cluster_id?: ServerId | null;
  face_id: ServerId;  // Always present - use for face derivatives
}

/**
 * UI Photo type - works with both list and detail responses.
 *
 * List response provides: core fields, display_year, people (no bbox)
 * Detail response adds: reasoning, confidence, faces with bbox
 */
export interface Photo {
  id: ServerId;
  collection_id: ServerId;
  path: string;
  thumbnail_url: string | null;
  original_filename: string | null;
  created_at: string;
  is_favorite: boolean;

  // Year - display_year is primary (user_corrected ?? estimated)
  display_year: number | null;
  estimated_year_min: number | null;
  estimated_year_max: number | null;

  // Detail-only year fields (null until detail fetched)
  estimated_year: number | null;
  user_corrected_year: number | null;

  // Dimensions
  width: number | null;
  height: number | null;
  rotation: number;

  // Tags and people (from list, no face bbox)
  tags: string[];
  people: PhotoPersonRef[];

  // Detail-only fields
  title: string | null;
  description: string | null;
  faces?: FaceDetection[];  // Only from PhotoDetail
  taken_at?: string | null;

  // Legacy fields
  filename?: string;
  tagged_people?: string[];
  user_notes?: string;
}
