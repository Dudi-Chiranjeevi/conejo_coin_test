// services/ebayApi.ts
import { useToast } from "@/components/ui/use-toast"
import env from '../../config/env';

// API base URL from centralized config
const API_BASE_URL = env.api.baseUrl;

export interface EbayListingPayload {
  sku: string | number
  title: string
  description: string
  price: number
  quantity: number
  category_id: string
  image_urls: string[]
  aspects: Record<string, string[]>
  currency: string
  listing_duration: string
  inventory_item_id:string | number
}

export interface EbayListingResponse {
  success: boolean
  listing_id?: string
  offer_id?: string
  listing_url?: string
  message?: string
  error?: string
}

export interface DashboardSettings {
  refresh_enabled: boolean
  refresh_interval: number
}

export interface SyncSettings {
  auto_sync_enabled: boolean
  sync_interval: number
}

export interface EbaySettings {
  dashboard: DashboardSettings
  sync: SyncSettings
}

export interface EbaySettingsResponse {
  success: boolean
  data?: EbaySettings
  error?: string
}

export interface EbayUpdatePayload {
  offer_id: string;
  new_price: number;
  new_quantity: number;
}

class EbayApiService {
  private baseUrl = `${API_BASE_URL}/api/v1/ebay`

  async createListing(listingData: EbayListingPayload): Promise<EbayListingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/create-listing/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listingData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Failed to create eBay listing:', error)
      throw error
    }
  }

  async checkListingExists(itemId: string): Promise<{ exists: boolean; listing?: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/check-listing/?item_id=${itemId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Failed to check listing:', error)
      throw error
    }
  }

  async getListingBySku(sku: string): Promise<{ exists: boolean; listing?: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/listing-by-sku/${sku}/`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Failed to get listing by SKU:', error)
      throw error
    }
  }

  async updateListing(updateData: EbayUpdatePayload): Promise<EbayListingResponse> {
    try {
      console.log('🔄 Frontend sending update:', updateData);
      
      const response = await fetch(`${this.baseUrl}/update-listing/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Frontend update failed:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update eBay listing:', error);
      throw error;
    }
  }

  async getSettings(): Promise<EbaySettingsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/settings/`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Failed to fetch eBay settings:', error)
      throw error
    }
  }

  async updateSettings(settings: Partial<EbaySettings>): Promise<EbaySettingsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/settings/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Failed to update eBay settings:', error)
      throw error
    }
  }
}

export const ebayApi = new EbayApiService()