export interface PersonCluster {
  id: string;
  name: string | null;
  representativeFaceId: string | null;  // CHANGED: was thumbnailPath + thumbnailBbox
  photoCount: number;
  photos: string[];
}
