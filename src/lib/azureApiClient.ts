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

export interface UpdateFacesResponse {
  photo_id: ServerId;  // Changed from string
  faces: FaceTagResponse[];
}

export interface CreatePersonRequest {
  name: string;
  collection_id: ServerId;  // Changed from string
}

export interface UpdatePersonRequest {
  name: string;
}

export interface PersonResponse {
  id: ServerId;  // Changed from string
  name: string;
  collection_id: ServerId;  // Changed from string
  thumbnail_url: string | null;
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
        const error = await response.json().catch(() => ({
          error: 'unknown',
          message: response.statusText
        }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
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

    const response = await this.request<any>(`/v1/photos/${photoId}/faces`, {
      method: 'POST',
      body: JSON.stringify({ faces: normalizedFaces }),
    });

    // COORDINATE CONVERSION: API (0-1) → UI (0-100)
    // Transform response back to UI coordinates
    return {
      photo_id: response.photo_id,
      faces: response.faces.map((face: any) => ({
        id: face.id,
        person_id: face.person_id,
        bbox: apiBboxToUi({
          x: apiCoord(face.bbox.x),
          y: apiCoord(face.bbox.y),
          width: apiCoord(face.bbox.width),
          height: apiCoord(face.bbox.height),
        }),
      })),
    };
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
    return this.request(`/v1/people/${personId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
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

  // ==================== Health Check ====================

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/');
  }
}

// Export singleton instance
export const azureApi = new AzureApiClient();

// Export class for testing
export { AzureApiClient };
