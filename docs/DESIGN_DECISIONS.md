# Design Decisions & Architecture

## Grid Layout: Dynamic Zoom with Inline CSS

**Problem:** Photo grids showed 10 items per row instead of dynamic zoom levels (16 at max zoom).

**Root Cause:** Tailwind's responsive grid-cols classes (sm:grid-cols-10, md:grid-cols-16) had media queries that overrode inline `gridTemplateColumns` styles, forcing breakpoint-based columns instead of dynamic values.

**Solution:** Use pure inline CSS with `display: grid; gridTemplateColumns: repeat(${zoomLevel}, minmax(0, 1fr))` instead of Tailwind classes.

**Implementation:**
- `src/pages/PersonAlbum.tsx`: Grid for person albums (line 580-586)
- `src/components/PhotoGrid.tsx`: Reusable grid for all photo galleries (line 37-42)

**Pattern:** All photo grids must use inline CSS, never Tailwind grid-cols classes.

---

## Photo URL Authentication: usePhotoUrl Hook

**Problem:** Images disappeared when ThumbnailSelectionCard used `photo.path` directly.

**Root Cause:** `photo.path` is a server-side file path. Azure Blob Storage requires authenticated URLs. Direct paths return 401 Unauthorized.

**Solution:** Use `usePhotoUrl(photoId)` hook which:
1. Calls Azure API with auth token
2. Fetches blob from storage
3. Creates object URL via `URL.createObjectURL(blob)`
4. Returns valid data blob URL safe for `<img src>`

**Pattern:** NEVER use `photo.path` in `<img src>`. Always use `usePhotoUrl(photo.id)`.

**Components Updated:**
- `src/components/PhotoCard.tsx`
- `src/components/FacePhotoCard.tsx`
- `src/components/ThumbnailSelectionCard.tsx`
- `src/components/PersonClusterCard.tsx`

---

## Coordinate System: UI vs API

**Reality:** App uses two coordinate systems that must be converted:

| System | Range | Context |
|--------|-------|---------|
| **UI** | 0-100 | Frontend display (percentages) |
| **API** | 0-1 | Backend storage (normalized) |

**Conversion Rule:**
```typescript
// Before sending to backend: divide by 100
apiBbox = { x: uiBbox.x / 100, y: uiBbox.y / 100, ... }

// When receiving from backend: multiply by 100 if value <= 1
if (bbox.x <= 1) displayBbox = { x: bbox.x * 100, ... }
```

**Files:**
- `src/pages/PersonAlbum.tsx:174-179` - UI→API conversion
- `src/components/PersonThumbnail.tsx:29-36` - API→UI auto-detection

---

## Feature Completeness: Backend Dependencies

**UI Complete but Backend Pending:**
- Hide/merge people buttons (`src/pages/People.tsx`)
- Delete photo buttons (`src/pages/PersonAlbum.tsx`)
- Settings page (collection members, invites, email, account delete)

All show "Not yet implemented" messages. Frontend is ready - needs backend endpoints.

See `docs/plans/2025-11-12-settings-page.md` for endpoint specifications.

---

## Scalability: DRY Components

**Key reusable components:**
- `PhotoGrid.tsx` - Grid layout with zoom (used everywhere)
- `PersonThumbnail.tsx` - Face crop display (People page + PersonAlbum)
- `FacePhotoCard.tsx` - Face-zoomed card (PersonAlbum face view)

**Pattern:** Compose existing components instead of creating new ones.

---

## Simplified Navigation

**Current sidebar:** Timeline + People only

**Removed:** Albums, Shared photos (not in current scope)

**Header menu:** Added "My Collections" and "Account Settings" (links to /settings)

See `src/components/AppSidebar.tsx` and `src/components/Header.tsx`.
