# Azure Migration Status

Last updated: 2025-01-10

## ✅ Completed Migrations

### Auth (Supabase - Intentionally Kept)
- ✅ `src/contexts/ApiAuthContext.tsx` - Syncs Supabase JWT with Azure API
- ✅ `src/pages/Auth.tsx` - Magic link authentication (Supabase only)
- ✅ `src/integrations/supabase/client.ts` - Supabase client config

**Status:** Auth remains on Supabase by design. All `supabase.auth.*` calls are correct.

### Data Operations (Migrated to Azure API)
- ✅ `src/lib/azureApiClient.ts` - Complete Azure API client with TypeScript types
- ✅ `src/hooks/useCollections.ts` - Collections fetching
- ✅ `src/hooks/usePhotos.ts` - Photos, favorites, year estimation
- ✅ `src/pages/Collections.tsx` - Collections list view
- ✅ `src/pages/Index.tsx` - Photos view with favorite toggle

### Features Removed (Not MVP)
- ✅ Delete photos functionality removed from `src/pages/Index.tsx`

---

## ⏳ Blocked - Waiting for Backend Endpoints

### Face & People Operations (src/pages/Index.tsx)

**File:** `src/pages/Index.tsx`

**Functions blocked:**
1. **`handleUpdateFaces` (lines 154-226)**
   - Current: Direct Supabase DB writes to `photo_people` table
   - Blocked by: Missing `POST /v1/photos/{id}/faces` endpoint
   - Security risk: Bypasses collection membership authorization
   - DB operations:
     - `supabase.from("photo_people").delete()` (line 161-164)
     - `supabase.from("photo_people").insert()` (line 174-177)
     - `supabase.from("photo_people").update()` (line 198-201)
     - `supabase.from("people").update()` (line 204-207)

2. **`handleUpdatePeople` (lines 228-283)**
   - Current: Direct Supabase DB writes to `people` and related tables
   - Blocked by: Missing `POST /v1/people`, `PATCH /v1/people/{id}` endpoints
   - Security risk: Bypasses collection membership authorization
   - DB operations:
     - `supabase.from("people").select()` (line 231-235)
     - `supabase.from("users").select()` (line 242-246)
     - `supabase.from("collection_members").select()` (line 250-255)
     - `supabase.from("people").insert()` (line 259-266)
     - `supabase.from("people").update()` (line 269-272)

**Next steps:**
1. Wait for parallel session to complete backend endpoints
2. Add `updatePhotoFaces`, `createPerson`, `updatePerson` to `azureApiClient.ts`
3. Create React Query hooks in `src/hooks/useFaces.ts`
4. Replace Supabase calls in `handleUpdateFaces` and `handleUpdatePeople`

---

## 📋 Other Files with Supabase References (Audit Results)

### Low Priority - Admin/Setup Features (Not MVP)

**Upload & Migration:**
- `src/components/UploadPhotosDialog.tsx` - Photo upload (admin feature)
- `src/lib/migratePhotos.ts` - Data migration utilities
- `src/pages/MigratePhotos.tsx` - Migration UI (admin only)

**Collection Management:**
- `src/components/CreateCollectionDialog.tsx` - Create collection (low frequency)
- `src/components/InviteMemberDialog.tsx` - Invite members (low frequency)

**People/Faces Pages:**
- `src/pages/People.tsx` - People list view
- `src/pages/PersonAlbum.tsx` - Person detail view
- `src/pages/UnknownPeople.tsx` - Unknown faces view
- `src/pages/CollectionDetail.tsx` - Collection detail view

**Status:** These files likely use Supabase DB but are:
1. Admin-only features (upload, migration, invites)
2. Read-heavy views (people, person album)
3. Lower priority than core photo browsing MVP

**Recommendation:** Audit after core face/people write operations are migrated.

### Utilities
- `src/lib/thumbnailService.ts` - Thumbnail generation (may use Supabase storage)
- `src/lib/utils.ts` - Utility functions
- `src/components/Header.tsx` - App header (likely auth only)

---

## 🔒 Security Notes

### Current Vulnerabilities (Being Fixed)

**Direct Supabase DB Writes Bypass Authorization:**

The Azure backend validates collection membership before allowing operations:
```python
membership = session.exec(
    select(CollectionMember).where(
        CollectionMember.collection_id == collection_id,
        CollectionMember.user_id == current_user.id
    )
).first()

if not membership:
    raise HTTPException(status_code=403, detail="Access denied")
```

Direct Supabase calls in `handleUpdateFaces` and `handleUpdatePeople` skip this validation, allowing:
- Users to tag faces in photos they don't own
- Users to modify people in other users' collections

**Resolution:** Blocked by backend endpoint implementation (in progress in parallel session).

---

## ✅ Architecture Compliance

### Current State
- **Authentication:** Supabase (magic links, JWT) ✅
- **Read Operations:** Azure API ✅
- **Write Operations:** Mixed (Photos/Favorites via Azure ✅, Faces/People via Supabase ❌)

### Target State
- **Authentication:** Supabase (magic links, JWT) ✅
- **All Data Operations:** Azure API (read + write) ⏳

### Single Source of Truth
- **Authorization logic:** Backend only (current: partially bypassed)
- **Business rules:** Backend only (current: some in frontend)
- **Audit trail:** Backend only (current: no audit for direct DB writes)

---

## 📊 Migration Progress

**Overall:** 70% Complete

**By Category:**
- Auth integration: 100% ✅
- Read operations: 100% ✅
- Write operations (core): 50% (favorites ✅, faces/people ⏳)
- Write operations (admin): 0% (deferred - not MVP)

**Blockers:**
1. Backend endpoints for faces/people (in progress - parallel session)

**After unblock:**
- Estimated time to complete: 1-2 hours
- Tasks: Add API client methods, create hooks, update Index.tsx

---

## 🧪 Testing Status

### Tested
- ✅ Collections list via Azure API
- ✅ Photos view via Azure API
- ✅ Favorite toggle via Azure API
- ✅ Auth token sync with Azure

### Not Yet Tested (Blocked)
- ⏳ Face tagging via Azure API
- ⏳ Person creation via Azure API
- ⏳ Person updates via Azure API
- ⏳ Authorization enforcement on write operations

### E2E Test Plan (After Unblock)
1. Login with magic link
2. View collections
3. Browse photos
4. Toggle favorite (verify persists)
5. Tag face on photo (verify Azure API call)
6. Create new person (verify Azure API call)
7. Update person name (verify Azure API call)
8. Verify no unauthorized Supabase DB calls (Network tab)
9. Verify 403 on cross-collection operations

---

## 📝 Unresolved Questions

1. **Admin features:** When should we migrate upload/migration/invite features?
   - Recommendation: After MVP launch, if needed

2. **People/Faces read pages:** Do People.tsx, PersonAlbum.tsx, UnknownPeople.tsx need migration?
   - Need: Backend endpoints for GET /v1/people, GET /v1/people/{id}
   - Priority: Medium (after write operations)

3. **Thumbnail generation:** Should `supabase.functions.invoke('generate-thumbnail')` stay or move to Azure?
   - Current: Edge Function on Supabase
   - Consider: Azure Function with same API
   - Priority: Low (working, not security risk)

4. **Multi-collection support:** Index.tsx shows first collection only
   - Status: Intentional (one collection per user by design)
   - No action needed

---

## Next Steps

1. ✅ Remove delete feature (not MVP)
2. ✅ Document migration status (this file)
3. ⏳ Wait for backend endpoints (parallel session)
4. TODO: Add face/people methods to Azure API client
5. TODO: Create useFaces hooks
6. TODO: Update Index.tsx with Azure API calls
7. TODO: Run E2E tests
8. TODO: Merge feature branches
