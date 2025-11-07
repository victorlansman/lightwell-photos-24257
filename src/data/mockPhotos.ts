import { Photo } from "@/types/photo";
import photo1 from "@/assets/photo-1.jpg";
import photo2 from "@/assets/photo-2.jpg";
import photo3 from "@/assets/photo-3.jpg";
import photo4 from "@/assets/photo-4.jpg";
import photo5 from "@/assets/photo-5.jpg";
import photo6 from "@/assets/photo-6.jpg";

export const mockPhotos: Photo[] = [
  {
    id: "1",
    path: photo1,
    created_at: "2024-11-15T10:30:00Z",
    is_favorite: true,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 30, y: 20, width: 25, height: 35 }
      },
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 60, y: 25, width: 25, height: 35 }
      }
    ]
  },
  {
    id: "2",
    path: photo2,
    created_at: "2024-11-15T14:20:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 25, y: 15, width: 30, height: 40 }
      },
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 55, y: 20, width: 28, height: 38 }
      },
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 10, y: 45, width: 22, height: 30 }
      }
    ]
  },
  {
    id: "3",
    path: photo3,
    created_at: "2024-11-14T09:15:00Z",
    is_favorite: true,
    faces: [
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 35, y: 25, width: 30, height: 40 }
      },
      {
        personId: "unknown-1",
        personName: null,
        boundingBox: { x: 65, y: 30, width: 25, height: 35 }
      }
    ]
  },
  {
    id: "4",
    path: photo4,
    created_at: "2024-11-14T16:45:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 40, y: 20, width: 28, height: 38 }
      }
    ]
  },
  {
    id: "5",
    path: photo5,
    created_at: "2024-11-13T11:00:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 30, y: 25, width: 35, height: 45 }
      },
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 65, y: 28, width: 30, height: 42 }
      }
    ]
  },
  {
    id: "6",
    path: photo6,
    created_at: "2024-11-13T18:30:00Z",
    is_favorite: true,
    faces: [
      {
        personId: "unknown-2",
        personName: null,
        boundingBox: { x: 20, y: 30, width: 30, height: 40 }
      },
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 55, y: 35, width: 28, height: 38 }
      }
    ]
  },
  {
    id: "7",
    path: photo1,
    created_at: "2024-11-12T08:00:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 40, y: 25, width: 30, height: 40 }
      }
    ]
  },
  {
    id: "8",
    path: photo2,
    created_at: "2024-11-12T13:20:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 45, y: 20, width: 28, height: 38 }
      },
      {
        personId: "unknown-1",
        personName: null,
        boundingBox: { x: 15, y: 40, width: 25, height: 35 }
      }
    ]
  },
  {
    id: "9",
    path: photo3,
    created_at: "2024-11-11T10:45:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 25, y: 30, width: 32, height: 42 }
      },
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 60, y: 28, width: 30, height: 40 }
      }
    ]
  },
  {
    id: "10",
    path: photo4,
    created_at: "2024-11-11T15:30:00Z",
    is_favorite: true,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 20, y: 15, width: 28, height: 38 }
      },
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 50, y: 20, width: 30, height: 40 }
      },
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 75, y: 25, width: 22, height: 32 }
      }
    ]
  },
  {
    id: "11",
    path: photo5,
    created_at: "2024-11-10T09:00:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 50, y: 30, width: 28, height: 38 }
      }
    ]
  },
  {
    id: "12",
    path: photo6,
    created_at: "2024-11-10T17:15:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 35, y: 28, width: 30, height: 40 }
      },
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 68, y: 32, width: 26, height: 36 }
      }
    ]
  },
  {
    id: "13",
    path: photo1,
    created_at: "2024-11-09T11:30:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 42, y: 22, width: 30, height: 42 }
      },
      {
        personId: "unknown-1",
        personName: null,
        boundingBox: { x: 12, y: 38, width: 24, height: 34 }
      }
    ]
  },
  {
    id: "14",
    path: photo2,
    created_at: "2024-11-09T14:00:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 38, y: 26, width: 32, height: 40 }
      }
    ]
  },
  {
    id: "15",
    path: photo3,
    created_at: "2024-11-08T10:20:00Z",
    is_favorite: true,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 28, y: 18, width: 28, height: 38 }
      },
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 58, y: 22, width: 30, height: 40 }
      }
    ]
  },
  {
    id: "16",
    path: photo4,
    created_at: "2024-11-08T16:40:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 45, y: 25, width: 30, height: 40 }
      },
      {
        personId: "unknown-2",
        personName: null,
        boundingBox: { x: 15, y: 35, width: 26, height: 36 }
      }
    ]
  },
  {
    id: "17",
    path: photo5,
    created_at: "2024-11-07T09:30:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 32, y: 20, width: 32, height: 44 }
      }
    ]
  },
  {
    id: "18",
    path: photo6,
    created_at: "2024-11-07T18:00:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 25, y: 28, width: 30, height: 42 }
      },
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 60, y: 30, width: 28, height: 38 }
      },
      {
        personId: "unknown-1",
        personName: null,
        boundingBox: { x: 8, y: 45, width: 22, height: 32 }
      }
    ]
  },
  {
    id: "19",
    path: photo1,
    created_at: "2024-11-06T12:00:00Z",
    is_favorite: false,
    faces: [
      {
        personId: "sofia",
        personName: "Sofia",
        boundingBox: { x: 50, y: 24, width: 28, height: 40 }
      }
    ]
  },
  {
    id: "20",
    path: photo2,
    created_at: "2024-11-06T15:45:00Z",
    is_favorite: true,
    faces: [
      {
        personId: "camilla",
        personName: "Camilla",
        boundingBox: { x: 30, y: 22, width: 30, height: 42 }
      },
      {
        personId: "victor",
        personName: "Victor",
        boundingBox: { x: 62, y: 26, width: 28, height: 40 }
      }
    ]
  },
];
