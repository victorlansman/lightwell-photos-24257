# Backend Bug: Face Thumbnail 404 Errors

## Issue
`/api/faces/{faceId}/thumbnail` returns 404 with error message:
```json
{"detail": "Photo has no associated master image"}
```

## Impact
- Cluster `representative_thumbnail_url` points to face thumbnails that fail
- Frontend shows blank thumbnails on /people page
- All photos exist in collection - this is NOT an orphaned photo issue

## Example Failing Request
```
GET https://image-annotation-tool-api.azurewebsites.net/api/faces/ed4e065d-2b58-4a54-b0fe-02903eb43483/thumbnail
Status: 404
Response: {"detail":"Photo has no associated master image"}
```

## Expected Behavior
1. Backend should only set `representative_thumbnail_url` to faces that have valid master images
2. OR `/api/faces/{faceId}/thumbnail` should handle missing master images gracefully (return placeholder or 200 with error indication)
3. OR face records with missing master images should be cleaned up/marked invalid

## Current Frontend Workaround
Frontend falls back to fetching full photo thumbnail if face thumbnail fails. This works but:
- Loses pre-cropped face benefit backend provides
- Hides the backend bug
- Uses more bandwidth (full photo vs cropped face)

## Backend Fix Needed
Investigate why face `ed4e065d-2b58-4a54-b0fe-02903eb43483` and potentially others have no associated master image when:
1. All photos exist in the collection
2. The face records exist in the database
3. The face thumbnails are being generated/referenced

Likely causes to check:
- Master image path not set during face detection
- Master image cleanup removing images still referenced by faces
- Incorrect foreign key constraints between faces and photos
- Photo deletion not cascading to face records properly
