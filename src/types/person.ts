export interface PersonCluster {
  id: string;
  name: string | null; // null for unlabeled clusters
  thumbnailPath: string;
  thumbnailBbox?: { x: number; y: number; width: number; height: number } | null;
  photoCount: number;
  photos: string[]; // Array of photo paths in this cluster
}
