"use client";

import { useCallback } from "react";
import { useAuth } from "../context/auth-context";
import { Permission } from "@/app/settings/types/rbac";

/**
 * Hook for Role-Based Access Control functionality
 * Provides methods to check if the current user has specific permissions
 */
export function useRBAC() {
  const { user, isAuthenticated } = useAuth();

  /**
   * Check if the user has a specific permission for a module
   * @param module The module to check permissions for
   * @param action The action to check (view, create, edit, delete, admin)
   * @returns boolean indicating if the user has the permission
   */
  const hasPermission = useCallback(
    (
      module: string,
      action: "view" | "create" | "edit" | "delete" | "admin"
    ): boolean => {
      // Not authenticated users have no permissions
      if (!isAuthenticated || !user) {
        return false;
      }

      // Super admin role has all permissions
      if (user.role === "superadmin") {
        return true;
      }

      // Admin role has all permissions except super admin specific ones
      if (user.role === "admin") {
        // Admin can't access super admin specific features
        if (module === "roles" && action === "admin") {
          return false;
        }
        return true;
      }

      // Check permissions from user object if available
      if (user.permissions && Array.isArray(user.permissions)) {
        return user.permissions.some(
          (p: Permission) => 
            p.module === module && 
            p.action === action && 
            p.granted === true
        );
      }

      // Default permissions based on role if no specific permissions are set
      switch (user.role) {
        case "manager":
          // Managers can view and edit most things, but not delete or admin
          if (action === "delete" || action === "admin") {
            return false;
          }
          // Managers can't create/edit users or roles
          if ((module === "users" || module === "roles") && action !== "view") {
            return false;
          }
          return true;

        case "user":
          // Regular users can only view most things
          if (action !== "view") {
            return false;
          }
          // Users can't view sensitive modules
          if (module === "users" || module === "roles" || module === "settings") {
            return false;
          }
          return true;

        default:
          return false;
      }
    },
    [isAuthenticated, user]
  );

  /**
   * Check if the user has any of the specified permissions
   * @param permissions Array of module/action pairs to check
   * @returns boolean indicating if the user has any of the permissions
   */
  const hasAnyPermission = useCallback(
    (
      permissions: Array<{
        module: string;
        action: "view" | "create" | "edit" | "delete" | "admin";
      }>
    ): boolean => {
      return permissions.some(({ module, action }) =>
        hasPermission(module, action)
      );
    },
    [hasPermission]
  );

  /**
   * Check if the user has all of the specified permissions
   * @param permissions Array of module/action pairs to check
   * @returns boolean indicating if the user has all of the permissions
   */
  const hasAllPermissions = useCallback(
    (
      permissions: Array<{
        module: string;
        action: "view" | "create" | "edit" | "delete" | "admin";
      }>
    ): boolean => {
      return permissions.every(({ module, action }) =>
        hasPermission(module, action)
      );
    },
    [hasPermission]
  );

  /**
   * Get the current user's role
   * @returns The user's role or null if not authenticated
   */
  const getUserRole = useCallback((): string | null => {
    if (!isAuthenticated || !user) {
      return null;
    }
    return user.role;
  }, [isAuthenticated, user]);

  /**
   * Check if the user has a specific role
   * @param role The role to check
   * @returns boolean indicating if the user has the role
   */
  const hasRole = useCallback(
    (role: string): boolean => {
      if (!isAuthenticated || !user) {
        return false;
      }
      return user.role === role;
    },
    [isAuthenticated, user]
  );

  /**
   * Check if the user has admin access
   * @returns boolean indicating if the user is an admin
   */
  const isAdmin = useCallback((): boolean => {
    if (!isAuthenticated || !user) {
      return false;
    }
    return user.role === "admin" || user.role === "superadmin";
  }, [isAuthenticated, user]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getUserRole,
    hasRole,
    isAdmin,
  };
}
