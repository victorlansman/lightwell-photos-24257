/**
 * Azure Backend API Client
 *
 * Handles all communication with FastAPI backend.
 * Uses Supabase JWT tokens for authentication.
 */

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
  id: string;
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
    id: string;
    name: string;
    face_bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null;
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

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceTag {
  person_id: string | null;
  bbox: FaceBoundingBox;
}

export interface UpdateFacesRequest {
  faces: FaceTag[];
}

export interface FaceTagResponse {
  id: string;
  person_id: string | null;
  bbox: FaceBoundingBox;
}

export interface UpdateFacesResponse {
  photo_id: string;
  faces: FaceTagResponse[];
}

export interface CreatePersonRequest {
  name: string;
  collection_id: string;
}

export interface UpdatePersonRequest {
  name: string;
}

export interface PersonResponse {
  id: string;
  name: string;
  collection_id: string;
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

    return this.request(endpoint);
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
    photoId: string,
    faces: FaceTag[]
  ): Promise<UpdateFacesResponse> {
    return this.request(`/v1/photos/${photoId}/faces`, {
      method: 'POST',
      body: JSON.stringify({ faces }),
    });
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

  // ==================== Health Check ====================

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/');
  }
}

// Export singleton instance
export const azureApi = new AzureApiClient();

// Export class for testing
export { AzureApiClient };
