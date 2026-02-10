"use client";
 
import { useState, useEffect } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Role,
  Permission,
  PERMISSION_MODULES,
  generatePermissionsForRole,
  MODULE_IDS
} from "../types/rbac";
import { roleService } from "../api/role-service";
import { userRolesService } from "../api/user-roles-service";
 
interface AddEditRoleModalProps {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
  onSave: (role: Role) => void;
}
 
export function AddEditRoleModal({
  open,
  onClose,
  role,
  onSave,
}: AddEditRoleModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    color: string;
    permissions: Permission[];
    basicPermissions: {
      can_view: boolean;
      can_create: boolean;
      can_edit: boolean;
      can_delete: boolean;
    };
  }>({
    name: "",
    description: "",
    color: "#6B7280",
    permissions: [],
    basicPermissions: {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    },
  });
 
  // Predefined colors for roles
  const colorOptions = [
    { value: "#DC2626", label: "Red" },
    { value: "#2563EB", label: "Blue" },
    { value: "#16A34A", label: "Green" },
    { value: "#9C27B0", label: "Purple" },
    { value: "#FF9800", label: "Orange" },
    { value: "#4B5563", label: "Gray" },
    { value: "#0891B2", label: "Cyan" },
    { value: "#7C3AED", label: "Violet" },
  ];
 
  // Initialize form data when role changes
  useEffect(() => {
  if (role) {
    // Check if this is a UserRole (has basic permissions)
    const isUserRole = role.id.startsWith('userrole-') || !role.id.includes('-');
   
    if (isUserRole && role.originalData) {
      // This is a UserRole - load basic permissions
      setFormData({
        name: role.name || "",
        description: role.description || "",
        color: role.color || "#6B7280",
        permissions: role.permissions || [],
        basicPermissions: {
          can_view: role.originalData.can_view || false,
          can_create: role.originalData.can_create || false,
          can_edit: role.originalData.can_edit || false,
          can_delete: role.originalData.can_delete || false,
        },
      });
    } else {
      // This is a legacy Role
      setFormData({
        name: role.name || "",
        description: role.description || "",
        color: role.color || "#6B7280",
        permissions: role.permissions || [],
        basicPermissions: {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
        },
      });
    }
  } else {
    // For new role, initialize with empty values
    setFormData({
      name: "",
      description: "",
      color: "#6B7280",
      permissions: generatePermissionsForRole(PERMISSION_MODULES, false),
      basicPermissions: {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      },
    });
  }
  setError(null);
}, [role, open]);
 
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
 
  const handleColorChange = (value: string) => {
    setFormData((prev) => ({ ...prev, color: value }));
  };
 
  const handleBasicPermissionChange = (permission: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      basicPermissions: {
        ...prev.basicPermissions,
        [permission]: checked,
      },
    }));
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);
 
  try {
    // Validate form data
    if (!formData.name.trim()) {
      throw new Error("Role name is required");
    }
 
    console.log("🔄 [AddEditRoleModal] Starting role creation process...");
    console.log("📋 [AddEditRoleModal] Form data:", formData);
 
    let savedRole: Role;
 
    if (role) {
      // 🚨 FIX: Check if this is a UserRole (from new table) or legacy Role
      const isUserRole = role.id.startsWith('userrole-') || !role.id.includes('-');
     
      if (isUserRole) {
        // This is a UserRole from the new table - use userRolesService
        const userRoleData = {
          role_name: formData.name,
          description: formData.description,
          can_view: formData.basicPermissions.can_view,
          can_create: formData.basicPermissions.can_create,
          can_edit: formData.basicPermissions.can_edit,
          can_delete: formData.basicPermissions.can_delete,
        };
 
        console.log("📤 [AddEditRoleModal] Updating UserRole:", role.id, userRoleData);
       
        const userRoleResponse = await userRolesService.updateUserRole(role.id, userRoleData);
        console.log("✅ [AddEditRoleModal] UserRole updated successfully:", userRoleResponse);
       
        // Create updated Role object for callback
        savedRole = {
          id: userRoleResponse.id?.toString() || role.id,
          name: userRoleResponse.role_name,
          description: userRoleResponse.description,
          color: formData.color,
          permissions: convertToLegacyPermissions(userRoleResponse),
          userCount: role.userCount,
          isCustom: true,
          createdAt: userRoleResponse.created_at || role.createdAt,
          updatedAt: userRoleResponse.updated_at,
        };
       
        toast({
          title: "Role updated",
          description: `${formData.name} role has been updated successfully.`,
        });
      } else {
        // This is a legacy Role - use legacy service
        let roleData: Partial<Role>;
 
        // For system roles, only allow updating description
        if (role.isCustom === false) {
          roleData = {
            description: formData.description,
          };
        } else {
          // For custom roles, allow updating all fields
          roleData = {
            name: formData.name,
            description: formData.description,
            color: formData.color,
            permissions: formData.permissions,
          };
        }
       
        // Update existing role using legacy service
        savedRole = await roleService.updateRole(role.id, roleData);
        toast({
          title: "Role updated",
          description: `${role.name} role has been updated successfully.`,
        });
      }
    } else {
      // CREATE NEW ROLE - ONLY save to the new UserRoles table
      const userRoleData = {
        role_name: formData.name,
        description: formData.description,
        can_view: formData.basicPermissions.can_view,
        can_create: formData.basicPermissions.can_create,
        can_edit: formData.basicPermissions.can_edit,
        can_delete: formData.basicPermissions.can_delete,
      };
 
      console.log("📤 [AddEditRoleModal] Sending to UserRoles API:", userRoleData);
     
      const userRoleResponse = await userRolesService.createUserRole(userRoleData);
      console.log("✅ [AddEditRoleModal] UserRole created successfully:", userRoleResponse);
     
      // Create a mock Role object for the onSave callback to maintain compatibility
      savedRole = {
        id: userRoleResponse.id?.toString() || `userrole-${Date.now()}`,
        name: userRoleResponse.role_name,
        description: userRoleResponse.description,
        color: formData.color,
        permissions: convertToLegacyPermissions(userRoleResponse),
        userCount: 0,
        isCustom: true,
        createdAt: userRoleResponse.created_at,
        updatedAt: userRoleResponse.updated_at,
      };
     
      toast({
        title: "Role created successfully",
        description: `${formData.name} has been created in the UserRoles table.`,
      });
    }
 
    onSave(savedRole);
    onClose();
  } catch (err) {
    console.error("💥 [AddEditRoleModal] Error saving role:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to save role";
    setError(errorMessage);
   
    // Show error toast
    toast({
      variant: "destructive",
      title: "Error creating role",
      description: errorMessage,
    });
  } finally {
    setIsLoading(false);
  }
};
 
// UPDATED: Helper function to convert UserRole to legacy permissions with numeric module IDs
const convertToLegacyPermissions = (userRole: any): Permission[] => {
  const permissions: Permission[] = [];
 
  // Use a numeric module ID for "all" permissions (e.g., 0 or 999)
  const ALL_MODULES_ID = 999; // Using 999 to avoid conflict with actual module IDs 1-7
 
  if (userRole.can_view) {
    permissions.push({
      id: `basic_view_${userRole.id}`,
      module: ALL_MODULES_ID, // CHANGED: from 'all' to numeric ID
      action: 'view',
      granted: true
    });
  }
  if (userRole.can_create) {
    permissions.push({
      id: `basic_create_${userRole.id}`,
      module: ALL_MODULES_ID, // CHANGED: from 'all' to numeric ID
      action: 'create',
      granted: true
    });
  }
  if (userRole.can_edit) {
    permissions.push({
      id: `basic_edit_${userRole.id}`,
      module: ALL_MODULES_ID, // CHANGED: from 'all' to numeric ID
      action: 'edit',
      granted: true
    });
  }
  if (userRole.can_delete) {
    permissions.push({
      id: `basic_delete_${userRole.id}`,
      module: ALL_MODULES_ID, // CHANGED: from 'all' to numeric ID
      action: 'delete',
      granted: true
    });
  }
 
  return permissions;
};
 
  // Helper function to safely check if a field should be disabled
  const shouldDisableField = (fieldName?: string): boolean => {
    if (isLoading) return true;
    if (!role) return false;
   
    // For system roles (non-custom roles)
    if (role.isCustom === false) {
      // Allow editing description for system roles
      if (fieldName === 'description') return false;
     
      // Disable name and color for system roles
      return true;
    }
   
    return false;
  };
 
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {role ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>
 
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 p-3 rounded-md flex items-start gap-3 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
 
          <div className="space-y-2">
            <Label htmlFor="name">Role Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter role name"
              disabled={shouldDisableField('name')}
              required
            />
          </div>
 
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter role description"
              disabled={shouldDisableField('description')}
              rows={3}
            />
          </div>
 
          <div className="space-y-2">
            <Label htmlFor="color">Role Color</Label>
            <Select
              value={formData.color}
              onValueChange={handleColorChange}
              disabled={shouldDisableField('color')}
            >
              <SelectTrigger id="color" className="w-full">
                <SelectValue placeholder="Select a color" />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                      <span>{color.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
 
          {/* NEW: Basic Permissions Section - Only show for new roles */}
          {/* {!role && (
            <div className="space-y-3 pt-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_view"
                    checked={formData.basicPermissions.can_view}
                    onCheckedChange={(checked) =>
                      handleBasicPermissionChange("can_view", !!checked)
                    }
                  />
                  <Label htmlFor="can_view" className="text-sm font-normal">
                    Can View
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_create"
                    checked={formData.basicPermissions.can_create}
                    onCheckedChange={(checked) =>
                      handleBasicPermissionChange("can_create", !!checked)
                    }
                  />
                  <Label htmlFor="can_create" className="text-sm font-normal">
                    Can Create
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_edit"
                    checked={formData.basicPermissions.can_edit}
                    onCheckedChange={(checked) =>
                      handleBasicPermissionChange("can_edit", !!checked)
                    }
                  />
                  <Label htmlFor="can_edit" className="text-sm font-normal">
                    Can Edit
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can_delete"
                    checked={formData.basicPermissions.can_delete}
                    onCheckedChange={(checked) =>
                      handleBasicPermissionChange("can_delete", !!checked)
                    }
                  />
                  <Label htmlFor="can_delete" className="text-sm font-normal">
                    Can Delete
                  </Label>
                </div>
              </div>
            </div>
          ) }  */}
 
          {/* <div className="pt-2">
            <p className="text-sm text-gray-500">
              {role
                ? "Permissions for this role can be configured in the permission matrix."
                : "Advanced permissions for this role will be configured in the next step."
              }
            </p>
          </div> */}
 
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Check className="h-4 w-4 mr-1" />
                  {role ? "Update Role" : "Create Role"}
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}