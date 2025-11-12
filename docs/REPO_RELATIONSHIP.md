# Repository Relationship Overview

## Repositories

### 1. Backend: image-annotation-tool
**Location:** `/Users/victor.lansman/Documents/Code/image-annotation-tool`
**Remote:** `minnamemories@dev.azure.com/minnamemories/Minna Memories/_git/mom2`
**Purpose:** FastAPI backend for photo management
**Latest commit:** 7211e21 migration: add albums and album_photos tables

**Structure:**
- `backend/src/backend/main.py` - FastAPI app
- `backend/src/backend/routers/` - API endpoints
  - collections.py
  - photos.py / photos_v2.py
  - faces.py
  - people.py
  - albums.py
  - auth_status.py
- `backend/src/backend/datamodel.py` - SQLModel schema
- `frontend/` - Earlier frontend iteration

**Deployed at:** `https://image-annotation-tool-api.azurewebsites.net`

### 2. Frontend: lightwell-photos-24257 (CURRENT)
**Location:** `/Users/victor.lansman/Documents/Code/lightwell-photos-24257`
**Remote:** `https://github.com/victorlansman/lightwell-photos-24257` (your fork)
**Upstream:** `https://github.com/virreminna/lightwell-photos-24257`
**Purpose:** React frontend for Minna Memories photo app
**Latest commit:** 255a760 - Full Azure integration merged to main

**Key files:**
- `src/lib/azureApiClient.ts` - Backend API client
- `src/hooks/useCollections.ts`, `useFaces.ts`, `usePeople.ts`, `usePhotos.ts`
- `src/pages/Settings.tsx` - NEW: Settings page with member management UI

**API Configuration:**
```typescript
const API_BASE_URL = 'https://image-annotation-tool-api.azurewebsites.net';
```

### 3. Frontend: lightwell-photos / frontend-azure-work
**Location:** 
- `/Users/victor.lansman/Documents/Code/lightwell-photos`
- `/Users/victor.lansman/Documents/Code/frontend-azure-work` (same repo, duplicate clone)
**Remote:** `https://github.com/victorlansman/lightwell-photos`
**Latest commit:** 30d830d Fix carousel and selection UI
**Status:** Older frontend work, possibly diverged from lightwell-photos-24257

## Backend API Coverage

### ✅ Existing Backend Endpoints

**Collections:**
- `GET /collections` - List user collections
- `GET /collections/{id}` - Get collection details
- `POST /collections` - Create collection
- `GET /collections/{id}/photos` - Get collection photos

**Photos:**
- `GET /photos` - List photos
- `GET /photos/{id}` - Get photo details
- Photo proxy endpoints for secure access

**Faces:**
- Face detection and tagging endpoints
- Face clustering

**People:**
- `GET /people` - List people in collection
- Person management

**Albums:**
- Album management (recently added)

### ❌ Missing Backend Endpoints

The Settings page you just built expects these endpoints that **DO NOT exist yet:**

```
GET /collections/{collectionId}/members
  → List members of a collection

POST /collections/{collectionId}/invite
  → Invite user to collection
  Body: { email, role: "owner|editor|viewer" }

DELETE /collections/{collectionId}/members/{userId}
  → Remove member from collection

PATCH /auth/profile
  → Change user email
  Body: { email: "new@email.com" }

DELETE /auth/account
  → Delete user account
  Body: { confirmation: "DELETE" }

GET /collections/{collectionId}/role
  → Get current user's role in collection
```

### 📊 Backend Data Model Support

The backend **DOES have** the data model for member management:

```python
class CollectionMember(BaseModel, table=True):
    collection_id: str
    user_id: str
    role: AppRole  # VIEWER, EDITOR, OWNER
    invited_by: Optional[str]
```

But the **API endpoints** to query/modify this table are not implemented yet.

## Current Status

### Frontend (lightwell-photos-24257)
✅ **Complete Azure integration:**
- API client configured
- All pages migrated (Collections, Photos, People, Faces)
- Settings page with member management UI
- Type-safe coordinate/ID systems
- React Query hooks

### Backend (image-annotation-tool)
⚠️ **Partially complete:**
- Core APIs exist (collections, photos, faces, people, albums)
- Member data model exists in database
- **Missing:** Member management API endpoints
- **Missing:** Account settings endpoints

## Next Steps

### To complete Settings page functionality:

1. **Add backend endpoints** in `image-annotation-tool/backend/src/backend/routers/`:

   **Option A:** Add to `collections.py`:
   ```python
   @router.get("/{collection_id}/members")
   async def list_collection_members(...)
   
   @router.post("/{collection_id}/invite")
   async def invite_member(...)
   
   @router.delete("/{collection_id}/members/{user_id}")
   async def remove_member(...)
   ```

   **Option B:** Create new `members.py` router

2. **Add account endpoints** in new `account.py` router:
   ```python
   @router.patch("/profile")
   async def update_email(...)
   
   @router.delete("/account")
   async def delete_account(...)
   ```

3. **Deploy backend** to Azure

4. **Frontend will automatically work** - it's already configured with placeholder toasts that will activate once endpoints are live

## Summary

**The frontend (lightwell-photos-24257) is AHEAD of the backend:**
- Frontend has full Settings UI for member management
- Backend has the database schema but not the API endpoints
- Frontend gracefully handles this with "Not yet implemented" messages

**The repos ARE connected:**
- Frontend → Backend via `https://image-annotation-tool-api.azurewebsites.net`
- They share the same auth system (Supabase JWT tokens)
- Data models align (collections, photos, faces, people)
- Just missing the member management & account settings API layer
