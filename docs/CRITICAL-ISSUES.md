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

## Issue 3: Delete Account Not Working ⚠️ BY DESIGN

### Problem
User clicks "Delete My Account" but can still log in afterward. Account not deleted.

### Current Behavior
**File:** `src/pages/Settings.tsx` lines 196-209
```typescript
onClick={async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Sign out first
    await supabase.auth.signOut();  // ✅ Only signs out

    toast({
      title: "Account deletion requested",
      description: "Please contact support to complete account deletion.",  // ⚠️ Requires manual support
    });

    navigate("/auth");
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  }
}}
```

### Design Decision Required

**Option A: Keep Manual Deletion (Current)**
- Pros: Safe, prevents accidental deletion, allows recovery
- Cons: User frustration, not self-service
- Implementation: No change needed

**Option B: Implement Automatic Deletion**
- Pros: Self-service, immediate feedback
- Cons: Irreversible, potential for regret
- Implementation: Requires backend endpoint + Supabase admin call

### If Choosing Option B - Implementation Plan

#### Backend Changes Required

**Create new endpoint:**
```python
# File: /backend/src/backend/routers/auth.py

@router.delete("/v1/auth/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Permanently delete user account and all associated data.
    """
    # 1. Delete user's face tags
    session.exec(delete(FaceTag).where(FaceTag.person_id.in_(
        select(Person.id).where(Person.collection_id.in_(
            select(CollectionMember.collection_id).where(
                CollectionMember.user_id == current_user.id
            )
        ))
    )))

    # 2. Delete user's people
    session.exec(delete(Person).where(Person.collection_id.in_(
        select(CollectionMember.collection_id).where(
            CollectionMember.user_id == current_user.id
        )
    )))

    # 3. Delete collection memberships
    session.exec(delete(CollectionMember).where(
        CollectionMember.user_id == current_user.id
    ))

    # 4. Delete from Supabase Auth
    supabase_admin.auth.admin.delete_user(current_user.supabase_user_id)

    # 5. Delete local user record
    session.delete(current_user)
    session.commit()

    return {"message": "Account deleted successfully"}
```

#### Frontend Changes Required

**File:** `src/lib/azureApiClient.ts`
```typescript
async deleteAccount(): Promise<void> {
  return this.request('/v1/auth/delete-account', {
    method: 'DELETE',
  });
}
```

**File:** `src/pages/Settings.tsx`
```typescript
import { azureApi } from '@/lib/azureApiClient';

// In delete handler:
onClick={async () => {
  try {
    // Call backend to actually delete
    await azureApi.deleteAccount();

    // Sign out
    await supabase.auth.signOut();

    toast({
      title: "Account deleted",
      description: "Your account has been permanently deleted.",
    });

    navigate("/auth");
  } catch (error: any) {
    toast({
      title: "Error deleting account",
      description: error.message,
      variant: "destructive",
    });
  }
}}
```

**Status:** ⚠️ Design decision needed
**Decision Required From:** Product/Victor

---

## Summary & Next Actions

### Frontend (Me)
- ✅ Fixed magic link redirect issue
- ⏸️ Awaiting decision on delete account design
- ✅ All invite UI components working

### Backend/DevOps Team
- 🔴 **URGENT:** Configure Supabase Edge Function environment variables
  - `APP_URL=https://icy-stone-0bca71103.3.azurestaticapps.net`
  - `RESEND_API_KEY=re_xxxxx...`
- ⏸️ Implement delete account endpoint (if Option B chosen)
- ⏸️ Fix auto-accept bug (always create pending_invite, never auto-add members)

### Testing Priority
1. Test magic link after frontend deploy (should work now)
2. Test invite emails after Edge Function configured
3. Test full invite flow after both fixed
4. Test delete account after design decision

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
