# Backend Pagination Requirements

## Problem Statement

The frontend needs to display all photos in a collection (currently 301 photos, but could grow to thousands). The current backend API endpoint `/v1/collections/{id}/photos` has pagination issues that prevent this.

## Current Backend Behavior (Discovered via Testing)

| Test | Result | Note |
|------|--------|------|
| No limit parameter | 500 Internal Server Error | Backend crashes |
| `limit=50` | 200 OK, returns array of 50 photos | Works |
| `limit=1000` | 500 Internal Server Error | Backend crashes despite being under max |
| `limit=10000` | 422 Validation Error | "Input should be less than or equal to 1000" |
| `cursor=xyz` with `limit=50` | Returns same first 50 photos | Cursor ignored |
| `offset=50` with `limit=50` | Returns same first 50 photos | Offset ignored |

**Response Format:** Plain array `[{photo1}, {photo2}, ...]` with no pagination metadata (no `cursor`, `hasMore`, or `total` fields)

## Frontend Architecture & Expectations

### Current Implementation

The frontend uses React Query's `useInfiniteQuery` for pagination:

```typescript
useInfiniteQuery({
  queryFn: async ({ pageParam }) => {
    return azureApi.getCollectionPhotosPaginated(collectionId, {
      cursor: pageParam,  // For next page
      limit: 50
    });
  },
  getNextPageParam: (lastPage) => {
    // Expects: lastPage.hasMore ? lastPage.cursor : undefined
    return lastPage.hasMore ? lastPage.cursor : undefined;
  }
})
```

### What Frontend Needs

**Option 1: Cursor-Based Pagination (Preferred)**

Response format:
```json
{
  "photos": [{photo1}, {photo2}, ...],
  "cursor": "opaque-cursor-string-for-next-page",
  "hasMore": true,
  "total": 301  // optional but helpful
}
```

Request parameters:
- `limit` (required, max 1000) - number of results per page
- `cursor` (optional) - opaque token from previous response

Benefits:
- Efficient for large datasets
- Handles real-time updates gracefully
- Standard REST pattern

**Option 2: Offset-Based Pagination (Acceptable)**

Response format:
```json
{
  "photos": [{photo1}, {photo2}, ...],
  "offset": 50,
  "limit": 50,
  "total": 301,
  "hasMore": true
}
```

Request parameters:
- `limit` (required, max 1000)
- `offset` (optional, default 0)

Benefits:
- Simple to implement
- Easy to calculate progress
- Familiar pattern

Frontend will calculate: `hasMore = offset + photos.length < total`

## What We Tried & Why It Failed

### Attempt 1: Generate cursor from last photo ID
```typescript
const cursor = photos[photos.length - 1].id;
```
**Failed:** Backend ignores cursor parameter, returns first 50 photos repeatedly

### Attempt 2: Remove limit entirely
```typescript
// No limit parameter
```
**Failed:** Backend crashes with 500 error (requires limit)

### Attempt 3: Use very large limit
```typescript
limit: 10000
```
**Failed:** Backend validation error (max 1000)

### Attempt 4: Use max allowed limit
```typescript
limit: 1000
```
**Failed:** Backend crashes with 500 error (possible timeout/memory issue?)

### Current Workaround (Broken)
```typescript
limit: 50  // Only shows first 50 photos
```
**Problem:** Collections with >50 photos show incomplete results

## Design Principles

### 1. Stateless API
- Cursor should be opaque (backend controls format)
- No client-side sorting/filtering assumptions
- Each request is independent

### 2. Consistent Response Format
- Don't return plain array sometimes and object other times
- Always include pagination metadata even if `hasMore=false`
- Example:
  ```json
  {
    "photos": [...],
    "hasMore": false,
    "total": 42
  }
  ```

### 3. Performance
- Backend should handle `limit=1000` without crashing
- Consider database query optimization (pagination, indexing)
- If >1000 photos is slow, document it and recommend smaller page sizes

### 4. Error Handling
- Return 400 with clear message if `limit > 1000`
- Return 400 (not 500) if required params missing
- Example error:
  ```json
  {
    "detail": "limit parameter is required",
    "code": "MISSING_PARAM"
  }
  ```

## Use Cases to Support

### UC1: Timeline View (All Photos)
- User opens app, sees timeline
- **Need:** Load all 301 photos
- **Current:** Only shows 50, user thinks they're missing photos

### UC2: Infinite Scroll
- User scrolls down timeline
- **Need:** Load next page seamlessly
- **Current:** Not possible (no working pagination)

### UC3: Filtered Views
- User filters by person, year, favorites
- **Need:** Same pagination behavior with filters applied
- **Current:** Each filter combination may have different total count

### UC4: Unnamed Cluster View
- User clicks unnamed cluster (2 photos)
- **Need:** Show those specific 2 photos
- **Current:** Works (we fetch by cluster data, not from this endpoint)

## Recommended Backend Changes

**We're not prescribing exact implementation**, but here's what would solve the frontend issues:

1. **Fix 500 errors**
   - Debug why `limit=1000` crashes
   - Ensure `limit` parameter is truly optional (or return 400, not 500)

2. **Implement pagination**
   - Choose cursor OR offset approach
   - Return pagination metadata in response
   - Respect cursor/offset in requests

3. **Example Implementation (Cursor)**
   ```python
   @router.get("/v1/collections/{id}/photos")
   async def get_photos(
       collection_id: str,
       limit: int = Query(50, le=1000),
       cursor: Optional[str] = None
   ):
       # Decode cursor to get last_photo_id or timestamp
       # Query: SELECT * FROM photos
       #        WHERE collection_id = ? AND id > ?
       #        LIMIT ?

       return {
           "photos": [...],
           "cursor": encode_cursor(last_photo_id),
           "hasMore": len(photos) == limit,
           "total": count_total()  # optional
       }
   ```

4. **Example Implementation (Offset)**
   ```python
   @router.get("/v1/collections/{id}/photos")
   async def get_photos(
       collection_id: str,
       limit: int = Query(50, le=1000),
       offset: int = Query(0, ge=0)
   ):
       # Query: SELECT * FROM photos
       #        WHERE collection_id = ?
       #        LIMIT ? OFFSET ?

       total = count_total()

       return {
           "photos": [...],
           "offset": offset,
           "limit": limit,
           "total": total,
           "hasMore": offset + len(photos) < total
       }
   ```

## Testing Checklist

Once backend changes are deployed, test:

- [ ] `limit=50` returns 50 photos with pagination metadata
- [ ] `limit=1000` works without crashing
- [ ] `cursor=xyz` or `offset=50` returns next page (different photos)
- [ ] `hasMore=false` when reaching last page
- [ ] `total` matches actual photo count
- [ ] No limit parameter returns 400 (or defaults to 50)
- [ ] Filtered queries work with pagination

## Open Questions for Backend Team

1. What's causing the 500 error with `limit=1000`? (timeout? memory? db query issue?)
2. Is cursor or offset pagination easier to implement with current DB schema?
3. Should `limit` parameter be required or optional with default?
4. What's the realistic max `limit` value for performance? (1000? 500? 100?)
5. Is there a reason plain array format was chosen vs. object with metadata?

## Contact

Frontend changes: See `src/lib/azureApiClient.ts:364-418` and `src/hooks/useAlbumPhotos.ts:58-90`

Questions? Open a GitHub issue with label `backend:pagination`
