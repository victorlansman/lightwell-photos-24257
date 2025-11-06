export interface PersonCluster {
  id: string;
  name: string | null; // null for unlabeled clusters
  thumbnailPath: string;
  photoCount: number;
  photos: string[]; // Array of photo paths in this cluster
}
