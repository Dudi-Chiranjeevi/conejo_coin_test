import axios, { InternalAxiosRequestConfig } from 'axios';
import { InventoryItem } from '../types/inventory';
import env from '../../config/env';

// API base URL from centralized config
const API_BASE_URL = env.api.baseUrl;
const isDevelopment = env.isDevelopment;

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL.replace(/\/$/, ''), // Remove trailing slash
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: env.api.withCredentials, // From config
  timeout: env.api.timeout, // From config
});

// Add CSRF token and Firebase token to requests if available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Add CSRF token for Django's CSRF protection
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${env.auth.csrfCookieName}=`))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    
    // Add Firebase token as Bearer token for authentication
    const firebaseToken = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${env.auth.firebaseCookieName}=`))
      ?.split('=')[1];
      
    if (firebaseToken) {
      config.headers['Authorization'] = `Bearer ${firebaseToken}`;
      console.log('Added Firebase token to request', firebaseToken);
    } else {
      console.warn('No Firebase token found in cookies');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Type for API responses with pagination
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Type for inventory item filters
export interface InventoryFilters {
  category?: string;
  status?: string;
  search?: string;
  identification_number?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  date_added_after?: string;
  date_added_before?: string;
  is_consigned?: boolean;
  has_images?: boolean;
  page?: number;
  page_size?: number;
  ordering?: string;
  search_attributes?: string;
  weight_unit?: 'g' | 'oz';
  is_listed?: boolean;
}

// Mock data for fallback during development
// const mockInventoryItems: InventoryItem[] = [
//   {
//     id: '1',
//     name: 'Gold Coin',
//     category: 'Coins',
//     status: 'in_store',
//     price: '1299.99',
//     description: 'Rare gold coin from 1850',
//     thumbnail: '/images/coin.jpg',
//     images: [],
//     notes: 'Excellent condition',
//     weight: '31.1',
//     weight_unit: 'g',
//     date_added: new Date().toISOString(),
//   },
//   {
//     id: '2',
//     name: 'Silver Stamp Collection',
//     category: 'Stamps',
//     status: 'in_transit',
//     price: '499.99',
//     description: 'Collection of rare stamps',
//     thumbnail: '/images/stamp.jpg',
//     images: [],
//     notes: 'From European countries',
//     weight: '5',
//     weight_unit: 'g',
//     date_added: new Date().toISOString(),
//   },
// ];

// Inventory API service
export const inventoryApi = {
  // Get all inventory items with optional filters
  async getItems(filters: InventoryFilters = {}): Promise<PaginatedResponse<InventoryItem>> {
    try {
      // Ensure pagination parameters are valid
      const validatedFilters = {
        ...filters,
        page: Math.max(1, Number(filters.page) || 1),
        page_size: Number(filters.page_size) || 15,
        // Default to sorting by most recent update
        ordering: filters.ordering || '-updated_at',
      };
      
      // Explicitly request all needed fields
      const params = {
        ...validatedFilters,
        fields: 'id,name,category,status,price,description,location,location_path,attributes,images,date_added,updated_at,updated_by,notes,category_name,location_name'
      };
      
      console.log(`API Request: GET /api/v1/inventory/inventory_items/ with params:`, params);
      const response = await apiClient.get('/api/v1/inventory/inventory_items/', { params });
      
      // Process the response to ensure descriptions are available
      if (response.data && response.data.results && Array.isArray(response.data.results)) {
        response.data.results = response.data.results.map((item: any) => {
          // If description is missing, try to extract it from attributes
          if (!item.description && item.attributes) {
            try {
              const attrs = typeof item.attributes === 'string'
                ? JSON.parse(item.attributes)
                : item.attributes;
                
              if (attrs) {
                // Try to find description in attributes
                if (attrs.description) {
                  item.description = attrs.description;
                }
                // Or in metadata section
                else if (attrs.metadata && attrs.metadata.description) {
                  item.description = attrs.metadata.description;
                }
                // Or in coin section
                else if (attrs.coin && attrs.coin.description) {
                  item.description = attrs.coin.description;
                }
                // Or use notes if available
                else if (attrs.notes) {
                  item.description = attrs.notes;
                }
                // Generate a description for coins if none exists
                else if (attrs.coin && attrs.grade) {
                  const year = attrs.coin.year || '';
                  const denomination = attrs.coin.denomination || '';
                  const mintMark = attrs.coin.mint_mark || '';
                  const grade = attrs.grade.display || '';
                  
                  if (year || denomination || mintMark) {
                    item.description = `${year} ${mintMark} ${denomination} ${grade}`.trim();
                  }
                }
              }
            } catch (e) {
              console.warn('Error extracting description from attributes:', e);
            }
          }
          
          return item;
        });
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error fetching inventory items:', error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
        
        // Handle specific error cases
        if (error.response.status === 400 && error.response.data?.detail?.includes('page')) {
          console.warn('Pagination error detected, falling back to page 1');
          // Try again with page 1 if there was a pagination error
          return this.getItems({ ...filters, page: 1 });
        }
      }
      
      throw error;
    }
  },

  // Check if a certificate number already exists in inventory
  async checkCertificateExists(certNumber: string): Promise<{exists: boolean, item?: any}> {
    try {
      const response = await apiClient.get(`/api/v1/ngc-integration/check-certificate-exists/`, {
        params: { cert_number: certNumber }
      });
      return response.data;
    } catch (error) {
      console.error(`Error checking if certificate ${certNumber} exists:`, error);
      // Return false on error to be safe
      return { exists: false };
    }
  },

  // Get a specific inventory item by ID
  async getItem(id: string): Promise<InventoryItem> {
    try {
      // Request the item with specific fields included
      const response = await apiClient.get(`/api/v1/inventory/inventory_items/${id}/`, {
        params: {
          fields: 'id,name,category,status,price,description,location,location_path,attributes,images,date_added,notes'
        }
      });
      
      // Process the response to ensure description is available
      const item = response.data;
      
      // If description isn't in the response but exists in the database
      // Try to fetch it directly using a separate endpoint if needed
      if (!item.description && id) {
        try {
          const detailResponse = await apiClient.get(`/api/v1/inventory/inventory_items/${id}/details/`);
          if (detailResponse.data && detailResponse.data.description) {
            item.description = detailResponse.data.description;
          }
        } catch (detailError) {
          console.warn(`Could not fetch additional details for item ${id}:`, detailError);
        }
      }
      
      return item;
    } catch (error) {
      console.error(`Error fetching inventory item ${id}:`, error);
      throw error;
    }
  },

  // Create a new inventory item
  async createItem(item: Omit<InventoryItem, 'id'>, userId?: string): Promise<InventoryItem> {
    try {
      // Add created_by field if userId is provided
      const itemWithCreator = userId ? { ...item, created_by: userId } : item;
      
      // Log the request payload for debugging
      console.log('Creating inventory item with payload:', JSON.stringify(itemWithCreator, null, 2));
      
      const response = await apiClient.post('/api/v1/inventory/inventory_items/', itemWithCreator);
      return response.data;
    } catch (error: any) {
      console.error('Error creating inventory item:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
      } else if (error.request) {
        console.error('Error request:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      throw error;
    }
  },

  // Delete an inventory item
  async deleteItem(id: string): Promise<void> {
    try {
      // Log the item ID being deleted for debugging
      console.log(`Attempting to delete inventory item with ID: ${id}`);
      
      // Check if the ID is valid
      if (!id || typeof id !== 'string') {
        console.error('Invalid item ID for deletion:', id);
        throw new Error('Invalid item ID for deletion');
      }
      
      // Format the endpoint URL - remove any trailing slashes from the ID
      const cleanId = id.toString().replace(/\/+$/, '');
      
      // Check if ID is a UUID format (most likely expected by the backend)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(cleanId)) {
        console.warn(`Item ID ${cleanId} does not appear to be a valid UUID format`);
      }
      
      const endpoint = `/api/v1/inventory/inventory_items/${cleanId}/`;
      console.log(`DELETE request to endpoint: ${endpoint}`);
      
      // Make the API call
      await apiClient.delete(endpoint);
      console.log(`Successfully deleted item with ID: ${cleanId}`);
    } catch (error: any) {
      console.error(`Error deleting inventory item ${id}:`, error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
        
        // If we get a 404, try an alternative endpoint format without trailing slash
        if (error.response.status === 404) {
          try {
            console.log('Attempting alternative endpoint format without trailing slash');
            const cleanId = id.toString().replace(/\/+$/, '');
            const alternativeEndpoint = `/api/v1/inventory/inventory_items/${cleanId}`;
            console.log(`Retry DELETE request to endpoint: ${alternativeEndpoint}`);
            await apiClient.delete(alternativeEndpoint);
            console.log(`Successfully deleted item with ID: ${cleanId} using alternative endpoint`);
            return;
          } catch (retryError: any) {
            console.error('Alternative endpoint also failed:', retryError);
          }
        }
      } else if (error.request) {
        console.error('Error request:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      throw error;
    }
  },

  // Update an existing inventory item
  async updateItem(id: string, item: Partial<InventoryItem>): Promise<InventoryItem> {
    try {
      // Clean the ID by removing any trailing slashes
      const cleanId = id.toString().replace(/\/+$/, '');
      console.log(`Updating item with cleaned ID: ${cleanId}`);
      console.log('Update payload:', JSON.stringify(item, null, 2));
      
      try {
        const response = await apiClient.patch(`/api/v1/inventory/inventory_items/${cleanId}/`, item);
        console.log('Update successful:', response.data);
        return response.data;
      } catch (patchError: any) {
        console.error(`Error updating inventory item ${cleanId}:`, patchError);
        
        if (patchError.response) {
          console.error('Error response status:', patchError.response.status);
          console.error('Error response data:', patchError.response.data);
          
          // If we get a 404, try an alternative endpoint format without trailing slash
          if (patchError.response.status === 404) {
            try {
              console.log('Attempting alternative endpoint format without trailing slash');
              const alternativeEndpoint = `/api/v1/inventory/inventory_items/${cleanId}`;
              console.log(`Retry PATCH request to endpoint: ${alternativeEndpoint}`);
              const retryResponse = await apiClient.patch(alternativeEndpoint, item);
              console.log(`Successfully updated item with ID: ${cleanId} using alternative endpoint`);
              return retryResponse.data;
            } catch (retryError: any) {
              console.error('Alternative endpoint also failed:', retryError);
            }
          }
        }
        
        throw patchError;
      }
    } catch (error) {
      console.error(`Error in updateItem for ${id}:`, error);
      // if (isDevelopment) {
      //   console.warn('Using mock data as fallback in development mode');
      //   const index = mockInventoryItems.findIndex((i: any) => i.id === id);
      //   if (index >= 0) {
      //     mockInventoryItems[index] = { ...mockInventoryItems[index], ...item };
      //     return mockInventoryItems[index] as InventoryItem;
      //   }
      // }
      throw error;
    }
  },

  // Update only the status of an item
  async updateItemStatus(id: string, status: string): Promise<InventoryItem> {
    try {
      const response = await apiClient.patch(`/api/v1/inventory/inventory_items/${id}/update_status/`, { status });
      return response.data;
    } catch (error) {
      console.error(`Error updating status for item ${id}:`, error);
      throw error;
    }
  },

  // Bulk update status for multiple items
  async bulkUpdateStatus(itemIds: string[], status: string): Promise<any> {
    try {
      const response = await apiClient.post('/api/v1/inventory/inventory_items/bulk_update_status/', {
        item_ids: itemIds,
        status,
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk updating item statuses:', error);
      throw error;
    }
  },

  // Get items grouped by status
  async getItemsByStatus(): Promise<any> {
    try {
      const response = await apiClient.get('/api/v1/inventory/inventory_items/by_status/');
      return response.data;
    } catch (error) {
      console.error('Error fetching items by status:', error);
      throw error;
    }
  },

  // Get inventory statistics
  async getStats(): Promise<any> {
    try {
      const response = await apiClient.get('/api/v1/inventory/inventory_items/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory statistics:', error);
      throw error;
    }
  },

  // Get upload URL for images
  async getUploadUrl(fileInfo: { filename: string; content_type: string }): Promise<any> {
    try {
      const response = await apiClient.post('/api/v1/inventory/inventory_items/get_upload_url/', fileInfo);
      return response.data;
    } catch (error) {
      console.error('Error getting upload URL:', error);
      throw error;
    }
  },
  
  // ------- Shelf-based bulk upload (locations) -------
  async getLocationTree(clientId: string): Promise<any[]> {
    const resp = await apiClient.get('/api/v1/locations/locations/tree/', { params: { client: clientId } });
    return resp.data;
  },

  async getShelfSlots(shelfId: string): Promise<{
    site: string; room: string; shelf: string;
    total: number; empty: number; filled: number;
    rows: Array<{ status: 'FILLED'|'EMPTY'; cert_num: string; price: string; box: string; row: string; slot: string; slot_id: string }>;
  }> {
    // Canonical DRF router path with trailing slash
    const resp = await apiClient.get(`/api/v1/locations/locations/${shelfId}/slots/`);
    return resp.data;
  },

  async downloadShelfTemplate(shelfId: string, format: 'xlsx'|'csv' = 'xlsx'): Promise<Blob> {
    // Canonical DRF router path with trailing slash
    const resp = await apiClient.get(`/api/v1/locations/locations/${shelfId}/template/`, {
      // Use file_format to avoid renderer conflicts with 'format'
      params: { file_format: format },
      responseType: 'blob',
    });
    return resp.data;
  },

  async uploadShelfTemplate(shelfId: string, file: File): Promise<{ ok: boolean; accepted: any[]; errors?: string[]; summary?: any }>{
    const form = new FormData();
    form.append('file', file);
    // Canonical DRF router path with trailing slash
    const resp = await apiClient.post(`/api/v1/locations/locations/${shelfId}/upload-template/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return resp.data;
  },
};

export default inventoryApi;
