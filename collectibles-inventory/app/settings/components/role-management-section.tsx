"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Shield,
  Save,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddEditRoleModal } from "./add-edit-role-modal";
import {
  Role,
  Permission,
  PERMISSION_MODULES,
  ModulePermissionData,
  PermissionMatrixData,
  preparePermissionsForBackend,
} from "../types/rbac";
import { roleService } from "../api/role-service";
import {
  userRolesService,
  MODULE_IDS,
  MODULE_NAMES,
} from "../api/user-roles-service";

interface RoleManagementSectionProps {
  onChangesDetected: (hasChanges: boolean) => void;
}

// FIXED: Create a specific type for boolean permissions only (excluding module_name)
type BooleanPermissionFields =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete";

export function RoleManagementSection({
  onChangesDetected,
}: RoleManagementSectionProps) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionMatrix, setPermissionMatrix] =
    useState<PermissionMatrixData>({});

  // Track if unsaved changes toast has been shown
  const [unsavedToastShown, setUnsavedToastShown] = useState(false);

  // Fetch roles from UserRoles table on component mount
  useEffect(() => {
    fetchRoles();
    fetchPermissionMatrix();
  }, []);

  // UPDATED: Fetch permission matrix using service
  const fetchPermissionMatrix = async () => {
    try {
      console.log("🔄 [React] Fetching permission matrix...");

      // Use the service function instead of direct fetch
      const result = await userRolesService.getPermissions();

      // The service returns the data directly, so set it
      setPermissionMatrix(result);
      console.log("✅ [React] Loaded permission matrix:", result);
    } catch (err) {
      console.error("❌ [React] Error fetching permission matrix:", err);
      // Initialize empty matrix if fetch fails
      initializeEmptyMatrix();
    }
  };

  // UPDATED: Initialize empty matrix structure with module_name
  const initializeEmptyMatrix = () => {
    const emptyMatrix: PermissionMatrixData = {};
    roles.forEach((role) => {
      emptyMatrix[role.id] = {};
      PERMISSION_MODULES.forEach((module) => {
        emptyMatrix[role.id][module.id] = {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          module_name: module.name, // ADDED: Include module_name from frontend constants
        };
      });
    });
    setPermissionMatrix(emptyMatrix);
  };

  // Helper function to assign colors based on role name
  const getColorForRole = (roleName: string): string => {
    const colorMap: { [key: string]: string } = {
      admin: "#2196F3",
      "super admin": "#9C27B0",
      superadmin: "#9C27B0",
      manager: "#FF9800",
      user: "#4CAF50",
      viewer: "#607D8B",
      editor: "#7C3AED",
      guest: "#6B7280",
    };

    return colorMap[roleName.toLowerCase()] || "#6B7280";
  };

  // UPDATED: Convert module permissions to legacy format for display - NOW USING NUMERIC MODULE IDs
  const convertToLegacyPermissions = (userRole: any): Permission[] => {
    const permissions: Permission[] = [];

    // Get module permissions from the matrix data
    const rolePermissions = permissionMatrix[userRole.id] || {};

    // Convert module permissions to legacy format for display - NOW USING NUMERIC IDs
    Object.entries(rolePermissions).forEach(([moduleId, modulePerm]) => {
      const numericModuleId = parseInt(moduleId); // Convert string key back to number

      if (modulePerm.can_view) {
        permissions.push({
          id: `${moduleId}_view_${userRole.id}`,
          module: numericModuleId, // Now using numeric ID
          action: "view",
          granted: true,
        });
      }
      if (modulePerm.can_create) {
        permissions.push({
          id: `${moduleId}_create_${userRole.id}`,
          module: numericModuleId, // Now using numeric ID
          action: "create",
          granted: true,
        });
      }
      if (modulePerm.can_edit) {
        permissions.push({
          id: `${moduleId}_edit_${userRole.id}`,
          module: numericModuleId, // Now using numeric ID
          action: "edit",
          granted: true,
        });
      }
      if (modulePerm.can_delete) {
        permissions.push({
          id: `${moduleId}_delete_${userRole.id}`,
          module: numericModuleId, // Now using numeric ID
          action: "delete",
          granted: true,
        });
      }
    });

    return permissions;
  };

  const fetchRoles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch from NEW UserRoles table instead of legacy roleService
      const fetchedUserRoles = await userRolesService.getUserRoles();

      // Transform UserRoles data to match the expected Role interface
      const transformedRoles: Role[] = fetchedUserRoles.map((userRole: any) => {
        // Create a properly formatted Role object
        const role: Role = {
          id: userRole.id?.toString() || `userrole-${userRole.role_name}`,
          name: userRole.role_name,
          description: userRole.description || "",
          color: getColorForRole(userRole.role_name),
          permissions: convertToLegacyPermissions(userRole),
          userCount: 0, // You can implement user counting later if needed
          isCustom: true, // All UserRoles from the new table are custom roles
          createdAt: userRole.created_at,
          updatedAt: userRole.updated_at,
        };

        return role;
      });

      setRoles(transformedRoles);
      console.log("✅ Transformed roles:", transformedRoles);
    } catch (err) {
      console.error("Error fetching roles:", err);
      setError(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRole = () => {
    setSelectedRole(null);
    setShowAddEditModal(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setShowAddEditModal(true);
  };

  const handleDeleteRole = (role: Role) => {
    setRoleToDelete(role);
    setShowDeleteDialog(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;

    try {
      // Use the new service for deletion
      await userRolesService.deleteUserRole(roleToDelete.id);

      // Update local state
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));

      toast({
        title: "Role deleted",
        description: `${roleToDelete.name} role has been deleted successfully.`,
      });

      onChangesDetected(true);
    } catch (err) {
      console.error("Error deleting role:", err);
      toast({
        variant: "destructive",
        title: "Failed to delete role",
        description:
          err instanceof Error
            ? err.message
            : "An error occurred while deleting the role.",
      });
    } finally {
      setShowDeleteDialog(false);
      setRoleToDelete(null);
    }
  };

  const handleRoleSaved = (savedRole: Role) => {
    // Update roles list
    setRoles((prev) => {
      const exists = prev.some((r) => r.id === savedRole.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRole.id ? savedRole : r));
      } else {
        return [...prev, savedRole];
      }
    });

    onChangesDetected(true);
  };

  // UPDATED: Handle module permission changes with module_name preservation
  const handlePermissionChange = (
    roleId: string,
    moduleId: string,
    permissionType: BooleanPermissionFields,
    checked: boolean,
  ) => {
    setPermissionMatrix((prev) => {
      const updated = { ...prev };

      if (!updated[roleId]) {
        updated[roleId] = {};
      }

      const currentModuleData = updated[roleId][moduleId] || {};
      const moduleName =
        currentModuleData.module_name ||
        PERMISSION_MODULES.find((m) => m.id === parseInt(moduleId))?.name ||
        `Module ${moduleId}`;

      updated[roleId][moduleId] = {
        ...currentModuleData,
        [permissionType]: checked,
        module_name: moduleName, // PRESERVE: module name
      };

      return updated;
    });

    // Set unsaved changes flag
    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    }

    // Show toast notification for unsaved changes (only once)
    if (!unsavedToastShown) {
      toast({
        title: "Unsaved Changes",
        description: "There are unsaved changes in the permission matrix.",
      });
      setUnsavedToastShown(true);
    }
  };

  // UPDATED: Save module permissions using service - NOW INCLUDES module_name
  const savePermissions = async () => {
    setIsSaving(true);

    try {
      console.log("🔄 [React] Saving permissions matrix...");
      console.log("📊 [React] Permissions data:", permissionMatrix);

      // PREPARE: Ensure module_name is included in the data
      const preparedMatrix = preparePermissionsForBackend(permissionMatrix);
      console.log(
        "📦 [React] Prepared permissions with module_name:",
        preparedMatrix,
      );

      // Use the service function instead of direct fetch
      const result = await userRolesService.savePermissions(preparedMatrix);

      if (result.success || result.message) {
        toast({
          title: "Permissions Updated",
          description: "Module permissions have been saved successfully.",
        });

        setHasUnsavedChanges(false);
        setUnsavedToastShown(false);
        onChangesDetected(true);

        // Refresh roles and matrix to get updated data
        await fetchRoles();
        await fetchPermissionMatrix();
      } else {
        throw new Error(result.error || "Failed to save permissions");
      }
    } catch (err) {
      console.error("❌ [React] Error saving permissions:", err);
      toast({
        variant: "destructive",
        title: "Failed to save permissions",
        description:
          err instanceof Error
            ? err.message
            : "An error occurred while saving permissions.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to get permission badges for display
  const getPermissionBadges = (role: Role) => {
    const badges = [];
    if (role.permissions.some((p) => p.action === "view" && p.granted)) {
      badges.push(
        <Badge key="view" variant="secondary" className="text-xs">
          View
        </Badge>,
      );
    }
    if (role.permissions.some((p) => p.action === "create" && p.granted)) {
      badges.push(
        <Badge key="create" variant="secondary" className="text-xs">
          Create
        </Badge>,
      );
    }
    if (role.permissions.some((p) => p.action === "edit" && p.granted)) {
      badges.push(
        <Badge key="edit" variant="secondary" className="text-xs">
          Edit
        </Badge>,
      );
    }
    if (role.permissions.some((p) => p.action === "delete" && p.granted)) {
      badges.push(
        <Badge key="delete" variant="secondary" className="text-xs">
          Delete
        </Badge>,
      );
    }
    return badges;
  };

  // FIXED: Helper to check if a permission is granted in the matrix - now uses BooleanPermissionFields
  const getPermissionValue = (
    roleId: string,
    moduleId: string,
    permissionType: BooleanPermissionFields,
  ): boolean => {
    return permissionMatrix[roleId]?.[moduleId]?.[permissionType] || false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading roles and permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <div className="text-red-500 mb-4">Error loading roles</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchRoles}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Management
            </CardTitle>
            <Button
              onClick={handleAddRole}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {roles.map((role) => (
              <Card
                key={role.id}
                className="border-2 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <h3 className="font-medium capitalize">{role.name}</h3>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRole(role)}
                        title="Edit role"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteRole(role)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    {role.description || "No description provided"}
                  </p>

                  {/* <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Users className="h-3 w-3" />
                      <span>{role.userCount} users</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Custom Role
                    </Badge>
                  </div> */}
                </CardContent>
              </Card>
            ))}
          </div>

          {roles.length === 0 && (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No roles found
              </h3>
              <p className="text-gray-500 mb-4">
                Get started by creating your first role.
              </p>
              <Button onClick={handleAddRole}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Role
              </Button>
            </div>
          )}

          {/* Permission Matrix - SIMPLIFIED UI */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Permission Matrix</h3>
              {hasUnsavedChanges && (
                <Button
                  onClick={savePermissions}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Permissions
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48 bg-gray-50 sticky left-0 z-10">
                      Module
                    </TableHead>
                    {roles.map((role) => (
                      <TableHead key={role.id} className="text-center min-w-24">
                        <div className="flex flex-col items-center space-y-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="text-xs capitalize">
                            {role.name}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* CHANGED: Use PERMISSION_MODULES directly instead of NUMERIC_PERMISSION_MODULES */}
                  {PERMISSION_MODULES.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium bg-gray-50 sticky left-0">
                        {module.name}
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role.id} className="text-center">
                          <div className="flex flex-col space-y-2">
                            {module.permissions.map((permission) => {
                              const isChecked = getPermissionValue(
                                role.id,
                                module.id.toString(),
                                `can_${permission.value}` as BooleanPermissionFields, // FIXED: Use specific type
                              );

                              return (
                                <div
                                  key={permission.id}
                                  className="flex flex-col items-center space-y-1"
                                >
                                  <span className="text-xs text-gray-600">
                                    {permission.name}
                                  </span>
                                  <Checkbox
                                    id={`${role.id}_${permission.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(
                                        role.id,
                                        module.id.toString(), // Convert number to string for matrix keys
                                        `can_${permission.value}` as BooleanPermissionFields, // FIXED: Use specific type
                                        !!checked,
                                      )
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-gray-500 mt-2">
              <p className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-slate-500" />
                All roles from UserRoles table are custom roles with
                customizable permissions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Role Modal */}
      <AddEditRoleModal
        open={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        role={selectedRole}
        onSave={handleRoleSaved}
      />

      {/* Delete Role Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              <span className="font-semibold capitalize">
                {" "}
                {roleToDelete?.name}
              </span>{" "}
              role from the UserRoles table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
