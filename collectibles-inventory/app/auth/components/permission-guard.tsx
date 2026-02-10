"use client";

import { ReactNode } from "react";
import { useRBAC } from "../hooks/use-rbac";

interface PermissionGuardProps {
  /**
   * The module to check permissions for
   */
  module: string;
  
  /**
   * The action to check (view, create, edit, delete, admin)
   */
  action: "view" | "create" | "edit" | "delete" | "admin";
  
  /**
   * Content to render if the user has the required permission
   */
  children: ReactNode;
  
  /**
   * Optional content to render if the user doesn't have the required permission
   */
  fallback?: ReactNode;
  
  /**
   * If true, will render nothing instead of the fallback when permission is denied
   */
  hideIfDenied?: boolean;
}

/**
 * Component that conditionally renders content based on user permissions
 */
export function PermissionGuard({
  module,
  action,
  children,
  fallback,
  hideIfDenied = false,
}: PermissionGuardProps) {
  const { hasPermission } = useRBAC();
  
  const permitted = hasPermission(module, action);
  
  if (permitted) {
    return <>{children}</>;
  }
  
  if (hideIfDenied) {
    return null;
  }
  
  return fallback ? <>{fallback}</> : null;
}

/**
 * Component that conditionally renders content based on multiple permissions (ANY match)
 */
export function AnyPermissionGuard({
  permissions,
  children,
  fallback,
  hideIfDenied = false,
}: {
  permissions: Array<{ module: string; action: "view" | "create" | "edit" | "delete" | "admin" }>;
  children: ReactNode;
  fallback?: ReactNode;
  hideIfDenied?: boolean;
}) {
  const { hasAnyPermission } = useRBAC();
  
  const permitted = hasAnyPermission(permissions);
  
  if (permitted) {
    return <>{children}</>;
  }
  
  if (hideIfDenied) {
    return null;
  }
  
  return fallback ? <>{fallback}</> : null;
}

/**
 * Component that conditionally renders content based on multiple permissions (ALL must match)
 */
export function AllPermissionsGuard({
  permissions,
  children,
  fallback,
  hideIfDenied = false,
}: {
  permissions: Array<{ module: string; action: "view" | "create" | "edit" | "delete" | "admin" }>;
  children: ReactNode;
  fallback?: ReactNode;
  hideIfDenied?: boolean;
}) {
  const { hasAllPermissions } = useRBAC();
  
  const permitted = hasAllPermissions(permissions);
  
  if (permitted) {
    return <>{children}</>;
  }
  
  if (hideIfDenied) {
    return null;
  }
  
  return fallback ? <>{fallback}</> : null;
}

/**
 * Component that conditionally renders content based on admin role
 */
export function AdminGuard({
  children,
  fallback,
  hideIfDenied = false,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  hideIfDenied?: boolean;
}) {
  const { isAdmin } = useRBAC();
  
  if (isAdmin()) {
    return <>{children}</>;
  }
  
  if (hideIfDenied) {
    return null;
  }
  
  return fallback ? <>{fallback}</> : null;
}
