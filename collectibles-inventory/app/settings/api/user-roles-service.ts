// src/api/user-roles-service.ts
import { CreateUserRoleRequest } from "../types/user-roles";
import { PermissionMatrixData, ModulePermissionData } from "../types/rbac";
import { env } from "@/app/config/env";
 
const API_BASE_URL = `${env.api.baseUrl}/api/v1/auth`;
 
// ADDED: Numeric module ID constants
export const MODULE_IDS = {
  INVENTORY: 1,
  LOCATIONS: 2,
  EBAY: 3,
  REPORTS: 4,
  USERS: 5,
  ROLES: 6,
  SETTINGS: 7
} as const;
 
export const MODULE_NAMES = {
  1: 'Inventory Management',
  2: 'Location Management',
  3: 'Ebay Integration',
  4: 'Reports & Analytics',
  5: 'User Management',
  6: 'Role Management',
  7: 'System Settings'
} as const;
 
export type ModuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
 
export const userRolesService = {
  /**
   * Get all UserRoles from the new table
   */
  async getUserRoles(): Promise<any[]> {
    try {
      console.log("🔄 [UserRoles Service] Fetching UserRoles from:", `${API_BASE_URL}/user-roles/`);
     
      const response = await fetch(`${API_BASE_URL}/user-roles/`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
 
      console.log("📨 [UserRoles Service] Response status:", response.status);
      console.log("📨 [UserRoles Service] Response ok:", response.ok);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          // Try to parse as JSON first
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          // If JSON parsing fails, get as text
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] HTTP error details:", {
          status: response.status,
          statusText: response.statusText,
          url: `${API_BASE_URL}/user-roles/`,
          details: errorDetails
        });
       
        // Provide more specific error messages based on status code
        if (response.status === 404) {
          throw new Error(`API endpoint not found (404). Check if the backend server is running and URLs are correct.`);
        } else if (response.status === 500) {
          throw new Error(`Server error (500): ${errorDetails}`);
        } else if (response.status === 403) {
          throw new Error(`Permission denied (403): You don't have access to this resource`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}. Details: ${errorDetails}`);
        }
      }
 
      const responseData = await response.json();
      console.log("✅ [UserRoles Service] UserRoles fetched successfully, count:", responseData.length);
 
      return responseData;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error fetching user roles:", error);
     
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Cannot connect to the server. Make sure the Django backend is running on localhost:8000.');
      }
     
      throw error;
    }
  },
 
  /**
   * Create a new UserRole in the new table
   */
  async createUserRole(roleData: CreateUserRoleRequest): Promise<any> {
    try {
      console.log("🔄 [UserRoles Service] Creating UserRole with data:", roleData);
     
      const response = await fetch(`${API_BASE_URL}/user-roles/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify(roleData),
      });
 
      console.log("📨 [UserRoles Service] Response status:", response.status);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] HTTP error details:", {
          status: response.status,
          statusText: response.statusText,
          details: errorDetails
        });
       
        if (response.status === 400) {
          throw new Error(`Validation error: ${errorDetails}`);
        } else if (response.status === 500) {
          throw new Error(`Server error: ${errorDetails}`);
        } else {
          throw new Error(`Failed to create role: ${response.status} ${response.statusText}`);
        }
      }
 
      const responseData = await response.json();
      console.log("✅ [UserRoles Service] UserRole created successfully:", responseData);
 
      return responseData;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error creating user role:", error);
      throw error;
    }
  },
 
  /**
   * Delete a UserRole
   */
  async deleteUserRole(roleId: string): Promise<boolean> {
    try {
      console.log("🔄 [UserRoles Service] Deleting UserRole:", roleId);
     
      const response = await fetch(`${API_BASE_URL}/user-roles/${roleId}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
 
      console.log("📨 [UserRoles Service] Delete response status:", response.status);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] HTTP error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails
        });
       
        throw new Error(`Failed to delete role: ${response.status} ${response.statusText}`);
      }
 
      console.log("✅ [UserRoles Service] UserRole deleted successfully");
      return true;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error deleting user role:", error);
      throw error;
    }
  },
 
  /**
   * Update a UserRole
   */
  async updateUserRole(roleId: string, roleData: Partial<CreateUserRoleRequest>): Promise<any> {
    try {
      console.log("🔄 [UserRoles Service] Updating UserRole:", roleId, roleData);
     
      const response = await fetch(`${API_BASE_URL}/user-roles/${roleId}/`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify(roleData),
      });
 
      console.log("📨 [UserRoles Service] Update response status:", response.status);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] HTTP error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails
        });
       
        throw new Error(`Failed to update role: ${response.status} ${response.statusText}`);
      }
 
      const responseData = await response.json();
      console.log("✅ [UserRoles Service] UserRole updated successfully:", responseData);
 
      return responseData;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error updating user role:", error);
      throw error;
    }
  },
 
  /**
   * Save permission matrix - UPDATED to handle module_name
   */
  async savePermissions(permissionsData: PermissionMatrixData): Promise<any> {
    try {
      console.log("🔄 [UserRoles Service] Saving permissions matrix with module_name support...");
      console.log("📦 [UserRoles Service] Permissions data structure:", {
        roles: Object.keys(permissionsData).length,
        modules: Object.keys(permissionsData[Object.keys(permissionsData)[0]] || {}).length,
        sampleModuleData: permissionsData[Object.keys(permissionsData)[0]]?.[Object.keys(permissionsData[Object.keys(permissionsData)[0]] || {})[0]]
      });
     
      const response = await fetch(`${API_BASE_URL}/permission-matrix/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissions: permissionsData
        }),
      });
 
      console.log("📨 [UserRoles Service] Permissions response status:", response.status);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] Permissions HTTP error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails
        });
       
        throw new Error(`Failed to save permissions: ${response.status} ${response.statusText}`);
      }
 
      const result = await response.json();
      console.log("✅ [UserRoles Service] Permissions saved successfully:", result);
      return result;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error saving permissions:", error);
      throw error;
    }
  },
 
  /**
   * Get permission matrix - UPDATED to handle module_name
   */
  async getPermissions(): Promise<PermissionMatrixData> {
    try {
      console.log("🔄 [UserRoles Service] Fetching permissions matrix with module_name...");
     
      const response = await fetch(`${API_BASE_URL}/permission-matrix/`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
 
      console.log("📨 [UserRoles Service] Permissions GET response status:", response.status);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] Permissions GET HTTP error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails
        });
       
        throw new Error(`Failed to fetch permissions: ${response.status} ${response.statusText}`);
      }
 
      const result = await response.json();
      console.log("✅ [UserRoles Service] Permissions fetched successfully, structure:", {
        roles: Object.keys(result).length,
        hasModuleName: Object.values(result).some((roleData: any) =>
          Object.values(roleData).some((moduleData: any) => 'module_name' in moduleData)
        )
      });
     
      return result;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error fetching permissions:", error);
      throw error;
    }
  },
 
  /**
   * NEW: Populate module_name for existing records (one-time operation)
   */
  async populateModuleNames(): Promise<any> {
    try {
      console.log("🔄 [UserRoles Service] Populating module_name for existing records...");
     
      const response = await fetch(`${API_BASE_URL}/populate-module-names/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
 
      console.log("📨 [UserRoles Service] Populate module_name response status:", response.status);
     
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (parseError) {
          errorDetails = await response.text();
        }
       
        console.error("❌ [UserRoles Service] Populate module_name HTTP error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails
        });
       
        throw new Error(`Failed to populate module names: ${response.status} ${response.statusText}`);
      }
 
      const result = await response.json();
      console.log("✅ [UserRoles Service] Module names populated successfully:", result);
      return result;
    } catch (error) {
      console.error("💥 [UserRoles Service] Error populating module names:", error);
      throw error;
    }
  },
 
  // ADDED: Helper functions for numeric module IDs
  getModuleName(moduleId: number): string {
    return MODULE_NAMES[moduleId as ModuleId] || `Module ${moduleId}`;
  },
 
  getAllModuleIds(): number[] {
    return [1, 2, 3, 4, 5, 6, 7];
  },
 
  // NEW: Helper to ensure module_name is included in permission data
  ensureModuleNameInPermissions(permissionsData: PermissionMatrixData): PermissionMatrixData {
    const updatedData: PermissionMatrixData = { ...permissionsData };
   
    Object.keys(updatedData).forEach(roleId => {
      Object.keys(updatedData[roleId]).forEach(moduleId => {
        const moduleData = updatedData[roleId][moduleId];
        if (!moduleData.module_name) {
          const numericModuleId = parseInt(moduleId);
          updatedData[roleId][moduleId] = {
            ...moduleData,
            module_name: this.getModuleName(numericModuleId)
          };
        }
      });
    });
   
    return updatedData;
  }
};