/**
 * Azure Backend API Client
 *
 * Handles all communication with FastAPI backend.
 * Uses Supabase JWT tokens for authentication.
 */

import {
  ServerId,
  Person,
  FaceTag
} from '@/types/identifiers';
import {
  UiBoundingBox,
  ApiBoundingBox,
  uiBboxToApi,
  apiBboxToUi,
  createUiBbox,
  apiCoord,
} from '@/types/coordinates';

const API_BASE_URL = import.meta.env.VITE_AZURE_API_URL ||
  'https://image-annotation-tool-api.azurewebsites.net';

// Type definitions matching backend responses
export interface Collection {
  id: string;
  name: string;
  shopify_order_id: string | null;
  created_at: string;
  photo_count: number;
  member_count: number;
  user_role: 'owner' | 'admin' | 'viewer';
}

export interface InviteDetails {
  id: string;
  collection: {
    id: string;
    name: string;
  };
  invited_by: {
    id: string;
    email: string;
    name?: string;
  };
  role: 'owner' | 'admin' | 'viewer';
  terms_text: string;
  expires_at: string;
  is_expired: boolean;
}

export interface AcceptInviteResponse {
  message: string;
  collection: Collection;
}

export interface Member {
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  invited_by: string | null;
  joined_at: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  invited_by: string;
  expires_at: string;
}

export interface InviteRequest {
  email: string;
  role: 'owner' | 'admin' | 'viewer';
}

export interface InviteResponse {
  type?: 'pending';
  id?: string;
  user_id?: string;
  email: string;
  role: string;
  invited_by: string;
  joined_at?: string;
  expires_at?: string;
}

export interface Photo {
  id: ServerId;  // Changed from string
  collection_id: ServerId;  // Collection this photo belongs to
  path: string;
  thumbnail_url: string | null;
  created_at: string;
  title: string | null;
  description: string | null;

  // Year estimation
  display_year: number | null;
  estimated_year: number | null;
  estimated_year_min: number | null;
  estimated_year_max: number | null;
  user_corrected_year: number | null;

  // Filtering
  tags: string[];
  people: Array<{
    id: ServerId;  // Changed from string
    name: string;
    face_bbox: UiBoundingBox | null;  // Changed to use typed coords
  }>;
  is_favorite: boolean;

  width: number | null;
  height: number | null;
  rotation: number;
}

export interface PhotoFilters {
  person_id?: string;
  year_min?: number;      // CHANGED from year_from
  year_max?: number;      // CHANGED from year_to
  tags?: string;  // Comma-separated
  favorite?: boolean;
  limit?: number;
  cursor?: string;
}

export interface PaginatedPhotosResponse {
  photos: Photo[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface YearEstimationUpdate {
  user_corrected_year?: number;
  user_corrected_year_min?: number;
  user_corrected_year_max?: number;
  user_year_reasoning?: string;
}

// ==================== Face & People Types ====================

// Remove old FaceBoundingBox interface, use UiBoundingBox instead
// Remove old FaceTag interface, import from types instead

export interface UpdateFacesRequest {
  faces: FaceTag[];  // Uses imported type
}

export interface FaceTagResponse {
  id: ServerId;  // Changed from string
  person_id: ServerId | null;  // Changed from string | null
  bbox: UiBoundingBox;  // Uses UI coordinates
}

export interface FaceWarning {
  field: string;
  message: string;
  value: string;
}

export interface UpdateFacesResponse {
  photo_id: ServerId;  // Changed from string
  faces: FaceTagResponse[];
  warnings?: FaceWarning[];  // Present in 207 Multi-Status responses
}

export interface CreatePersonRequest {
  name: string;
  collection_id: ServerId;  // Changed from string
}

export interface UpdatePersonRequest {
  name?: string;
  thumbnail_url?: string | null;
  thumbnail_bbox?: { x: number; y: number; width: number; height: number } | null;
}

export interface PersonResponse {
  id: ServerId;  // Changed from string
  name: string;
  collection_id: ServerId;  // Changed from string
  thumbnail_url: string | null;
  thumbnail_bbox?: { x: number; y: number; width: number; height: number } | null;
  photo_count: number;
}

// ==================== Face Clusters ====================

export interface ClusterFace {
  id: ServerId;
  photo_id: ServerId;
  bbox: ApiBoundingBox;  // Backend returns 0-1 normalized
}

export interface FaceClusterResponse {
  id: ServerId;
  collection_id: ServerId;
  face_count: number;
  confidence: number;
  representative_face_id: ServerId;
  representative_thumbnail_url?: string;
  faces: ClusterFace[];
}

export interface ClustersResponse {
  clusters: FaceClusterResponse[];
}

class AzureApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set authentication token from Supabase
   */
  setToken(token: string) {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
  }

  /**
   * Generic request method with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: 'unknown',
            message: response.statusText,
            detail: response.statusText
          };
        }
        
        // Extract error message from various possible formats
        // Handle Pydantic validation errors (FastAPI format)
        let errorMessage: string;
        if (Array.isArray(errorData.detail)) {
          // Pydantic validation errors are arrays of error objects
          const errors = errorData.detail.map((err: any) => {
            if (typeof err === 'string') return err;
            const loc = Array.isArray(err.loc) ? err.loc.slice(1).join('.') : '';
            const msg = err.msg || err.type || 'Validation error';
            return loc ? `${loc}: ${msg}` : msg;
          }).join('; ');
          errorMessage = errors || 'Validation error';
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error && typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
        
        if (!errorMessage || errorMessage === '{}') {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        console.error(`API Error [${endpoint}]:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          fullError: JSON.stringify(errorData, null, 2)
        });
        throw new Error(errorMessage);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as T;
      }

      return response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // ==================== Collections ====================

  async getCollections(): Promise<Collection[]> {
    return this.request('/v1/collections');
  }

  async getCollection(id: string): Promise<Collection> {
    return this.request(`/v1/collections/${id}`);
  }

  async getCollectionPhotos(
    collectionId: string,
    filters?: PhotoFilters
  ): Promise<Photo[]> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.person_id) params.append('person_id', filters.person_id);
      if (filters.year_min) params.append('year_min', filters.year_min.toString());
      if (filters.year_max) params.append('year_max', filters.year_max.toString());
      if (filters.tags) params.append('tags', filters.tags);
      if (filters.favorite !== undefined) params.append('favorite', filters.favorite.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.cursor) params.append('cursor', filters.cursor);
    }

    const query = params.toString();
    const endpoint = `/v1/collections/${collectionId}/photos${query ? `?${query}` : ''}`;

    const photos = await this.request<Photo[]>(endpoint);

    // COORDINATE CONVERSION: API (0-1) → UI (0-100)
    // Backend returns 0-1 normalized, transform to UI coordinates
    return photos.map(photo => ({
      ...photo,
      people: photo.people.map(person => ({
        ...person,
        face_bbox: person.face_bbox
          ? apiBboxToUi({
              x: apiCoord(person.face_bbox.x as any),
              y: apiCoord(person.face_bbox.y as any),
              width: apiCoord(person.face_bbox.width as any),
              height: apiCoord(person.face_bbox.height as any),
            })
          : null,
      })),
    }));
  }

  async getCollectionPhotosPaginated(
    collectionId: string,
    filters?: PhotoFilters
  ): Promise<PaginatedPhotosResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.person_id) params.append('person_id', filters.person_id);
      if (filters.year_min) params.append('year_min', filters.year_min.toString());
      if (filters.year_max) params.append('year_max', filters.year_max.toString());
      if (filters.tags) params.append('tags', filters.tags);
      if (filters.favorite !== undefined) params.append('favorite', filters.favorite.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.cursor) params.append('cursor', filters.cursor);
    }

    // Set default page size
    if (!filters?.limit) {
      params.append('limit', '50');
    }

    const query = params.toString();
    const endpoint = `/v1/collections/${collectionId}/photos${query ? `?${query}` : ''}`;

    const response = await this.request<any>(endpoint);

    // Handle different response formats
    const photos: Photo[] = Array.isArray(response) ? response : (response.photos || []);
    const cursor = response.cursor;
    const hasMore = response.hasMore ?? false;
    const total = response.total;

    // COORDINATE CONVERSION: API (0-1) → UI (0-100)
    const convertedPhotos = photos.map(photo => ({
      ...photo,
      people: photo.people.map(person => ({
        ...person,
        face_bbox: person.face_bbox
          ? apiBboxToUi({
              x: apiCoord(person.face_bbox.x as any),
              y: apiCoord(person.face_bbox.y as any),
              width: apiCoord(person.face_bbox.width as any),
              height: apiCoord(person.face_bbox.height as any),
            })
          : null,
      })),
    }));

    return {
      photos: convertedPhotos,
      cursor,
      hasMore,
      total,
    };
  }

  // ==================== Favorites ====================

  async addFavorite(photoId: string): Promise<{ photo_id: string; is_favorite: boolean }> {
    return this.request(`/v1/photos/${photoId}/favorite`, {
      method: 'POST',
    });
  }

  async removeFavorite(photoId: string): Promise<void> {
    return this.request(`/v1/photos/${photoId}/favorite`, {
      method: 'DELETE',
    });
  }

  async toggleFavorite(photoId: string, currentlyFavorited: boolean): Promise<boolean> {
    if (currentlyFavorited) {
      await this.removeFavorite(photoId);
      return false;
    } else {
      await this.addFavorite(photoId);
      return true;
    }
  }

  // ==================== Year Estimation ====================

  async updateYearEstimation(
    photoId: string,
    update: YearEstimationUpdate
  ): Promise<Photo> {
    return this.request(`/v1/photos/${photoId}/year-estimation`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  // ==================== Photo Access ====================

  /**
   * Get secure photo URL that proxies through backend.
   * This replaces direct SAS URLs to enforce collection membership.
   */
  getPhotoUrl(photoId: string, options?: { thumbnail?: boolean }): string {
    const params = new URLSearchParams();
    if (options?.thumbnail) {
      params.append('thumbnail', 'true');
    }

    const query = params.toString();
    const endpoint = `/v1/photos/${photoId}/image${query ? `?${query}` : ''}`;

    // Return full URL including token in Authorization header
    // Frontend will use this with fetch + auth header
    return `${this.baseUrl}${endpoint}`;
  }

  /**
   * Fetch photo blob with authentication.
   * Use this for downloading or displaying images.
   */
  async fetchPhoto(photoId: string, options?: { thumbnail?: boolean }): Promise<Blob> {
    const params = new URLSearchParams();
    if (options?.thumbnail) {
      params.append('thumbnail', 'true');
    }

    const query = params.toString();
    const endpoint = `/v1/photos/${photoId}/image${query ? `?${query}` : ''}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.blob();
  }

  /**
   * Fetch face thumbnail blob with authentication.
   * Face thumbnails are pre-cropped by the backend.
   */
  async fetchFaceThumbnail(faceId: string): Promise<Blob> {
    const endpoint = `/api/faces/${faceId}/thumbnail`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.blob();
  }

  // ==================== Face Tagging ====================

  async updatePhotoFaces(
    photoId: ServerId,
    faces: FaceTag[]
  ): Promise<UpdateFacesResponse> {
    // COORDINATE CONVERSION: UI (0-100) → API (0-1)
    // Components use UI coords, backend expects 0-1 normalized
    const normalizedFaces = faces.map(face => ({
      person_id: face.person_id,
      bbox: uiBboxToApi(face.bbox),
    }));

    const url = `${this.baseUrl}/v1/photos/${photoId}/faces`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ faces: normalizedFaces }),
    });

    // Handle different status codes
    if (response.status === 200 || response.status === 207) {
      // 200 = All valid, 207 = Partial success (some invalid person_ids skipped)
      const data = await response.json();

      // COORDINATE CONVERSION: API (0-1) → UI (0-100)
      // Transform response back to UI coordinates
      const result: UpdateFacesResponse = {
        photo_id: data.photo_id,
        faces: data.faces.map((face: any) => ({
          id: face.id,
          person_id: face.person_id,
          bbox: apiBboxToUi({
            x: apiCoord(face.bbox.x),
            y: apiCoord(face.bbox.y),
            width: apiCoord(face.bbox.width),
            height: apiCoord(face.bbox.height),
          }),
        })),
        warnings: data.warnings, // Include warnings if present (207 response)
      };

      return result;
    }

    // Handle error responses (400, 404, etc.)
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: 'unknown',
        message: response.statusText,
        detail: response.statusText
      };
    }

    // Extract error message
    const errorMessage = typeof errorData.detail === 'string'
      ? errorData.detail
      : errorData.message || `HTTP ${response.status}: ${response.statusText}`;

    console.error(`API Error [updatePhotoFaces]:`, {
      status: response.status,
      error: errorData,
    });

    throw new Error(errorMessage);
  }

  // ==================== People Management ====================

  async createPerson(
    request: CreatePersonRequest
  ): Promise<PersonResponse> {
    return this.request('/v1/people', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updatePerson(
    personId: string,
    request: UpdatePersonRequest
  ): Promise<PersonResponse> {
    console.log('[updatePerson] Request:', { personId, request });
    return this.request(`/v1/people/${personId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  }

  /**
   * Delete a person with optional mode.
   *
   * @param personId - Person to delete
   * @param mode - 'cascade' (delete face tags) or 'unname' (keep faces unnamed)
   * @returns Deletion result with affected faces count
   */
  async deletePerson(
    personId: string,
    mode: 'cascade' | 'unname' = 'cascade'
  ): Promise<{ deleted: boolean; faces_affected: number; mode: string }> {
    const params = new URLSearchParams({ mode });
    return this.request(`/v1/people/${personId}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  /**
   * Merge duplicate persons - all faces from source reassigned to target.
   *
   * @param targetPersonId - Person to keep (receives all faces)
   * @param sourcePersonId - Person to merge from (will be deleted)
   * @returns Merge result with count of faces transferred
   */
  async mergePeople(
    targetPersonId: string,
    sourcePersonId: string
  ): Promise<{ success: boolean; target_person_id: string; faces_merged: number }> {
    return this.request(`/v1/people/${targetPersonId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ source_person_id: sourcePersonId }),
    });
  }

  /**
   * List all people in a collection.
   * Returns people sorted by photo_count desc, then name asc.
   */
  async getPeople(collectionId: string): Promise<PersonResponse[]> {
    const params = new URLSearchParams({ collection_id: collectionId });
    return this.request(`/v1/people?${params.toString()}`);
  }

  /**
   * Get unnamed face clusters for a collection.
   * Used for bulk labeling of similar faces.
   *
   * @param collectionId - Collection to get clusters for
   * @returns Array of face clusters with unnamed faces
   */
  async getClusters(collectionId: string): Promise<FaceClusterResponse[]> {
    const params = new URLSearchParams({ collection_id: collectionId });
    const response = await this.request<ClustersResponse>(`/api/faces/clusters?${params.toString()}`);

    // Transform response to ensure coordinate consistency
    // Backend should return 0-1 normalized, but we verify the contract
    return response.clusters.map(cluster => ({
      ...cluster,
      faces: cluster.faces.map(face => ({
        ...face,
        bbox: {
          x: apiCoord(face.bbox.x),
          y: apiCoord(face.bbox.y),
          width: apiCoord(face.bbox.width),
          height: apiCoord(face.bbox.height),
        }
      }))
    }));
  }

  /**
   * Label a face cluster by assigning all faces to a person.
   * This effectively "names" the cluster.
   *
   * @param clusterId - Cluster ID to label
   * @param personId - Person ID to assign faces to
   * @returns Success message with number of faces updated
   */
  async labelCluster(clusterId: string, personId: ServerId): Promise<{
    message: string;
    faces_updated: number;
  }> {
    return this.request(`/api/faces/clusters/${clusterId}/label`, {
      method: 'POST',
      body: JSON.stringify({ person_id: personId }),
    });
  }

  /**
   * Create person and return server-generated ID.
   *
   * ARCHITECTURE: Backend is sole authority for IDs.
   * This helper makes the pattern explicit: create → get server ID → use it.
   *
   * @returns Server-generated person ID (for immediate use in face tagging)
   */
  async createPersonAndReturnId(
    name: string,
    collectionId: ServerId
  ): Promise<ServerId> {
    console.log('[createPersonAndReturnId] Input:', { name, collectionId });

    if (!name || !name.trim()) {
      throw new Error('Person name is required');
    }

    if (!collectionId) {
      throw new Error('Collection ID is required');
    }

    const response = await this.createPerson({
      name,
      collection_id: collectionId,
    });

    console.log('[createPersonAndReturnId] Response:', response);
    return response.id;
  }

  /**
   * Create person, tag face, update photo in single operation.
   *
   * ARCHITECTURE: Sequences async operations explicitly.
   * Eliminates race conditions by forcing order:
   * 1. Create person (if new)
   * 2. Wait for server ID
   * 3. Tag face with server ID
   * 4. Return result
   *
   * @param photoId - Photo to tag
   * @param personName - Person name (creates new if doesn't exist)
   * @param bbox - Face bounding box in UI coordinates (0-100)
   * @param collectionId - Collection ID (for person creation)
   * @param existingPersonId - If provided, uses existing person instead of creating
   */
  async tagFaceWithPerson(params: {
    photoId: ServerId;
    personName: string;
    bbox: UiBoundingBox;
    collectionId: ServerId;
    existingPersonId?: ServerId;
  }): Promise<{
    personId: ServerId;
    updatedFaces: FaceTagResponse[];
  }> {
    // Step 1: Get or create person
    const personId = params.existingPersonId
      || await this.createPersonAndReturnId(params.personName, params.collectionId);

    // Step 2: Update faces with server ID
    const faceTag: FaceTag = {
      person_id: personId,
      bbox: params.bbox,
    };

    const response = await this.updatePhotoFaces(params.photoId, [faceTag]);

    // Step 3: Return server ID and updated faces
    return {
      personId,
      updatedFaces: response.faces,
    };
  }

  // ==================== Invite System ====================

  /**
   * Get invite details (no auth required).
   * Used to preview invite before user signs in.
   */
  async getInviteDetails(token: string): Promise<InviteDetails> {
    return this.request(`/v1/collections/invite/${token}/details`);
  }

  /**
   * Accept an invite (requires auth).
   * Creates collection membership for authenticated user.
   */
  async acceptInvite(token: string): Promise<AcceptInviteResponse> {
    return this.request(`/v1/collections/accept-invite/${token}`, {
      method: 'POST',
    });
  }

  /**
   * Get collection members (requires membership).
   */
  async getCollectionMembers(collectionId: string): Promise<Member[]> {
    const response = await this.request<{ members: Member[] }>(
      `/v1/collections/${collectionId}/members`
    );
    return response.members;
  }

  /**
   * Get pending invites for a collection (owners only).
   */
  async getPendingInvites(collectionId: string): Promise<PendingInvite[]> {
    const response = await this.request<{ invites: PendingInvite[] }>(
      `/v1/collections/${collectionId}/invites`
    );
    return response.invites;
  }

  /**
   * Invite a user to a collection (owners only).
   * Returns immediate member if user exists, or pending invite if not.
   */
  async inviteToCollection(
    collectionId: string,
    request: InviteRequest
  ): Promise<InviteResponse> {
    return this.request(`/v1/collections/${collectionId}/invite`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Remove a member from a collection (owners only).
   */
  async removeMember(collectionId: string, userId: string): Promise<void> {
    return this.request(`/v1/collections/${collectionId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Cancel a pending invite (owners only).
   */
  async cancelInvite(collectionId: string, inviteId: string): Promise<void> {
    return this.request(`/v1/collections/${collectionId}/invites/${inviteId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Change a member's role (owners only).
   */
  async changeMemberRole(
    collectionId: string,
    userId: string,
    role: 'owner' | 'admin' | 'viewer'
  ): Promise<Member> {
    return this.request(`/v1/collections/${collectionId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  /**
   * Delete the current user's account permanently.
   * Returns impact summary of deleted/removed collections.
   */
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

  // ==================== Health Check ====================

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/');
  }
}

// Export singleton instance
export const azureApi = new AzureApiClient();

// Export class for testing
export { AzureApiClient };
