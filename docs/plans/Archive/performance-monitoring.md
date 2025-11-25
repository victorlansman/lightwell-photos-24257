# Performance Monitoring

## Key Metrics

### PersonAlbum Page Load
- **Time to first photo**: Should be < 300ms
- **Time to lightbox ready**: Should be < 500ms
- **Blocked by**: Photo query only (not clusters)

### Timeline Page Load
- **Time to first photo**: Should be < 500ms
- **Time to scroll**: Should be < 100ms
- **Blocked by**: Photo query only

### People Gallery
- **Time to grid render**: May be 1-2s (loads all clusters)
- **Acceptable**: This is the one page that needs all data

## How to Measure

### Chrome DevTools
1. Open Network tab
2. Filter by "Fetch/XHR"
3. Navigate to page
4. Check waterfall:
   - `/photos?person_id=...` should complete first
   - `/people` and `/clusters` should NOT block page render

### React Query DevTools
1. Install React Query DevTools
2. Check query status:
   - `['photos', ...]` - should be fetching
   - `['cluster-metadata', ...]` - should be disabled on most pages

## Red Flags

❌ `/api/faces/clusters?collection_id=...` called on PersonAlbum page
❌ Lightbox blocked until clusters load
❌ Timeline page waits for clusters
