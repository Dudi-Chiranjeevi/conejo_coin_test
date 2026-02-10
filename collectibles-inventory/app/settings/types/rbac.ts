export interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: Permission[];
  userCount: number;
  isCustom: boolean;
  createdAt?: string;
  updatedAt?: string;
  originalData?: any;
}
 
export interface Permission {
  id: string;
  module: number; // CHANGED: from string to number
  action: "view" | "create" | "edit" | "delete" | "admin";
  granted: boolean;
}
 
export interface PermissionModule {
  id: number; // CHANGED: from string to number
  name: string;
  description: string;
  permissions: PermissionAction[];
}
 
export interface PermissionAction {
  id: string;
  name: string;
  description: string;
  value: "view" | "create" | "edit" | "delete" | "admin";
}
 
// ADDED: Module ID constants for numeric IDs
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
 
// NEW: Interface for module permission data with module_name
export interface ModulePermissionData {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  module_name?: string; // ADDED: module name from database
}
 
// NEW: Interface for permission matrix data
export interface PermissionMatrixData {
  [roleId: string]: {
    [moduleId: string]: ModulePermissionData;
  };
}
 
// UPDATED: PERMISSION_MODULES with numeric IDs
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: MODULE_IDS.INVENTORY, // CHANGED: from "inventory" to 1
    name: "Inventory Management",
    description: "Manage collectible items in the inventory",
    permissions: [
      {
        id: "inventory_view",
        name: "View",
        description: "View inventory items",
        value: "view"
      },
      {
        id: "inventory_create",
        name: "Create",
        description: "Create new inventory items",
        value: "create"
      },
      {
        id: "inventory_edit",
        name: "Edit",
        description: "Edit existing inventory items",
        value: "edit"
      },
      {
        id: "inventory_delete",
        name: "Delete",
        description: "Delete inventory items",
        value: "delete"
      }
    ]
  },
  {
    id: MODULE_IDS.LOCATIONS, // CHANGED: from "locations" to 2
    name: "Location Management",
    description: "Manage storage locations for collectibles",
    permissions: [
      {
        id: "locations_view",
        name: "View",
        description: "View locations",
        value: "view"
      },
      {
        id: "locations_create",
        name: "Create",
        description: "Create new locations",
        value: "create"
      },
      {
        id: "locations_edit",
        name: "Edit",
        description: "Edit existing locations",
        value: "edit"
      },
      {
        id: "locations_delete",
        name: "Delete",
        description: "Delete locations",
        value: "delete"
      }
    ]
  },
  {
    id: MODULE_IDS.EBAY, // CHANGED: from "ebay" to 3
    name: "eBay Integration",
    description: "Manage eBay listings, prices, and synchronization",
    permissions: [
      { id: "ebay_view", name: "View", description: "View eBay listings and item status", value: "view" },
      { id: "ebay_create", name: "Create", description: "Create new eBay listings from inventory", value: "create" },
      { id: "ebay_edit", name: "Edit", description: "Edit eBay listings and prices", value: "edit" },
      { id: "ebay_delete", name: "Delete", description: "Remove eBay listings", value: "delete" },
    ]
  },
  {
    id: MODULE_IDS.REPORTS, // CHANGED: from "reports" to 4
    name: "Reports & Analytics",
    description: "Access and generate reports",
    permissions: [
      {
        id: "reports_view",
        name: "View",
        description: "View reports and analytics",
        value: "view"
      },
      {
        id: "reports_create",
        name: "Create",
        description: "Create custom reports",
        value: "create"
      },
      {
        id: "reports_edit",
        name: "Edit",
        description: "Edit report settings",
        value: "edit"
      },
      {
        id: "reports_delete",
        name: "Delete",
        description: "Delete saved reports",
        value: "delete"
      }
    ]
  },
  {
    id: MODULE_IDS.USERS, // CHANGED: from "users" to 5
    name: "User Management",
    description: "Manage system users",
    permissions: [
      {
        id: "users_view",
        name: "View",
        description: "View users and permissions",
        value: "view"
      },
      {
        id: "users_create",
        name: "Create",
        description: "Create new users",
        value: "create"
      },
      {
        id: "users_edit",
        name: "Edit",
        description: "Edit existing users",
        value: "edit"
      },
      {
        id: "users_delete",
        name: "Delete",
        description: "Delete custom users",
        value: "delete"
      }
    ]
  },
  {
    id: MODULE_IDS.ROLES, // CHANGED: from "roles" to 6
    name: "Role Management",
    description: "Manage user roles and permissions",
    permissions: [
      {
        id: "roles_view",
        name: "View",
        description: "View roles and permissions",
        value: "view"
      },
      {
        id: "roles_create",
        name: "Create",
        description: "Create new roles",
        value: "create"
      },
      {
        id: "roles_edit",
        name: "Edit",
        description: "Edit existing roles",
        value: "edit"
      },
      {
        id: "roles_delete",
        name: "Delete",
        description: "Delete custom roles",
        value: "delete"
      }
    ]
  },
  {
    id: MODULE_IDS.SETTINGS, // CHANGED: from "settings" to 7
    name: "System Settings",
    description: "Configure system settings",
    permissions: [
      {
        id: "settings_view",
        name: "View",
        description: "View settings and permissions",
        value: "view"
      },
      {
        id: "settings_create",
        name: "Create",
        description: "Create new settings",
        value: "create"
      },
      {
        id: "settings_edit",
        name: "Edit",
        description: "Edit existing settings",
        value: "edit"
      },
      {
        id: "settings_delete",
        name: "Delete",
        description: "Delete custom settings",
        value: "delete"
      }
    ]
  }
];
 
// UPDATED: DEFAULT_ROLES with numeric module IDs
export const DEFAULT_ROLES: Role[] = [
  {
    id: "super-admin",
    name: "Super Administrator",
    description: "Complete system control and configuration",
    color: "#9C27B0",
    permissions: PERMISSION_MODULES.flatMap(module =>
      module.permissions.map(permission => ({
        id: permission.id,
        module: module.id, // Now using numeric ID directly
        action: permission.value,
        granted: true
      }))
    ),
    userCount: 1,
    isCustom: false
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access with user management",
    color: "#2196F3",
    permissions: PERMISSION_MODULES.flatMap(module =>
      module.permissions.map(permission => ({
        id: permission.id,
        module: module.id, // Now using numeric ID directly
        action: permission.value,
        granted: module.id !== MODULE_IDS.ROLES || permission.value !== "admin"
      }))
    ),
    userCount: 3,
    isCustom: false
  },
  {
    id: "manager",
    name: "Manager",
    description: "Department management and reporting access",
    color: "#FF9800",
    permissions: PERMISSION_MODULES.flatMap(module =>
      module.permissions.map(permission => ({
        id: permission.id,
        module: module.id, // Now using numeric ID directly
        action: permission.value,
        granted: (module.id === MODULE_IDS.INVENTORY ||
                 module.id === MODULE_IDS.LOCATIONS ||
                 module.id === MODULE_IDS.REPORTS) &&
                (permission.value === "view" || permission.value === "create" || permission.value === "edit")
      }))
    ),
    userCount: 5,
    isCustom: false
  },
  {
    id: "user",
    name: "User",
    description: "Standard inventory management access",
    color: "#4CAF50",
    permissions: PERMISSION_MODULES.flatMap(module =>
      module.permissions.map(permission => ({
        id: permission.id,
        module: module.id, // Now using numeric ID directly
        action: permission.value,
        granted: (module.id === MODULE_IDS.INVENTORY ||
                 module.id === MODULE_IDS.LOCATIONS) &&
                 permission.value === "view"
      }))
    ),
    userCount: 12,
    isCustom: false
  }
];
 
// UPDATED: Helper functions for RBAC with numeric module IDs
export const hasPermission = (
  userPermissions: Permission[],
  module: number, // CHANGED: from string to number
  action: "view" | "create" | "edit" | "delete" | "admin"
): boolean => {
  // Super admin has all permissions
  if (userPermissions.some(p => p.module === MODULE_IDS.ROLES && p.action === "admin" && p.granted)) {
    return true;
  }
 
  // Check specific permission
  return userPermissions.some(
    p => p.module === module && p.action === action && p.granted
  );
};
 
export const getModulePermissions = (
  permissions: Permission[],
  moduleId: number // CHANGED: from string to number
): Permission[] => {
  return permissions.filter(p => p.module === moduleId);
};
 
export const generatePermissionsForRole = (
  modules: PermissionModule[],
  defaultValue: boolean = false
): Permission[] => {
  return modules.flatMap(module =>
    module.permissions.map(permission => ({
      id: permission.id,
      module: module.id, // Now using numeric ID directly
      action: permission.value,
      granted: defaultValue
    }))
  );
};
 
// ADDED: Helper function to get module name from numeric ID
export const getModuleName = (moduleId: number): string => {
  return MODULE_NAMES[moduleId as ModuleId] || `Module ${moduleId}`;
};
 
// ADDED: Helper function to convert legacy string module IDs to numeric
export const convertLegacyModuleId = (legacyModuleId: string): number => {
  const mapping: { [key: string]: number } = {
    'inventory': MODULE_IDS.INVENTORY,
    'locations': MODULE_IDS.LOCATIONS,
    'ebay': MODULE_IDS.EBAY,
    'reports': MODULE_IDS.REPORTS,
    'users': MODULE_IDS.USERS,
    'roles': MODULE_IDS.ROLES,
    'settings': MODULE_IDS.SETTINGS
  };
 
  return mapping[legacyModuleId] || MODULE_IDS.INVENTORY;
};
 
// ADDED: Helper function to convert permissions from legacy string IDs to numeric IDs
export const convertPermissionsToNumeric = (permissions: Permission[]): Permission[] => {
  return permissions.map(perm => {
    // If module is already a number, return as-is
    if (typeof perm.module === 'number') {
      return perm;
    }
    // Convert string module ID to numeric
    return {
      ...perm,
      module: convertLegacyModuleId(perm.module)
    };
  });
};
 
// NEW: Helper function to include module_name when sending permissions to backend
export const preparePermissionsForBackend = (permissionMatrix: PermissionMatrixData): PermissionMatrixData => {
  const preparedMatrix: PermissionMatrixData = { ...permissionMatrix };
 
  // Ensure each permission includes module_name
  Object.keys(preparedMatrix).forEach(roleId => {
    Object.keys(preparedMatrix[roleId]).forEach(moduleId => {
      const moduleData = preparedMatrix[roleId][moduleId];
      if (!moduleData.module_name) {
        // Add module_name from frontend constants if missing
        const numericModuleId = parseInt(moduleId);
        preparedMatrix[roleId][moduleId] = {
          ...moduleData,
          module_name: getModuleName(numericModuleId)
        };
      }
    });
  });
 
  return preparedMatrix;
};