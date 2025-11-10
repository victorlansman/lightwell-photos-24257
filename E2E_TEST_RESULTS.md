# E2E Testing Results - 2025-01-11

## Testing Instructions

1. Ensure backend is running: `cd ~/Documents/Code/image-annotation-tool/backend && uvicorn src.backend.main:app --reload --port 8000`
2. Ensure frontend is running: `cd ~/Documents/Code/lightwell-photos-24257 && npm run dev`
3. Open browser to http://localhost:8080
4. Check each item below by marking with [x] when verified
5. Document any issues found in the "Issues Found" section below

## Testing Checklist

### Authentication
- [N/A] Login with magic link (only password auth in test environment)
- [✅] Session persists on refresh (UI state like zoom resets - expected)
- [✅] Logout works
- [✅] Console shows: "[ApiAuth] Setting Azure API token"

### Collections
- [ ✅] View collections list
- [ ❌] Click collection → see photos --> no, clicking the collection takes me to http://localhost:8080/collections/4bd25a1d-0efc-459d-9945-5aa09c5ead27 which is stuck loading. browser console: @supabase_supabase-js.js?v=063145d2:5597  GET https://qscugaoorkdxjplkfufl.supabase.co/rest/v1/users?select=id&supabase_user_id=eq.9a00609c-c879-4024-8650-ef188ea7afab 404 (Not Found)
(anonymous) @ @supabase_supabase-js.js?v=063145d2:5597
(anonymous) @ @supabase_supabase-js.js?v=063145d2:5615
await in (anonymous)
then @ @supabase_supabase-js.js?v=063145d2:85Understand this err
- [ ❌] API call to localhost:8000/v1/collections

### Photos
- [ ] Photos load from Azure API --> don't know how to confirm but they load on http://localhost:8080/
- [ ] Thumbnails display correctly --> don't know how to confirm but images show up (we haven't confirmed that thumbnails and images are different yet - need new photos in the database to confirm that)
- [ ] Full resolution in lightbox --> see above, untestable
- [ ] Toggle favorite works --> Yes, consistent across sessions
- [ ] Favorite persists after refresh --> Yes, consistent across logout login in different window
- [ ] Network: POST /v1/photos/{id}/favorite --> I think so, network response "{"message":"Photo added to favorites","is_favorited":true}" 

### Photo Security
**IMPORTANT:** Blob URLs (blob:http://localhost:...) are expected and secure (client-side only).
**Test the BACKEND endpoint** to verify security:
1. Open DevTools Network tab
2. Find request: GET /v1/photos/{id}/image?thumbnail=true
3. Copy URL (http://localhost:8000/v1/photos/...)
4. Open incognito window
5. Paste URL → Should get 401 Unauthorized

- [ ] Photos load via /v1/photos/{id}/image (check Network tab)
- [ ] Thumbnails use ?thumbnail=true
- [ ] Download gets full resolution
- [ ] No SAS URLs in network tab (only backend URLs + blob URLs)
- [ ] Backend photo URL in incognito WITHOUT token = 401 ✅

Can't tell
Request initiator chain
http://localhost:8080/
http://localhost:8080/src/main.tsx?t=1762779071388
http://localhost:8080/node_modules/.vite/deps/react-dom_client.js?v=063145d2
http://localhost:8080/node_modules/.vite/deps/chunk-W6L2VRDA.js?v=063145d2
blob:http://localhost:8080/c1d39140-2bcc-47db-a8a5-0565be54d0ce

### Face Tagging
- [ ✅] Open photo lightbox 
- [❌ ] Add face tag (unknown person)
- [❌ ] Name unknown person → creates person
- [❌ ] Face tag persists after refresh
- [ ] Network: POST /v1/photos/{id}/faces --> dont know
- [ ] Network: POST /v1/people --> don't know

No!
:8000/v1/photos/77e47ec8-8b18-4704-b797-024b6ea770ef/faces:1  Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)Understand this error
azureApiClient.ts:176 API Error [/v1/photos/77e47ec8-8b18-4704-b797-024b6ea770ef/faces]: Error: HTTP 422: Unprocessable Entity
    at AzureApiClient.request (azureApiClient.ts:166:15)
request @ azureApiClient.ts:176Understand this error
azureApiClient.ts:156  POST http://localhost:8000/v1/photos/77e47ec8-8b18-4704-b797-024b6ea770ef/faces 422 (Unprocessable Entity)
request @ azureApiClient.ts:156
updatePhotoFaces @ azureApiClient.ts:302
mutationFn @ useFaces.ts:12
fn @ @tanstack_react-query.js?v=063145d2:1236
run @ @tanstack_react-query.js?v=063145d2:513
start @ @tanstack_react-query.js?v=063145d2:555
execute @ @tanstack_react-query.js?v=063145d2:1272
await in execute
mutate @ @tanstack_react-query.js?v=063145d2:2692
(anonymous) @ @tanstack_react-query.js?v=063145d2:3415
handleUpdateFaces @ Index.tsx:175
(anonymous) @ Lightbox.tsx:284
basicStateReducer @ chunk-W6L2VRDA.js?v=063145d2:11703
updateReducer @ chunk-W6L2VRDA.js?v=063145d2:11794
updateState @ chunk-W6L2VRDA.js?v=063145d2:12021
useState @ chunk-W6L2VRDA.js?v=063145d2:12753
useState @ chunk-ZMLY2J2T.js?v=063145d2:1066
Lightbox @ Lightbox.tsx:44
renderWithHooks @ chunk-W6L2VRDA.js?v=063145d2:11548
updateFunctionComponent @ chunk-W6L2VRDA.js?v=063145d2:14582
beginWork @ chunk-W6L2VRDA.js?v=063145d2:15924
beginWork$1 @ chunk-W6L2VRDA.js?v=063145d2:19753
performUnitOfWork @ chunk-W6L2VRDA.js?v=063145d2:19198
workLoopSync @ chunk-W6L2VRDA.js?v=063145d2:19137
renderRootSync @ chunk-W6L2VRDA.js?v=063145d2:19116
performSyncWorkOnRoot @ chunk-W6L2VRDA.js?v=063145d2:18874
flushSyncCallbacks @ chunk-W6L2VRDA.js?v=063145d2:9119
(anonymous) @ chunk-W6L2VRDA.js?v=063145d2:18627Understand this error
azureApiClient.ts:176 API Error [/v1/photos/77e47ec8-8b18-4704-b797-024b6ea770ef/faces]: Error: HTTP 422: Unprocessable Entity
    at AzureApiClient.request (azureApiClient.ts:166:15)


### Person Management --> untestable due to tagging issues
- [ ] Rename person
- [ ] Person name updates across all photos
- [ ] Network: PATCH /v1/people/{id}

### Authorization --> don't konw how to test
- [ ] Cannot access other user's collections (403)
- [ ] Cannot tag faces in other collections (403)
- [ ] Cannot create person in other collection (403)

### No Supabase DB Writes --< don't know how to test
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
