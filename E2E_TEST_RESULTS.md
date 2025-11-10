# E2E Testing Results - 2025-01-11

## Testing Instructions

1. Ensure backend is running: `cd ~/Documents/Code/image-annotation-tool/backend && uvicorn src.backend.main:app --reload --port 8000`
2. Ensure frontend is running: `cd ~/Documents/Code/lightwell-photos-24257 && npm run dev`
3. Open browser to http://localhost:8080
4. Check each item below by marking with [x] when verified
5. Document any issues found in the "Issues Found" section below

## Testing Checklist

### Authentication
- [ ] Login with magic link
- [ ] Session persists on refresh
- [ ] Logout works
- [ ] Console shows: "[ApiAuth] Setting Azure API token"

### Collections
- [ ] View collections list
- [ ] Click collection → see photos
- [ ] API call to localhost:8000/v1/collections

### Photos
- [ ] Photos load from Azure API
- [ ] Thumbnails display correctly
- [ ] Full resolution in lightbox
- [ ] Toggle favorite works
- [ ] Favorite persists after refresh
- [ ] Network: POST /v1/photos/{id}/favorite

### Photo Security
- [ ] Photos load via /v1/photos/{id}/image
- [ ] Thumbnails use ?thumbnail=true
- [ ] Download gets full resolution
- [ ] No SAS URLs in network tab
- [ ] Opening photo URL in incognito WITHOUT token = 401

### Face Tagging
- [ ] Open photo lightbox
- [ ] Add face tag (unknown person)
- [ ] Name unknown person → creates person
- [ ] Face tag persists after refresh
- [ ] Network: POST /v1/photos/{id}/faces
- [ ] Network: POST /v1/people

### Person Management
- [ ] Rename person
- [ ] Person name updates across all photos
- [ ] Network: PATCH /v1/people/{id}

### Authorization
- [ ] Cannot access other user's collections (403)
- [ ] Cannot tag faces in other collections (403)
- [ ] Cannot create person in other collection (403)

### No Supabase DB Writes
- [ ] Network tab: NO calls to supabase.co/rest/v1/
- [ ] Network tab: Only supabase.co/auth/v1/ (auth only)
- [ ] Console: No "supabase.from" errors

## Issues Found

### Issue 1
**Description:**
**Steps to reproduce:**
**Expected behavior:**
**Actual behavior:**
**Priority:** [ ] Critical [ ] High [ ] Medium [ ] Low
**Status:** [ ] Open [ ] Fixed [ ] Won't Fix

### Issue 2
**Description:**
**Steps to reproduce:**
**Expected behavior:**
**Actual behavior:**
**Priority:** [ ] Critical [ ] High [ ] Medium [ ] Low
**Status:** [ ] Open [ ] Fixed [ ] Won't Fix

## Test Summary

**Date Completed:**
**Tester:**
**Overall Status:** [ ] Pass [ ] Pass with Issues [ ] Fail
**Notes:**
