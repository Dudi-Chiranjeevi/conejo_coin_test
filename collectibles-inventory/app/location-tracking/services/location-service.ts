import { api } from "@/lib/api";
import { Location, LocationTreeNode } from "../types/location";

/**
 * Service for managing locations
 */
export const LocationService = {
  /**
   * Get location tree for a client
   */
  async getLocationTree(clientId: string): Promise<LocationTreeNode[]> {
    // Backend expects 'client' param and routes are nested under /locations/locations/
    return api<LocationTreeNode[]>(`/locations/locations/tree/?client=${clientId}`);
  },

  /**
   * Create a new location
   */
  async createLocation(location: Partial<Location>): Promise<Location> {
    return api<Location>("/locations/locations/", {
      method: "POST",
      body: JSON.stringify(location),
    });
  },

  /**
   * Update an existing location
   */
  async updateLocation(id: string, location: Partial<Location>): Promise<Location> {
    // Clean ID to prevent trailing slashes
    const cleanId = id.replace(/\/$/, "");
    // Detail endpoint under nested router
    return api<Location>(`/locations/locations/${cleanId}/`, {
      method: "PATCH",
      body: JSON.stringify(location),
    });
  },

  /**
   * Delete a location
   */
  async deleteLocation(id: string): Promise<void> {
    // Clean ID to prevent trailing slashes
    const cleanId = id.replace(/\/$/, "");
    
    try {
      await api(`/locations/locations/${cleanId}/`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Error deleting location:", error);
      throw error;
    }
  }
};
