# Album View Refactor - QA Testing Checklist

## Pre-Live Testing Checklist

### Phase 1: Basic Functionality (Must Pass)

#### Index Page (Timeline)
- [ ] Page loads without errors
- [ ] Photos display in grid (default 4 columns)
- [ ] Lightbox opens when clicking a photo
- [ ] Lightbox closes with X button or clicking background
- [ ] Navigation: Previous/Next buttons work in lightbox
- [ ] Wrapping: Last photo → Next goes to first; First photo → Previous goes to last
- [ ] Photos count displayed matches grid
- [ ] "Loading..." state appears while fetching

#### Cluster Face Detection (Critical)
- [ ] Named faces have **blue** borders in lightbox
- [ ] Cluster (unnamed) faces have **orange** borders in lightbox
- [ ] Faces render in correct position on photo
- [ ] Face detection works in person album (face-zoomed mode)

#### View Controls
- [ ] Zoom in/out buttons adjust grid columns (4, 8, 16 cols)
- [ ] Slider syncs with zoom buttons
- [ ] "Show dates" toggle hides/shows date labels
- [ ] "Crop square" toggle switches between square/original aspect ratio

#### Selection Mode
- [ ] Click "Select" button enters selection mode
- [ ] Checkboxes appear on each photo
- [ ] Click checkboxes to select/deselect individual photos
- [ ] "Select All" button selects all photos
- [ ] "Deselect All" button clears selection
- [ ] "Cancel" button exits selection mode and clears selection
- [ ] Share button appears when photos selected
- [ ] Share dialog opens and closes correctly

---

### Phase 2: CollectionDetail Page

#### Filters (Each Must Work Independently)
- [ ] **Year Range**: Min/max year filter works
- [ ] **People Filter**: Selecting person hides photos without that person
- [ ] **Tags Filter**: Selecting tag hides photos without that tag
- [ ] **Favorites Only**: Toggle shows/hides non-favorite photos

#### Filter Combinations (Critical)
- [ ] Year + Person filter together
- [ ] Year + Tags filter together
- [ ] Person + Tags filter together
- [ ] All 4 filters combined
- [ ] Photo count updates correctly when filters change

#### Upload/Invite Dialogs
- [ ] Upload button visible (if owner/admin)
- [ ] Invite button visible (if owner)
- [ ] Both dialogs open/close without errors
- [ ] After upload, new photos appear in grid

---

### Phase 3: Data Integrity

#### Lightbox State
- [ ] Opening lightbox doesn't break when no photo selected
- [ ] Favorite toggle works (photo status updates)
- [ ] Face detection persists across navigation
- [ ] Person info displays correctly in lightbox

#### Query State
- [ ] No console errors when switching between pages
- [ ] Photo data doesn't duplicate on refetch
- [ ] Filters reset properly when navigating away/back
- [ ] No infinite loading states

---

### Phase 4: Performance

#### Load Times
- [ ] Page with 50 photos loads in < 2s
- [ ] Lightbox opens in < 500ms
- [ ] View controls respond instantly (< 100ms)
- [ ] Filters apply without UI freeze

#### Memory
- [ ] No memory leaks when opening/closing lightbox repeatedly
- [ ] Grid doesn't lag after scrolling 100+ photos
- [ ] No lag when toggling selection mode

---

### Phase 5: Edge Cases

#### Empty States
- [ ] Empty collection shows "No photos found"
- [ ] Filters that return 0 results show empty state
- [ ] Collection deletion doesn't crash page

#### Error Handling
- [ ] Network error shows error message (not crash)
- [ ] Missing photo data handled gracefully
- [ ] Invalid collection ID shows error

#### Mobile/Responsive
- [ ] Works on mobile (< 480px width)
- [ ] Works on tablet (480px - 1024px)
- [ ] Works on desktop (> 1024px)
- [ ] Touch events work on mobile

---

## Testing Procedure

### How to Run Tests Locally

```bash
# Start dev server
npm run dev

# Navigate to Timeline (Index page)
# Test basic photo loading and lightbox

# Navigate to a Collection (CollectionDetail page)
# Test filters individually, then combined

# Check console for any TypeErrors or warnings
# Open DevTools → Console tab to verify
```

### What to Look For

1. **Console Errors**: Any red errors block go-live
2. **Network Issues**: Check Network tab - should have < 10 requests per page
3. **Rendering Issues**: Misaligned faces, truncated text, overflow
4. **State Issues**: Photos not updating after actions

---

## Rollback Plan

If issues found:

1. **Minor bugs** (UI only): Fix and re-test
2. **Critical bugs** (crashes/data loss): Revert to previous main commit:
   ```bash
   git revert <commit-hash>
   git push
   ```

Current migration commits:
- f39aa65: Add album photo hooks
- 493144a: Add AlbumViewContainer component
- 2d85aaa: Migrate Index.tsx
- a54df67: Migrate CollectionDetail.tsx

---

## Sign-Off

- [ ] All Phase 1-2 tests pass
- [ ] No console errors
- [ ] Mobile tested on actual device (not just DevTools)
- [ ] Performance acceptable
- [ ] Ready for go-live

**Date Tested**: _______________
**Tested By**: _______________
**Status**: ⬜ Not Started | 🟡 In Progress | 🟢 Pass | 🔴 Fail
