# Role-Based Access Control (RBAC) System Documentation

## Overview

The RBAC system provides fine-grained access control for the Conejo Coins inventory management application. It allows administrators to create custom roles with specific permissions and assign these roles to users.

## Key Components

### 1. Data Models

- **Role**: Represents a user role with specific permissions
- **Permission**: Represents a specific action that can be performed on a module
- **PermissionModule**: Represents a section of the application that can have permissions

### 2. API Services

- **roleService**: Handles CRUD operations for roles and permissions

### 3. React Hooks

- **useRBAC**: Provides methods to check permissions for the current user

### 4. UI Components

- **PermissionGuard**: Conditionally renders content based on user permissions
- **AnyPermissionGuard**: Conditionally renders content if the user has any of the specified permissions
- **AllPermissionsGuard**: Conditionally renders content if the user has all of the specified permissions
- **AdminGuard**: Conditionally renders content if the user is an admin

## Default Roles

1. **Super Administrator**: Complete system control and configuration
2. **Administrator**: Full system access with user management
3. **Manager**: Department management and reporting access
4. **User**: Standard inventory management access

## Permission Modules

1. **Inventory Management**: Manage collectible items
2. **Location Management**: Manage storage locations
3. **Reports & Analytics**: Access and generate reports
4. **User Management**: Manage system users
5. **Role Management**: Manage user roles and permissions
6. **System Settings**: Configure system settings

## Permission Actions

1. **view**: Ability to view/read data
2. **create**: Ability to create new data
3. **edit**: Ability to modify existing data
4. **delete**: Ability to remove data
5. **admin**: Full administrative access to a module

## Usage Examples

### Checking Permissions in Components

```tsx
import { useRBAC } from "@/app/auth/hooks/use-rbac";

function MyComponent() {
  const { hasPermission } = useRBAC();
  
  // Check if user can view inventory
  const canViewInventory = hasPermission("inventory", "view");
  
  // Check if user can edit inventory
  const canEditInventory = hasPermission("inventory", "edit");
  
  return (
    <div>
      {canViewInventory && <InventoryList />}
      {canEditInventory && <EditButton />}
    </div>
  );
}
```

### Using Permission Guards

```tsx
import { PermissionGuard } from "@/app/auth/components/permission-guard";

function MyComponent() {
  return (
    <div>
      {/* Only shown if user has permission to view inventory */}
      <PermissionGuard module="inventory" action="view">
        <InventoryList />
      </PermissionGuard>
      
      {/* Only shown if user has permission to edit inventory */}
      <PermissionGuard 
        module="inventory" 
        action="edit"
        fallback={<ReadOnlyView />} // Optional fallback content
      >
        <EditableView />
      </PermissionGuard>
      
      {/* Hide completely if no permission */}
      <PermissionGuard 
        module="settings" 
        action="admin"
        hideIfDenied={true}
      >
        <AdminPanel />
      </PermissionGuard>
    </div>
  );
}
```

### Using Multiple Permission Guards

```tsx
import { AnyPermissionGuard, AllPermissionsGuard } from "@/app/auth/components/permission-guard";

function MyComponent() {
  return (
    <div>
      {/* Shown if user has ANY of these permissions */}
      <AnyPermissionGuard 
        permissions={[
          { module: "inventory", action: "edit" },
          { module: "inventory", action: "admin" }
        ]}
      >
        <EditButton />
      </AnyPermissionGuard>
      
      {/* Shown only if user has ALL of these permissions */}
      <AllPermissionsGuard 
        permissions={[
          { module: "users", action: "create" },
          { module: "users", action: "delete" }
        ]}
      >
        <UserAdminPanel />
      </AllPermissionsGuard>
    </div>
  );
}
```

## Managing Roles and Permissions

Administrators can manage roles and permissions through the Settings > Role Management section of the application. This interface allows:

1. Creating new custom roles
2. Editing existing custom roles
3. Deleting custom roles
4. Configuring permissions for each role using the permission matrix

## Best Practices

1. Always use the permission guards for UI elements that should be restricted
2. Check permissions before performing sensitive operations
3. Create custom roles with the minimum necessary permissions (principle of least privilege)
4. Regularly audit role assignments and permissions
5. Use the `isAdmin()` helper for admin-only features rather than checking specific permissions
