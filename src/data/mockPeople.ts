import { PersonCluster } from "@/types/person";
import camilla1 from "@/assets/people/camilla-1.jpg";
import camilla2 from "@/assets/people/camilla-2.jpg";
import camilla3 from "@/assets/people/camilla-3.jpg";
import camilla4 from "@/assets/people/camilla-4.jpg";
import victor1 from "@/assets/people/victor-1.jpg";
import victor2 from "@/assets/people/victor-2.jpg";
import victor3 from "@/assets/people/victor-3.jpg";
import sofia1 from "@/assets/people/sofia-1.jpg";
import sofia2 from "@/assets/people/sofia-2.jpg";
import sofia3 from "@/assets/people/sofia-3.jpg";
import sofia4 from "@/assets/people/sofia-4.jpg";
import unknown1 from "@/assets/people/unknown-1.jpg";
import unknown2 from "@/assets/people/unknown-2.jpg";

export const mockPeople: PersonCluster[] = [
  {
    id: "camilla",
    name: "Camilla",
    thumbnailPath: camilla1,
    photoCount: 4,
    photos: [camilla1, camilla2, camilla3, camilla4],
  },
  {
    id: "victor",
    name: "Victor",
    thumbnailPath: victor1,
    photoCount: 3,
    photos: [victor1, victor2, victor3],
  },
  {
    id: "sofia",
    name: "Sofia",
    thumbnailPath: sofia1,
    photoCount: 4,
    photos: [sofia1, sofia2, sofia3, sofia4],
  },
  {
    id: "unknown-1",
    name: null,
    thumbnailPath: unknown1,
    photoCount: 1,
    photos: [unknown1],
  },
  {
    id: "unknown-2",
    name: null,
    thumbnailPath: unknown2,
    photoCount: 1,
    photos: [unknown2],
  },
];
