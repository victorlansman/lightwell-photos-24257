# Invite System

## Overview

The invite system enables collection owners to invite users via email to join their collections with defined roles (owner, admin, viewer). The system supports two paths:
1. **Existing users**: Immediately added to collection
2. **New users**: Receive email invitation with secure token link, valid for 7 days

Backend handles invite validation, email delivery, membership creation, and expiration management.

## User Flows

### Sending an Invite (Owner Perspective)

1. **Navigate** to Settings → Collection Members tab
2. **Select** the target collection from dropdown
3. **Enter** invitee email address
4. **Choose** role: Viewer (view photos), Admin (manage photos), or Owner (full control)
5. **Submit** the invitation form
6. **Result**:
   - Existing user: Immediately added to collection, success toast shown
   - New user: Email sent with invite link, pending invite appears in list

**Requirements**: Must be collection owner

### Accepting an Invite (Invitee Perspective)

1. **Receive** email with invitation link (`/auth?invite={token}`)
2. **Click** link → redirects to auth page with invite preview card
3. **Preview** shows:
   - Collection name
   - Inviter email
   - Assigned role
4. **Sign in** or **Sign up**:
   - Existing users: Sign in with credentials
   - New users: Create account (token preserved through signup)
5. **Redirect** to acceptance page (`/invite/{token}/accept`)
6. **Review**:
   - Collection details
   - Role permissions
   - Terms & conditions text
   - Expiration date
7. **Accept** or **Decline**:
   - Accept: Joins collection, redirected to home with new collection visible
   - Decline: Returns to home without joining
8. **Error states**:
   - Expired invite: Shows dedicated error page with contact info
   - Already member: Toast notification, redirect to home
   - Invalid token: Error page with return option

## Components

### Pages

**`src/pages/InviteAccept.tsx`**
- Invite acceptance page with terms display
- Shows collection info, inviter details, role, terms text
- Accept/decline actions with confirmation
- Handles expired, invalid, and already-member states
- Requires authentication (redirects to auth if not logged in)

**`src/pages/Auth.tsx`** (Modified)
- Detects `?invite={token}` query parameter
- Fetches and displays invite preview before auth
- Preserves token through signup/signin flow
- Redirects to acceptance page after authentication
- Shows expired invite error state

**`src/pages/Settings.tsx`** (Modified)
- Integrated member management tab
- Collection selector for multi-collection users
- Conditional UI based on user role (owner/viewer)

### Components

**`src/components/InviteForm.tsx`**
- Email input with validation
- Role selector (viewer/admin/owner)
- Submit handler with loading state
- Displays different success messages for existing vs new users
- Info text about immediate vs email invite behavior

**`src/components/MembersList.tsx`**
- Displays active collection members with joined date
- Role management dropdown (owners only)
- Remove member action with confirmation dialog
- Read-only role badges for non-owners
- Prevents removing/modifying other owners
- Shows "you" indicator for current user

**`src/components/PendingInvitesList.tsx`**
- Lists pending email invitations (owners only)
- Shows expiration countdown ("Expires in X days")
- Cancel invite action with confirmation
- Role badges for visual clarity
- Hidden when no pending invites

### Hooks

**`src/hooks/useInvites.ts`**
- `useInviteDetails(token)`: Fetch invite preview (no auth)
- `useAcceptInvite()`: Accept invitation (requires auth)
- `useCollectionMembers(collectionId)`: Fetch active members
- `usePendingInvites(collectionId)`: Fetch pending invites (owners only)
- `useInviteToCollection(collectionId)`: Send invitation
- `useRemoveMember(collectionId)`: Remove member
- `useCancelInvite(collectionId)`: Cancel pending invite
- `useChangeMemberRole(collectionId)`: Update member role

All mutations automatically invalidate relevant queries for real-time UI updates.

## API Endpoints

**Base URL**: Configured via `VITE_AZURE_API_URL` environment variable

### Public Endpoints (No Auth Required)

**GET `/v1/collections/invite/{token}/details`**
- Returns: `InviteDetails` (collection info, inviter, role, terms, expiration)
- Used by: Auth page preview, acceptance page
- Errors: 404 (not found), 410 (expired)

### Authenticated Endpoints

**POST `/v1/collections/accept-invite/{token}`**
- Body: None (auth from session)
- Returns: `AcceptInviteResponse` (message, collection object)
- Errors: 403 (email mismatch), 409 (already member), 410 (expired)

**GET `/v1/collections/{collectionId}/members`**
- Returns: `{ members: Member[] }`
- Requires: Collection membership
- Member fields: user_id, email, role, invited_by, joined_at

**GET `/v1/collections/{collectionId}/invites`**
- Returns: `{ invites: PendingInvite[] }`
- Requires: Collection owner role
- Invite fields: id, email, role, invited_by, expires_at

**POST `/v1/collections/{collectionId}/invite`**
- Body: `{ email: string, role: 'owner' | 'admin' | 'viewer' }`
- Returns: `InviteResponse` (type: 'pending' or immediate member)
- Requires: Collection owner role
- Behavior: Immediate add if user exists, email invite if not

**DELETE `/v1/collections/{collectionId}/members/{userId}`**
- Returns: 204 No Content
- Requires: Collection owner role
- Restrictions: Cannot remove other owners

**DELETE `/v1/collections/{collectionId}/invites/{inviteId}`**
- Returns: 204 No Content
- Requires: Collection owner role

**PATCH `/v1/collections/{collectionId}/members/{userId}/role`**
- Body: `{ role: 'owner' | 'admin' | 'viewer' }`
- Returns: Updated `Member` object
- Requires: Collection owner role

## TypeScript Interfaces

Located in `src/lib/azureApiClient.ts`:

```typescript
interface InviteDetails {
  id: string;
  collection: { id: string; name: string };
  invited_by: { id: string; email: string; name?: string };
  role: 'owner' | 'admin' | 'viewer';
  terms_text: string;
  expires_at: string;
  is_expired: boolean;
}

interface Member {
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  invited_by: string | null;
  joined_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  invited_by: string;
  expires_at: string;
}

interface InviteRequest {
  email: string;
  role: 'owner' | 'admin' | 'viewer';
}

interface InviteResponse {
  type?: 'pending';
  id?: string;
  user_id?: string;
  email: string;
  role: string;
  invited_by: string;
  joined_at?: string;
  expires_at?: string;
}
```

## Security & Permissions

- **Invite tokens**: Secure, unguessable UUIDs with 7-day expiration
- **Email verification**: Backend validates invite email matches authenticated user email
- **Role enforcement**: Backend enforces owner-only operations
- **Owner protection**: Cannot remove other owners, only collection creator has ultimate control
- **Token single-use**: Once accepted, token becomes invalid
- **No auth preview**: Invite details viewable before login for UX, but acceptance requires auth

## Testing Notes

### Manual Testing Checklist

**Owner Flow**:
1. Navigate to Settings → Collection Members
2. Send invite to non-existing email (verify email sent)
3. Send invite to existing user (verify immediate add)
4. Verify pending invite appears in list
5. Cancel pending invite

**Invitee Flow**:
1. Click invite link → verify preview shows correctly
2. Sign up with new account → verify token preserved
3. Accept invite → verify collection appears in sidebar
4. Try accepting same invite again → verify "already member" error

**Edge Cases**:
1. Expired token → verify error page with contact info
2. Invalid token → verify error page
3. Email mismatch → verify 403 error with clear message
4. Viewer trying to invite → verify no invite form visible
5. Offline/network error → verify error message

**Role Management**:
1. Owner changes member role → verify update
2. Owner removes member → verify confirmation dialog, member removed
3. Viewer views members → verify read-only (no action buttons)

### Error Handling

All API errors display user-friendly toast notifications:
- Network errors: "Connection failed, please try again"
- 403 Email mismatch: "This invite was sent to a different email address"
- 409 Already member: "You're already a member of this collection"
- 410 Expired: "This invitation has expired. Please request a new one."
- 404 Not found: "Invitation not found or cancelled"

## Environment Configuration

**Required Variables**:
- `VITE_AZURE_API_URL`: Backend API base URL
- Backend: `APP_URL`: Frontend URL for email links (e.g., `https://app.example.com`)

## Future Enhancements

- Bulk invite (CSV upload)
- Resend invite functionality
- Custom expiration periods
- Invite link preview in Settings
- Email template customization
- Audit log for member changes
