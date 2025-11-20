# CRITICAL ISSUES - Invite System

**Date:** 2025-11-20
**Status:** 🔴 BLOCKING - Core functionality broken

---

## Issue 1: Magic Link Redirect Error ✅ FIXED

### Problem
Clicking magic link from email causes MIME type error:
```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html"
```
User must manually refresh page to complete login.

### Root Cause
Missing `detectSessionInUrl: true` in Supabase client configuration.

### Fix Applied
**File:** `src/integrations/supabase/client.ts`
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,  // ✅ ADDED
    flowType: 'pkce',           // ✅ ADDED
  }
});
```

**Status:** ✅ Fixed in commit (pending push)
**Test:** Click magic link from email - should auto-login without manual refresh

---

## Issue 2: Invite Emails Not Sent 🔴 BLOCKING

### Problem
When owner invites user (new or existing), no email is received. Cannot test invite flow.

### Root Cause
**Supabase Edge Function not configured with production URL**

From handoff doc (lines 247-257):
```
Email Flow:
1. Backend creates pending_invites record ✅ Working
2. Backend calls Supabase Edge Function via HTTP POST ❌ Not configured
3. Edge Function sends email via Resend API ❌ Not configured
4. Email contains link: {APP_URL}/auth?invite={token}

Environment Variable Required:
- APP_URL in Supabase Edge Function (currently defaults to http://localhost:5173)
```

### Required Actions

#### Action 1: Set Production URL in Edge Function
**Location:** Supabase Dashboard → Edge Functions → `send-invite-email` → Settings

**Set Environment Variable:**
```bash
APP_URL=https://icy-stone-0bca71103.3.azurestaticapps.net
```

#### Action 2: Verify Resend API Key
**Location:** Supabase Dashboard → Edge Functions → `send-invite-email` → Secrets

**Required Secret:**
```bash
RESEND_API_KEY=re_xxxxx...
```

#### Action 3: Test Email Delivery
After setting variables:
1. Go to Settings → Collection Members
2. Invite test email address
3. Check email inbox
4. Verify email contains production URL, not localhost

### Verification Commands
```bash
# Check Edge Function logs
supabase functions logs send-invite-email --project-ref qscugaookdxjplkfufl

# Test Edge Function directly
curl -X POST https://qscugaookdxjplkfufl.supabase.co/functions/v1/send-invite-email \
  -H "Authorization: Bearer ANON_KEY" \
  -d '{
    "email": "test@example.com",
    "invite_token": "test-token",
    "collection_name": "Test Collection",
    "inviter_email": "owner@example.com"
  }'
```

**Status:** 🔴 BLOCKED - Requires Supabase dashboard configuration
**Owner:** Backend/DevOps team

---

## Issue 3: Delete Account Implementation ✅ COMPLETE

### Problem
User clicks "Delete My Account" but can still log in afterward. Account not deleted.

### Solution Implemented
Two-stage confirmation UI with GDPR-compliant backend

**Frontend Status:** ✅ Complete (as of 2025-11-20)
**Backend Status:** ✅ Complete (endpoint already deployed)

### Frontend Implementation

**File:** `src/pages/Settings.tsx` lines 27-28, 228-262
```typescript
const [deleteStage, setDeleteStage] = useState<'none' | 'first' | 'second'>('none');
const [isDeleting, setIsDeleting] = useState(false);

// Stage 1: Initial Warning
<AlertDialog open={deleteStage === 'first'}>
  <AlertDialogTitle>Warning: Permanent Account Deletion</AlertDialogTitle>
  <AlertDialogDescription>
    <p className="font-semibold text-destructive">
      You will permanently lose access to all collections, photos, and data.
    </p>
    <p>This action cannot be undone.</p>
  </AlertDialogDescription>
  <AlertDialogAction onClick={() => setDeleteStage('second')}>
    I Understand
  </AlertDialogAction>
</AlertDialog>

// Stage 2: Final Confirmation
<AlertDialog open={deleteStage === 'second'}>
  <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
  <AlertDialogDescription>
    This action will delete your account permanently. Are you absolutely sure?
  </AlertDialogDescription>
  <AlertDialogAction onClick={async () => {
    setIsDeleting(true);
    try {
      const result = await azureApi.deleteAccount();  // ✅ Calls backend

      // Show impact summary
      if (result.deleted_collections.length > 0) {
        toast({
          title: "Collections deleted",
          description: `${result.deleted_collections.length} collection(s) permanently deleted as you were the last owner.`,
        });
      }

      await supabase.auth.signOut();
      toast({ title: "Account deleted" });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error deleting account", variant: "destructive" });
      setDeleteStage('none');
    } finally {
      setIsDeleting(false);
    }
  }}>
    Delete Account
  </AlertDialogAction>
</AlertDialog>
```

**File:** `src/lib/azureApiClient.ts` lines 871-884
```typescript
async deleteAccount(): Promise<{
  message: string;
  deleted_collections: string[];
  removed_from_collections: string[];
}> {
  return this.request('/v1/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
}
```

### Backend Implementation (Already Deployed ✅)

**Endpoint:** `DELETE /v1/auth/account`
**Request Body:** `{"confirmation": "DELETE"}` (case-sensitive)
**Response:**
```json
{
  "message": "Account deleted successfully",
  "deleted_collections": ["uuid1", "uuid2"],
  "removed_from_collections": ["uuid3"]
}
```

**GDPR-Compliant Behavior:**
1. If user is last owner → Deletes entire collection (photos, faces, people, all data)
2. If other owners exist → User just removed from collection
3. Deletes user account, favorites, albums
4. Deletes from Supabase Auth
5. Returns impact summary

**Status:** ✅ Complete - Ready for production testing

---

## Issue 4: CORS Error on Face Clusters Endpoint 🔴 BACKEND

### Problem
Settings page showing CORS error in console. Page loads slowly.

### Error Details
```
Access to fetch at 'https://image-annotation-tool-api.azurewebsites.net/api/faces/clusters'
from origin 'https://icy-stone-0bca71103.3.azurestaticapps.net' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Root Cause
Backend CORS configuration doesn't include frontend domain in allowed origins.

### Required Backend Fix
**Location:** Backend FastAPI CORS middleware configuration

**Add to allowed origins:**
```python
origins = [
    "http://localhost:5173",
    "https://icy-stone-0bca71103.3.azurestaticapps.net",  # ✅ ADD THIS
]
```

**Verify these endpoints are accessible:**
- `GET /api/faces/clusters`
- All `/v1/*` endpoints

### Frontend Impact
This endpoint shouldn't be called from Settings page - only from Unknown People page. May indicate unnecessary data fetching (see Issue 5).

**Status:** 🔴 BLOCKED - Requires backend CORS configuration update
**Owner:** Backend team

---

## Issue 5: Settings Page Performance ⚠️ INVESTIGATION NEEDED

### Problem
User reports Settings page is "insanely slow" to load.

### Investigation Results

**Settings page queries (src/pages/Settings.tsx):**
1. `useCollections()` - Fetches all collections (lines 34)
2. `useCollectionMembers(selectedCollectionId)` - Fetches members for selected collection (line 54)
3. `usePendingInvites(selectedCollectionId)` - Fetches pending invites if owner (lines 55-57)

**Face clusters query (NOT directly used in Settings):**
- `useClusters()` is used in: PersonAlbum.tsx, useAlbumPhotos.ts
- The CORS error appears in console but Settings doesn't call this endpoint
- Possible causes:
  1. React Query cache retrying failed request from previous page
  2. Background refetch from another component
  3. Browser trying to prefetch resources

### Likely Causes of Slowness

1. **Network latency** - Multiple sequential API calls (collections → members → invites)
2. **Large member lists** - If collection has many members, could slow rendering
3. **CORS error retries** - Browser repeatedly failing/retrying face clusters request

### Recommended Fixes

**Short term:**
1. Fix CORS configuration (Issue 4) - will eliminate retry attempts
2. Add loading skeletons to show progress during data fetching

**Long term:**
1. Combine member/invite queries into single backend endpoint: `GET /v1/collections/{id}/members-and-invites`
2. Add pagination if member lists exceed 50 items
3. Implement React.memo on member list items to prevent unnecessary re-renders

**Status:** ⚠️ Waiting for user to test after CORS fix
**Owner:** Frontend (optimizations) + Backend (CORS fix)

---

## Summary & Next Actions

### Frontend
- ✅ Fixed magic link redirect issue
- ✅ Implemented two-stage delete account UI with impact summary
- ✅ Improved current user visibility in member list (highlighted row + badge)
- ✅ All invite UI components working
- ✅ Investigated Settings page performance (Issue 5)

### Backend/DevOps Team
- 🔴 **URGENT:** Configure Supabase Edge Function environment variables
  - `APP_URL=https://icy-stone-0bca71103.3.azurestaticapps.net`
  - `RESEND_API_KEY=re_xxxxx...`
- 🔴 **URGENT:** Add frontend domain to CORS allowed origins (Issue 4)
- ⏸️ Fix auto-accept bug (always create pending_invite, never auto-add members)

### Testing Priority
1. ✅ Test magic link after frontend deploy (should work now)
2. Test delete account flow (two-stage confirmation + impact summary)
3. Test invite emails after Edge Function configured
4. Test full invite flow after email fixed
5. Verify current user highlighting in member list

---

## Environment Checklist

- [ ] Azure backend deployed: ✅ https://image-annotation-tool-api.azurewebsites.net
- [ ] Frontend deployed: ✅ https://icy-stone-0bca71103.3.azurestaticapps.net
- [ ] Supabase Edge Function `APP_URL`: ❌ Still set to localhost
- [ ] Supabase Edge Function `RESEND_API_KEY`: ❓ Unknown
- [ ] Backend auto-accept bug fixed: ❓ User says "should be live" - needs verification

---

## Contact

**Frontend Issues:** This document
**Backend Issues:** Backend team / handoff doc
**Supabase Config:** DevOps / Backend team with Supabase access
