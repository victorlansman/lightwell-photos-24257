# Invite System Test Plan

## Current Issues (Before Backend Fix)

### ⚠️ **BLOCKING ISSUE - Backend Auto-Accept**
The backend currently auto-adds existing users without sending emails or requiring terms acceptance. This breaks the intended flow.

**Backend Fix Required:**
- File: `/backend/src/backend/routers/collections.py` (invite endpoint)
- Change: Always create `pending_invite` (never auto-create membership)
- Change: Always send email via Supabase Edge Function
- Result: All invites require email link + terms acceptance

---

## Test Environment Setup

### Prerequisites
- [ ] Azure backend deployed to production
- [ ] Supabase Edge Function `APP_URL` set to production URL
- [ ] Test with 2+ email addresses you control
- [ ] Clear browser cache before testing (avoid stale builds)

### Test Users Needed
1. **Alice** - Collection owner (your primary account)
2. **Bob** - New user (never signed up)
3. **Charlie** - Existing user (already has account)

---

## Use Case 1: Owner Sends Invite to New User

### Flow: Collection Owner → Settings → Invite Form

**Test Steps:**

1. **Sign in as Alice (Owner)**
   - Go to https://icy-stone-0bca71103.3.azurestaticapps.net/auth
   - Use magic link login (primary method)
   - Enter email → Click "Send magic link"
   - Check email → Click magic link
   - ✅ Should redirect to home page and be logged in

2. **Navigate to Settings**
   - Click Settings in sidebar
   - Click "Collection Members" tab
   - ✅ Should see collection selector at top

3. **Select Collection**
   - Choose collection from dropdown
   - ✅ Should show current members list
   - ✅ Should highlight "you" next to your own email
   - ✅ Should show "Pending Invites" section (if owner)
   - ✅ Should show "Invite New Member" form

4. **Send Invite to New User (Bob)**
   - Enter Bob's email: `bob@example.com`
   - Select role: "Viewer"
   - Click "Send Invite"
   - ✅ Should show toast: "An invite email has been sent to bob@example.com"
   - ✅ Should see Bob appear in "Pending Invites" section with expiry countdown
   - ✅ Bob should receive email with invite link

**Expected Email Content:**
```
Subject: You've been invited to [Collection Name]

[Inviter] has invited you to join [Collection Name] on Lightwell Photos.

[Click here to accept invitation]

This invitation expires in 7 days.
```

**Failure Modes:**
- ❌ If Bob instantly appears in Active Members (not Pending Invites) → Backend auto-accept bug
- ❌ If no email sent → Edge Function not configured or failing
- ❌ If Settings page crashes → Clear browser cache (AlertDialog import fix)

---

## Use Case 2: New User Accepts Invite

### Flow: Email Link → Auth → Terms Acceptance → Home

**Test Steps:**

1. **Click Invite Link from Email**
   - Open Bob's email
   - Click invitation link
   - ✅ Should redirect to: `https://icy-stone-0bca71103.3.azurestaticapps.net/auth?invite={token}`

2. **View Invite Preview**
   - ✅ Should see blue card at top: "You've Been Invited!"
   - ✅ Should show collection name, inviter email, and role
   - ✅ Page heading should say "Sign In to Accept"

3. **Sign Up with Magic Link**
   - Enter Bob's email in magic link form
   - Click "Send magic link"
   - ✅ Should show toast: "Check your email! We sent you a magic link to sign in."
   - Check Bob's email → Click magic link

4. **Handle Magic Link Redirect**
   - After clicking magic link, might briefly see blank page with token in URL
   - ✅ Should automatically parse token and redirect to invite acceptance page
   - URL should change to: `/invite/{token}/accept`

   **If stuck on blank page:** Refresh browser or try link again (known Supabase quirk)

5. **Review Terms**
   - ✅ Should see "Collection Invitation" page
   - ✅ Should show collection name and your assigned role
   - ✅ Should display terms: "By joining [Collection Name], you agree to view and share photos within this collection."
   - ✅ Should show "Accept & Join" and "Decline" buttons
   - ✅ Should show expiry date at bottom

6. **Accept Invitation**
   - Click "Accept & Join"
   - ✅ Should show toast: "Successfully joined collection! You are now a member of [Collection Name]"
   - ✅ Should redirect to home page (`/`)
   - ✅ Should see the new collection in collections list

7. **Verify Membership (as Bob)**
   - Click into the collection
   - ✅ Should see all photos
   - Navigate to Settings → Collection Members
   - ✅ Should see yourself in Active Members as "Viewer"
   - ✅ Should see "you" next to your email
   - ✅ Should NOT see "Invite New Member" form (not owner)
   - ✅ Should NOT see "Pending Invites" section (not owner)
   - ✅ Should see read-only message: "Only collection owners can invite new members."

8. **Verify from Alice's Perspective**
   - Sign back in as Alice (owner)
   - Go to Settings → Collection Members → Select collection
   - ✅ Bob should appear in "Active Members" (NOT "Pending Invites")
   - ✅ Bob's role should be "Viewer"
   - ✅ "Pending Invites" section should be empty or not show Bob anymore

---

## Use Case 3: Owner Invites Existing User

### Flow: Same as Use Case 1, but user already has account

**Test Steps:**

1. **Sign in as Alice, send invite to Charlie**
   - Charlie has existing account: `charlie@example.com`
   - Follow steps from Use Case 1
   - ✅ Should send email (NOT auto-add to collection)
   - ✅ Charlie should appear in "Pending Invites"

2. **Charlie accepts invite**
   - Charlie clicks email link
   - ✅ Should see Auth page with invite preview
   - Charlie signs in with magic link (already has account)
   - ✅ Should redirect to `/invite/{token}/accept`
   - ✅ Should see terms acceptance page
   - Charlie clicks "Accept & Join"
   - ✅ Should join collection and redirect to home

**Current Bug:** Backend auto-adds Charlie without email/terms flow. After backend fix, this should work correctly.

---

## Use Case 4: Owner Manages Members

### Flow: Settings → Collection Members → Change Roles / Remove

**Test Steps:**

1. **Change Member Role**
   - Sign in as Alice (owner)
   - Go to Settings → Collection Members
   - Select collection that has Bob (viewer)
   - ✅ Should see role dropdown next to Bob's email
   - Change Bob's role from "Viewer" to "Admin"
   - ✅ Should show toast: "bob@example.com's role changed to admin"
   - ✅ Role should update in UI immediately

2. **Verify Bob Sees New Permissions**
   - Sign in as Bob
   - Navigate around (check if admin permissions apply)
   - ✅ Should have admin-level access

3. **Remove Member**
   - Sign in as Alice (owner)
   - Go to Settings → Collection Members
   - Click remove icon (trash/X) next to Bob
   - ✅ Should show confirmation dialog: "Remove member? Remove bob@example.com from this collection? They will lose access to all photos."
   - Click "Remove"
   - ✅ Should show toast: "Member removed. bob@example.com has been removed from the collection"
   - ✅ Bob should disappear from Active Members list

4. **Verify Bob Lost Access**
   - Sign in as Bob
   - ✅ Collection should NOT appear in Bob's collections list
   - ✅ Bob cannot access collection URLs directly

**Owner Protection Rules:**
- ✅ Cannot remove other owners (only yourself)
- ✅ Cannot remove yourself if you're the last owner
- ✅ Cannot change other owners' roles

---

## Use Case 5: Cancel Pending Invite

### Flow: Settings → Pending Invites → Cancel

**Test Steps:**

1. **Send Invite**
   - Sign in as Alice
   - Invite new user: `dana@example.com`
   - ✅ Dana appears in "Pending Invites"

2. **Cancel Invite**
   - Click X icon next to Dana's pending invite
   - ✅ Should show confirmation: "Cancel invitation? Cancel the invitation to dana@example.com? They will not be able to join using the existing invite link."
   - Click "Cancel Invite"
   - ✅ Should show toast: "Invite cancelled. Invitation to dana@example.com has been cancelled"
   - ✅ Dana should disappear from Pending Invites

3. **Verify Invite Token Invalid**
   - Try to use Dana's original invite link
   - ✅ Should show error: "Invalid Invitation. This invitation link is invalid or has been cancelled."

---

## Use Case 6: Expired Invite Handling

### Flow: Wait 7 days or manually expire in DB

**Test Steps:**

1. **Attempt to Use Expired Invite**
   - Get invite link that's >7 days old (or manually set `expires_at` in DB)
   - Click expired invite link
   - ✅ Should redirect to `/auth?invite={token}`
   - ✅ Should show red error card: "Invite Expired"
   - ✅ Should show: "You were invited to [Collection] by [Email]"
   - ✅ Should show: "Please contact the person who invited you to request a new invitation link."
   - ✅ Should have "Continue to Sign In" button

2. **Continue to Regular Auth**
   - Click "Continue to Sign In"
   - ✅ Should go to normal auth page (no invite preview)

---

## Use Case 7: Magic Link Login (Primary Auth Method)

### Flow: Auth Page → Email → Magic Link → Login

**Test Steps:**

1. **Request Magic Link**
   - Go to `/auth`
   - Enter email in top form (magic link section)
   - Click "Send magic link"
   - ✅ Should show toast: "Check your email! We sent you a magic link to sign in."

2. **Check Email**
   - ✅ Should receive email: "Magic Link - Lightwell Photos"
   - ✅ Email should have login link

3. **Click Magic Link**
   - Click link from email
   - ✅ Should redirect to site with token in URL hash: `#access_token=...&type=magiclink`
   - ✅ Should automatically parse and redirect to home
   - ✅ Should be logged in

**Known Issue:** Sometimes briefly shows blank page with token in URL
- **Workaround:** Refresh page or try again
- **Cause:** Supabase hash fragment parsing timing
- **Impact:** Low - usually works on retry

4. **With Invite Token**
   - Start at `/auth?invite={token}` (from invite email)
   - Use magic link login
   - ✅ After login, should redirect to `/invite/{token}/accept` (not home)

---

## Use Case 8: Password Login (Fallback Method)

### Flow: Auth Page → Password Form → Login

**Test Steps:**

1. **Sign In with Password**
   - Go to `/auth`
   - Scroll to "Or sign in with password" section
   - Enter email and password
   - Click "Sign in with password" (outline button)
   - ✅ Should log in and redirect to home

2. **Sign Up with Password**
   - Click "Need an account? Sign up"
   - Enter email and password (min 6 characters)
   - Click "Sign up with password"
   - ✅ Should show toast: "Account created! You can now sign in."
   - ✅ Can now sign in with those credentials

---

## Use Case 9: Delete Account

### Flow: Settings → Account Tab → Delete

**Test Steps:**

1. **Navigate to Account Settings**
   - Sign in
   - Go to Settings
   - Click "Account" tab
   - ✅ Should see red "Delete Account" card

2. **Initiate Deletion**
   - Click "Delete My Account"
   - ✅ Should show confirmation dialog: "Delete Account. This action cannot be undone. This will permanently delete your account and remove your access to all collections."
   - Click "Cancel" to test cancellation
   - ✅ Dialog should close, nothing deleted

3. **Confirm Deletion**
   - Click "Delete My Account" again
   - Click "Delete" in dialog
   - ✅ Should sign out immediately
   - ✅ Should show toast: "Account deletion requested. Please contact support to complete account deletion."
   - ✅ Should redirect to `/auth`

**Note:** Actual deletion requires manual support intervention (by design)

---

## Edge Cases & Error Scenarios

### Already Member

**Scenario:** User clicks invite link but is already a member

**Steps:**
1. Alice invites Bob to Collection A
2. Bob accepts and joins
3. Alice sends another invite to Bob for Collection A
4. Bob clicks new invite link
5. ✅ Should show toast: "Already a member. You're already a member of this collection"
6. ✅ Should redirect to home

### Email Mismatch

**Scenario:** User signs in with different email than invite was sent to

**Steps:**
1. Alice invites bob@example.com
2. User signs in as charlie@example.com
3. Tries to accept Bob's invite
4. ✅ Backend returns 403
5. ✅ Should show toast: "Email mismatch. This invite was sent to a different email address"

### Invalid Token

**Scenario:** User has malformed or non-existent token

**Steps:**
1. Navigate to `/auth?invite=invalid-token-123`
2. ✅ Should show "Invite Expired" or "Invalid Invitation" error
3. ✅ Should have button to continue to normal auth

### No Collections

**Scenario:** User has no collections to manage

**Steps:**
1. Sign in as new user with no collections
2. Go to Settings → Collection Members
3. ✅ Should show empty collection dropdown
4. **TODO:** Add empty state message (currently shows loading/empty UI)

---

## Known Issues & Limitations

### ⚠️ Critical (Blocks Main Flow)

1. **Backend Auto-Accept**
   - **Issue:** Existing users added immediately without email/terms
   - **Impact:** Breaks intended flow for returning users
   - **Fix:** Backend change required (see top of document)
   - **Status:** Pending backend fix

### 🔶 Important (Impacts UX)

2. **Magic Link Blank Page**
   - **Issue:** Sometimes shows blank page after clicking magic link
   - **Workaround:** Refresh or retry
   - **Cause:** Supabase hash fragment timing
   - **Status:** Known Supabase behavior

3. **Cached Builds**
   - **Issue:** Azure Static Apps caches old builds
   - **Workaround:** Hard refresh (Cmd+Shift+R) or clear cache
   - **Impact:** Users may see old UI after deploys
   - **Status:** Expected Azure behavior

### 🔷 Minor (Polish)

4. **No Empty Collection State**
   - **Issue:** No message when user has zero collections
   - **Impact:** Empty dropdown looks broken
   - **Fix:** Add "No collections found" message

5. **Current User Not Highlighted**
   - **Issue:** "(you)" indicator present but subtle
   - **Impact:** Hard to find yourself in large member lists
   - **Fix:** Add background color or icon

---

## Success Criteria

### MVP Requirements (Must Pass)

- [ ] Owner can invite users via Settings
- [ ] Invitees receive email with working link
- [ ] Terms acceptance page displays correctly
- [ ] After acceptance, user sees collection
- [ ] Owner can change member roles
- [ ] Owner can remove members
- [ ] Owner can cancel pending invites
- [ ] Expired invites show error page
- [ ] Magic link login works
- [ ] Delete account signs out and requests support

### Nice to Have (Post-MVP)

- [ ] Resend invite functionality
- [ ] Bulk invite (multiple emails)
- [ ] Custom collection terms per collection
- [ ] Email customization (branding)
- [ ] Invite analytics (opened, accepted, expired)

---

## Environment Configuration

### Production Checklist

- [ ] Azure backend deployed
- [ ] Supabase Edge Function `APP_URL` = `https://icy-stone-0bca71103.3.azurestaticapps.net`
- [ ] Resend API key configured in Edge Function
- [ ] Frontend deployed to Azure Static Apps
- [ ] DNS/domain configured (if not using azurestaticapps.net)

### Email Service

**Supabase Edge Function:** `send-invite-email`
- Sends via Resend API
- Environment variables: `RESEND_API_KEY`, `APP_URL`
- Template: includes collection name, inviter, role, link
- Expiry: 7 days from send

---

## Regression Testing

### After Backend Fix

Re-run these tests after backend is updated:

1. **Use Case 3** - Existing user invite flow
2. **Edge Case** - Already member handling
3. **Edge Case** - Email mismatch validation

### After Future Changes

If modifying:
- Auth flow → Re-run Use Cases 2, 7, 8
- Settings UI → Re-run Use Cases 1, 4, 5
- Terms page → Re-run Use Case 2 (step 5-6)
- Email templates → Verify email content in all flows

---

## Support Contacts

**Issues or Questions:**
- Frontend: Check `/docs/features/invite-system.md`
- Backend: Check `/docs/handoff/frontend-invite-integration.md`
- Deployment: Azure Static Apps + Supabase dashboard

**Common Fixes:**
- Settings page crash → Hard refresh browser
- Magic link not working → Check Supabase Auth logs
- Email not sending → Check Edge Function logs in Supabase
- Auto-accept happening → Backend needs update (see top)
