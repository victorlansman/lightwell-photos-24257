# Architecture & Design Decisions

## Grid Layout System

**Decision:** Use inline CSS `display: grid; gridTemplateColumns: repeat(${columns}, minmax(0, 1fr))` instead of Tailwind grid-cols classes.

**Why:** Tailwind's responsive grid-cols classes (grid-cols-2, grid-cols-4, etc.) conflict with dynamic zoom levels. Media queries at different breakpoints override inline styles unpredictably, causing grid to show 10 items per row instead of the dynamic value.

**Implementation:**
- `src/pages/PersonAlbum.tsx`: Direct inline grid for person albums
- `src/components/PhotoGrid.tsx`: Reusable PhotoGrid with inline grid for all photo galleries
- Both use: `gridTemplateColumns: repeat(${zoomLevel}, minmax(0, 1fr))`

**Pattern:** All photo grids should use this approach, not Tailwind grid-cols. This is now the canonical pattern.

---

## Coordinate System: UI vs API

**Two coordinate systems exist and must be converted between them:**

| System | Range | Context | Example |
|--------|-------|---------|---------|
| **UI Coordinates** | 0-100 | Frontend/display (percentages) | Face at x:30, y:20, width:15, height:20 |
| **API Coordinates** | 0-1 | Backend/storage (normalized) | Same face: x:0.3, y:0.2, width:0.15, height:0.2 |

**Conversion Pattern:**
```typescript
// UI → API (before sending to backend)
const apiBbox = {
  x: uiBbox.x / 100,
  y: uiBbox.y / 100,
  width: uiBbox.width / 100,
  height: uiBbox.height / 100,
};

// API → UI (when receiving from backend)
if (bbox && bbox.x <= 1 && bbox.y <= 1) {
  displayBbox = {
    x: bbox.x * 100,
    y: bbox.y * 100,
    width: bbox.width * 100,
    height: bbox.height * 100,
  };
}
```

**Files using this pattern:**
- `src/pages/PersonAlbum.tsx:handleSelectFaceForThumbnail` - UI→API conversion
- `src/components/PersonThumbnail.tsx` - Auto-detects and converts API→UI
- `src/components/ThumbnailSelectionCard.tsx` - Uses UI coordinates for overlays

**Key Rule:** Always convert to API coordinates before sending to backend. Always detect and convert API coordinates when displaying.

---

## Photo URL Loading Pattern

**Decision:** Use `usePhotoUrl` hook for all photo display.

**Why:** Photos in Azure storage require authenticated blob URLs. Direct `photo.path` strings don't work - they're server-side paths. The hook:
1. Calls `azureApi.fetchPhoto(photoId)` with auth
2. Creates blob object URL via `URL.createObjectURL(blob)`
3. Returns safe data blob URL for `<img src>`
4. Cleans up on unmount

**Components using this pattern:**
- `src/components/PhotoCard.tsx`: `usePhotoUrl(photo.id, { thumbnail: true })`
- `src/components/FacePhotoCard.tsx`: `usePhotoUrl(photo.id)`
- `src/components/ThumbnailSelectionCard.tsx`: `usePhotoUrl(photo.id)`
- `src/components/PersonClusterCard.tsx`: `usePhotoUrl(cluster.thumbnailPath)`

**Pattern:** NEVER use `photo.path` directly in `<img src>`. Always use `usePhotoUrl` hook.

---

## UI State Management Pattern

**Decision:** Derived state via `useMemo`, no manual state mutations for data.

**Pattern used in:**
- `src/pages/PersonAlbum.tsx`: Photos derived from `azurePhotos` via `useMemo`
- `src/pages/Index.tsx`: Photos derived from collection data

**Why:** Keeps single source of truth (React Query cache). When data changes, derived state updates automatically.

**Anti-pattern:** Don't do `const [photos, setPhotos] = useState()` and manually call `setPhotos`. Let React Query + useMemo handle it.

---

## Component Reusability: DRY Principle

**Key reusable components:**
- `PhotoGrid.tsx` - Handles grid layout with zoom for any photo collection
- `PersonThumbnail.tsx` - Circular face crop with zoom, used on People page and PersonAlbum
- `FacePhotoCard.tsx` - Face-cropped square card, used in PersonAlbum face view

**Pattern:** When building new features, check if you can compose existing components instead of creating new ones.

---

## Removed Features & Buttons

**Deliberately hidden/disabled (frontend only):**
- Delete photos button (no backend endpoint)
- Delete account button (no backend endpoint)
- Upload button (planned for later)
- Albums menu item (not used in current flow)
- Shared photos menu item (not used in current flow)

These show "Not yet implemented" messages or are disabled in the UI. Backend work needed to enable them.

---

## Sidebar Navigation

**Current menu (after simplification):**
- Timeline (/)
- People (/people)

**Removed:**
- Albums (/albums) - CollectionDetail replaced this
- Shared photos (/shared) - Not in current scope

**Next:** Settings (/settings) menu item will be added to Header user dropdown.

---

## Active Pages vs Legacy

| Page | Status | Purpose |
|------|--------|---------|
| `/` | Active | Timeline/gallery view |
| `/collections` | Active | Collection list (temp landing) |
| `/collections/:id` | Active | Single collection detail |
| `/people` | Active | Person gallery with face clusters |
| `/people/:id` | Active | Single person album |
| `/unknown` | Active | Unnamed faces gallery |
| `/settings` | In Progress | User & collection settings |
| `/auth` | Active | Login/signup |
| `/migrate-photos` | Legacy | One-time admin tool |

---

## Photo Data Loading Architecture

### Problem Solved
Previously, viewing filtered photos (person albums) required loading ALL unnamed face clusters for the entire collection, blocking page render and lightbox functionality.

### Solution
Photos now include embedded face data (both named and unnamed) with cluster_id preserved from backend. Cluster metadata is loaded on-demand only when needed.

### Data Flow

#### Photos Query
```
GET /v1/collections/{id}/photos?person_id=abc
→ Returns photos with embedded faces
→ Each face has: person_id, name, bbox, cluster_id
```

#### Cluster Metadata Query (On-Demand)
```
GET /api/faces/clusters?ids=xyz
→ Only when viewing cluster album header
→ Not loaded on timeline or person albums
```

#### Where Queries Run

| Page | Photos Query | Cluster Metadata | All People |
|------|--------------|------------------|------------|
| Timeline | ✅ All photos | ❌ Disabled | ❌ Disabled |
| PersonAlbum | ✅ Filtered | ✅ Current only | ❌ Disabled |
| People Gallery | ❌ None | ✅ All clusters | ✅ Enabled |

### Performance Impact

- PersonAlbum: 5-10x faster (no bulk cluster fetch)
- Timeline: 3-5x faster (no cluster fetch)
- Lightbox: Opens immediately (not blocked)

---

## Backend Dependencies

**Features awaiting backend endpoints:**
- Hide/merge people (People.tsx: `handleHide`, `handleMerge`)
- Remove person from photo (PersonAlbum.tsx: `handleRemovePhotos`)
- Delete photos (PersonAlbum.tsx: `handleDeletePhotos`)
- Settings: member management, email change, account deletion

See `docs/plans/2025-11-12-settings-page.md` for backend endpoint specs.
