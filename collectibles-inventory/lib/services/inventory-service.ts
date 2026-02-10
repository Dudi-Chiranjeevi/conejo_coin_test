import { handleApiError } from './error-handler';
import type { NGCData } from '@/app/ngc-integration/types/ngc';
import axios from "axios";

const API_BASE = process.env.BACKEND_URL || 
"https://www.conejocoin.net" ||
"https://conejo-backend-146447649143.us-central1.run.app";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Types
export interface Category {
  id: string;
  name: string;
  parent: string | null;
  custom_fields: Record<string, any>;
  client_id: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  type: 'site' | 'room' | 'shelf' | 'box' | 'row' | 'slot';
  parent: string | null;
  client_id: string;
  capacity?: number;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  category_name?: string;
  status: 'in_store' | 'in_transit' | 'consigned' | 'sold' | 'ebay';
  price: number;
  thumbnail?: string;
  images: string[];
  date_added: string;
  location?: string;
  location_name?: string;
  notes?: string;
  is_consigned: boolean;
  weight?: number;
  weight_unit?: 'g' | 'oz';
  attributes: Record<string, any>;
  client_id: string;
  created_at: string;
  updated_at: string;
}

export interface StatusHistory {
  id: string;
  item: string;
  old_status: string;
  new_status: string;
  timestamp: string;
  user: string;
  notes?: string;
}

export interface InventoryStats {
  total_items: number;
  total_value: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  recent_additions: number;
}

// Base API request function with credentials
async function apiRequest<T>(
  url: string, 
  method: string = 'GET', 
  data?: any
): Promise<T> {
  try {
    // Check if the URL already includes the API_BASE
    const fullUrl = url.startsWith('http') || url.startsWith(API_BASE) 
      ? url 
      : `${API_BASE}${url}`;
    
    console.log(`API Request to: ${fullUrl}`);
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      credentials: 'include', // Important for cookies
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(fullUrl, options);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleApiError(error);
  }
}

// Categories API
export const categoryApi = {
  getAll: (clientId: string) => 
    apiRequest<Category[]>(`/api/v1/inventory/categories/?client_id=${clientId}`),
  
  getTree: (clientId: string) => 
    apiRequest<Category[]>(`/api/v1/inventory/categories/tree/?client_id=${clientId}`),
  
  getById: (id: string) => 
    apiRequest<Category>(`/api/v1/inventory/categories/${id}/`),
  
  create: (category: Partial<Category>) => 
    apiRequest<Category>('/api/v1/inventory/categories/', 'POST', category),
  
  update: (id: string, category: Partial<Category>) => 
    apiRequest<Category>(`/api/v1/inventory/categories/${id}/`, 'PUT', category),
  
  delete: (id: string) => 
    apiRequest<void>(`/api/v1/inventory/categories/${id}/`, 'DELETE'),
  
  getItems: (id: string, status?: string) => {
    let url = `/api/v1/inventory/categories/${id}/items/`;
    if (status) {
      url += `?status=${status}`;
    }
    return apiRequest<InventoryItem[]>(url);
  }
};

// Locations API
export const locationApi = {
  getAll: (clientId: string) => 
    apiRequest<Location[]>(`${API_BASE}/api/v1/locations/locations/?client=${clientId}`),
  
  getTree: (clientId: string) => 
    apiRequest<Location[]>(`${API_BASE}/api/v1/locations/locations/tree/?client=${clientId}`),
  
  getById: (id: string) => 
    apiRequest<Location>(`${API_BASE}/api/v1/locations/locations/${id}/`),
  
  create: (location: Partial<Location>) => 
    apiRequest<Location>(`${API_BASE}/api/v1/locations/locations/`, 'POST', location),
  
  update: (id: string, location: Partial<Location>) => 
    apiRequest<Location>(`${API_BASE}/api/v1/locations/locations/${id}/`, 'PUT', location),
  
  delete: (id: string) => 
    apiRequest<void>(`${API_BASE}/api/v1/locations/locations/${id}/`, 'DELETE'),
  
  getItems: (id: string, status?: string) => {
    let url = `${API_BASE}/api/v1/locations/locations/${id}/items/`;
    if (status) {
      url += `?status=${status}`;
    }
    return apiRequest<InventoryItem[]>(url);
  }
};

// Inventory Items API
export const inventoryItemApi = {  
  async checkCertificateExists(certNumber: string): Promise<{ exists: boolean; item?: any }> {
    try {
      const { data } = await api.get(`/api/v1/ngc-integration/check-certificate/?cert_number=${certNumber}`);
      return data;
    } catch (error) {
      console.error("Error checking certificate existence:", error);
      return { exists: false };
    }
  },
  async saveNGCDataToInventory(
    ngcData: any,
    clientId: string,
    categoryId: string,
    price: number,
    status: "in_store" | "in_transit" | "consigned" | "sold" | "ebay",
    opts?: { locationId?: string; notes?: string; description?: string; name?: string; createdBy?: string; }
  ) {
    try {
      console.log("Saving NGC data to inventory:", {
        clientId,
        categoryId,
        price,
        status,
        opts
      });
      
      const payload = {
        client_id: clientId,
        category_id: categoryId,
        status,
        price,
        location_id: opts?.locationId || null,
        notes: opts?.notes || "",
        description: opts?.description || "",
        name: opts?.name || "",
        created_by: opts?.createdBy || null,
        ngc_data: ngcData, // send raw; server will normalize
      };

      console.log("API call payload:", payload);
      console.log("API endpoint:", `${API_BASE}/api/v1/ngc-integration/from-ngc/`);
      
      const { data } = await api.post("/api/v1/ngc-integration/from-ngc/", payload);
      console.log("API call successful, response:", data);
      return data;
    } catch (error) {
      console.error("Error saving NGC data to inventory:", error);
      throw error;
    }
  },
};

// Status History API
export const statusHistoryApi = {
  getAll: (params?: Record<string, string>) => {
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString() 
      : '';
    return apiRequest<StatusHistory[]>(`/api/v1/status-history/${queryString}`);
  },
  
  getByItem: (itemId: string) => 
    apiRequest<StatusHistory[]>(`/api/v1/status-history/?item=${itemId}`)
};
