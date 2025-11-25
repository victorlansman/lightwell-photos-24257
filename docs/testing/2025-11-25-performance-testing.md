# Performance Refactor Testing Checklist

## Test PersonAlbum Page

### Named Person Album
- [ ] Navigate to `/people/{named-person-id}`
- [ ] Page renders immediately (no "Loading..." screen)
- [ ] Photos appear within 300ms
- [ ] Click photo → Lightbox opens immediately
- [ ] Face tags show person name
- [ ] Prev/next navigation works
- [ ] Network tab shows NO `/api/faces/clusters?collection_id=...` call

### Unnamed Cluster Album
- [ ] Navigate to `/people/{cluster-id}`
- [ ] Page renders immediately
- [ ] Photos appear within 300ms
- [ ] Header shows cluster photo count
- [ ] Click photo → Lightbox opens immediately
- [ ] Face tags show "Unknown"
- [ ] Network tab shows `/api/faces/clusters?ids={cluster-id}` (small payload)

## Test Timeline Page

- [ ] Navigate to `/`
- [ ] Timeline renders immediately
- [ ] Photos appear fast
- [ ] Scroll works smoothly
- [ ] Click photo → Lightbox opens immediately
- [ ] Network tab shows NO cluster query

## Test People Gallery

- [ ] Navigate to `/people`
- [ ] Grid loads (may take 1-2s - acceptable)
- [ ] All named people shown
- [ ] All unnamed clusters shown
- [ ] Click person/cluster → PersonAlbum loads fast

## Performance Regression Tests

- [ ] 500-photo collection: Timeline loads in < 1s
- [ ] Person with 5 photos: Page loads in < 300ms
- [ ] Cluster with 20 photos: Page loads in < 500ms
- [ ] Lightbox: Opens in < 100ms (not blocked)

## Edge Cases

- [ ] Empty collection: No errors
- [ ] Person with no photos: Shows "No photos"
- [ ] Cluster with 1 face: Loads correctly
- [ ] Photo with 10 faces: All faces render
