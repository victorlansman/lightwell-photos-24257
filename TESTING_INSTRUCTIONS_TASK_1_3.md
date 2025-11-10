# Testing Instructions - Task 1.3: Update Components to Use Secure Photo URLs

## Prerequisites
- Backend running on port 8000
- Frontend running on port 8080

## Test Steps

1. **Start Services**
   ```bash
   # Backend
   cd ~/Documents/Code/image-annotation-tool/backend
   source .venv/bin/activate
   uvicorn src.backend.main:app --reload --port 8000

   # Frontend
   cd ~/Documents/Code/lightwell-photos-24257
   npm run dev
   ```

2. **Login**
   - Open http://localhost:8080
   - Login with your account

3. **Test Photo Loading**
   - Navigate to a collection
   - Verify photos load correctly with thumbnails
   - Check for loading states (gray animate-pulse)

4. **Test Lightbox**
   - Click on a photo to open lightbox
   - Verify full resolution image displays
   - Check navigation works (previous/next)

5. **Test Download**
   - In lightbox, click download button
   - Verify download starts and completes successfully
   - Check downloaded file opens correctly

6. **Verify Network Requests**
   - Open browser DevTools → Network tab
   - Filter by "image"
   - Verify you see requests to:
     - `/v1/photos/{id}/image?thumbnail=true` (for thumbnails)
     - `/v1/photos/{id}/image` (for full resolution)
   - Verify NO requests to SAS URLs (e.g., blob.core.windows.net with ?sv= query params)

7. **Test Authorization**
   - Copy a photo URL from Network tab
   - Open in incognito window WITHOUT logging in
   - Should receive 401 Unauthorized

## Expected Results

- ✅ Photos load with thumbnails
- ✅ Lightbox displays full resolution
- ✅ Download works correctly
- ✅ All photo access goes through `/v1/photos/{id}/image` endpoint
- ✅ No public SAS URLs in network traffic
- ✅ Unauthorized access returns 401

## Notes

This task implements secure photo access by:
- Replacing direct SAS URLs with backend-proxied access
- Using usePhotoUrl hook for authenticated photo loading
- Enforcing collection membership on every photo request
- Supporting optional thumbnail generation via `?thumbnail=true` parameter
