// src/api/role-service.ts
import { Role, Permission, DEFAULT_ROLES } from "../types/rbac";
import { env } from "@/app/config/env";
 
// Use the Django backend API URL from environment config
const API_BASE_URL = `${env.api.baseUrl}/api/v1/auth`;
 
// Django API response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}
 
export const roleService = {
  /**
   * Get all roles
   */
  async getRoles(): Promise<Role[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<Role[]> = await response.json();
     
      // Django API returns { success: true, data: [...roles] }
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      } else {
        console.warn("Unexpected response format, falling back to default roles");
        return DEFAULT_ROLES;
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      // Return default roles if API fails
      return DEFAULT_ROLES;
    }
  },
 
  /**
   * Get a role by ID
   */
  async getRole(roleId: string): Promise<Role | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<Role> = await response.json();
     
      // Django API returns { success: true, data: {...role} }
      if (data.success && data.data && data.data.id) {
        return data.data;
      } else {
        // Try to find in default roles
        const defaultRole = DEFAULT_ROLES.find(role => role.id === roleId);
        return defaultRole || null;
      }
    } catch (error) {
      console.error(`Error fetching role ${roleId}:`, error);
      // Try to find in default roles
      const defaultRole = DEFAULT_ROLES.find(role => role.id === roleId);
      return defaultRole || null;
    }
  },
 
  /**
   * Create a new role
   */
  async createRole(role: Omit<Role, "id" | "userCount">): Promise<Role> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify(role),
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<Role> = await response.json();
 
      // Django API returns { success: true, data: {...role} }
      if (data.success && data.data && data.data.id) {
        return data.data;
      } else {
        throw new Error(data.error || "Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      throw error;
    }
  },
 
  /**
   * Update a role
   */
  async updateRole(roleId: string, role: Partial<Role>): Promise<Role> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}/`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify(role),
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<Role> = await response.json();
 
      // Django API returns { success: true, data: {...role} }
      if (data.success && data.data && data.data.id) {
        return data.data;
      } else {
        throw new Error(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error(`Error updating role ${roleId}:`, error);
      throw error;
    }
  },
 
  /**
   * Delete a role
   */
  async deleteRole(roleId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<any> = await response.json();
 
      // Django API returns { success: true } on successful deletion
      if (data.success) {
        return true;
      } else {
        throw new Error(data.error || "Failed to delete role");
      }
    } catch (error) {
      console.error(`Error deleting role ${roleId}:`, error);
      throw error;
    }
  },
 
  /**
   * Update role permissions
   */
  async updateRolePermissions(roleId: string, permissions: Permission[]): Promise<Role> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}/permissions/`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify({ permissions }),
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<Role> = await response.json();
 
      // Django API returns { success: true, data: {...role} }
      if (data.success && data.data && data.data.id) {
        return data.data;
      } else {
        throw new Error(data.error || "Failed to update role permissions");
      }
    } catch (error) {
      console.error(`Error updating permissions for role ${roleId}:`, error);
      throw error;
    }
  },
 
  /**
   * Get users assigned to a role
   */
  async getRoleUsers(roleId: string): Promise<number> {
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}/users`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
 
      const data: ApiResponse<any> = await response.json();
 
      // Django API returns { success: true, count: number }
      if (data.success) {
        return data.count || 0;
      } else {
        throw new Error(data.error || "Failed to get role users");
      }
    } catch (error) {
      console.error(`Error getting users for role ${roleId}:`, error);
      // Return default count from DEFAULT_ROLES if available
      const defaultRole = DEFAULT_ROLES.find(role => role.id === roleId);
      return defaultRole?.userCount || 0;
    }
  }
};