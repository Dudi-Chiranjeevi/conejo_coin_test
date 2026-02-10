"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { env } from "@/app/config/env";
import {
  X,
  Upload,
  UserIcon,
  Shield,
  Settings,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "../types/user-management";
import { mockUserRoles, mockPermissionModules } from "../types/user-management";

// Define Client type based on your client management code
interface Client {
  id: string;
  client_name: string;
  contact_email?: string;
  created_at: string;
  updated_at: string;
}

interface ClientsApiResponse {
  success: boolean;
  clients: Client[];
  error?: string;
}

interface AddEditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  clients: Client[];
  clientsLoading: boolean;
  onSave: (userData: Partial<User>) => void;
  onChangesDetected: (hasChanges: boolean) => void;
}

// Interface for UserRole from backend - MIMICKING CLIENT MANAGEMENT STRUCTURE
interface UserRole {
  id: number;
  role_name: string;
  description: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
  created_by_uid: string;
  created_by_email: string;
  updated_by_uid: string;
  updated_by_email: string;
}

// Use the EXACT SAME conversion function as ClientManagementTab - MIMICKING CLIENT MANAGEMENT
const backendToFrontendClient = (backend: any): Client => {
  console.log("🔧 [backendToFrontendClient] Raw backend data:", backend);

  const convertedClient = {
    id: backend.id,
    client_name: backend.name || backend.client_name || "", // Use 'name' from Django model
    contact_email: backend.contact_email || "",
    created_at: backend.created_at || backend.createdAt || "",
    updated_at: backend.updated_at || backend.updatedAt || "",
  };

  console.log("✅ [backendToFrontendClient] Converted client:", convertedClient);
  return convertedClient;
};

export function AddEditUserModal({
  isOpen,
  onClose,
  user,
  clients,
  clientsLoading,
  onSave,
  onChangesDetected,
}: AddEditUserModalProps) {
  // Get API base URL from env config
  const API_BASE_URL = env.api.baseUrl;

  // Form state - MIMICKING CLIENT MANAGEMENT FORM STRUCTURE
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "TempPassword123!", // Default password for new users
    phone: "",
    description: "",
    roleId: "",
    clientId: "", // Add clientId to form data - MIMICKING CLIENT MANAGEMENT
    status: "active" as "active" | "inactive" | "pending",
    avatar: "",
    twoFactorEnabled: false,
    emailNotifications: true,
    permissions: {} as Record<string, Record<string, boolean>>,
  });

  const [activeTab, setActiveTab] = useState("basic");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Role management state - MIMICKING CLIENT MANAGEMENT ROLE FETCHING PATTERN
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Debug clients data - MIMICKING CLIENT MANAGEMENT DEBUGGING
  useEffect(() => {
    console.log("🔄 [AddEditUserModal] Clients prop received:", {
      clients,
      clientsCount: clients?.length || 0,
      clientsLoading,
      isOpen
    });
   
    if (clients && clients.length > 0) {
      console.log("📋 [AddEditUserModal] Available clients:", clients.map(c => ({
        id: c.id,
        client_name: c.client_name,
        hasName: !!c.client_name,
        nameLength: c.client_name?.length || 0,
        rawClient: c // Show the entire client object
      })));
     
      // Check if client names are actually populated - MIMICKING CLIENT MANAGEMENT VALIDATION
      clients.forEach((client, index) => {
        console.log(`📝 Client ${index}:`, {
          id: client.id,
          client_name: client.client_name,
          isEmpty: !client.client_name,
          type: typeof client.client_name,
          allProps: Object.keys(client)
        });
      });
    }
  }, [clients, clientsLoading, isOpen]);

  // Fetch user roles from backend when modal opens - MIMICKING CLIENT MANAGEMENT FETCH PATTERN
  useEffect(() => {
    if (isOpen) {
      console.log("🚀 [AddEditUserModal] Modal opened, fetching user roles...");
      fetchUserRoles();
    }
  }, [isOpen]);

  // Fetch user roles from UserRoles table - MIMICKING CLIENT MANAGEMENT API CALL PATTERN
  const fetchUserRoles = async () => {
    setLoadingRoles(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/user-roles/`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.status}`);
      }

      const rolesData = await response.json();
      console.log("✅ [AddEditUserModal] Fetched UserRoles:", rolesData);
      setUserRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (error) {
      console.error("💥 [AddEditUserModal] Error fetching user roles:", error);
      // Fallback to mock data if API fails - MIMICKING CLIENT MANAGEMENT ERROR HANDLING
      setUserRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  };

  // Initialize form data - MIMICKING CLIENT MANAGEMENT FORM INITIALIZATION
  useEffect(() => {
    console.log("👤 [AddEditUserModal] User object received:", user);
    if (user) {
      console.log("📝 [AddEditUserModal] User description:", user.description);
      console.log("🏢 [AddEditUserModal] User clientId:", user.clientId);
      // Editing existing user
      setIsEditing(true);
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: "", // Empty password for existing users (won't be changed unless specified)
        phone: user.phone || "",
        description: user.description || "",
        roleId: user.role.id,
        clientId: user.clientId || "", // Set clientId from user data - MIMICKING CLIENT MANAGEMENT
        status: user.status,
        avatar: user.avatar || "",
        twoFactorEnabled: user.twoFactorEnabled,
        emailNotifications: true,
        permissions: {},
      });
      setAvatarPreview(user.avatar || "");
    } else {
      // Creating new user
      setIsEditing(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "TempPassword123!",
        phone: "",
        description: "",
        roleId: "",
        clientId: "", // Initialize clientId as empty - MIMICKING CLIENT MANAGEMENT
        status: "active",
        avatar: "",
        twoFactorEnabled: false,
        emailNotifications: true,
        permissions: {},
      });
      setAvatarPreview("");
    }
    setError("");
  }, [user, isOpen]);

  // Save handler - MIMICKING CLIENT MANAGEMENT VALIDATION AND API CALL PATTERN
  const handleSave = async () => {
  // Validation - MIMICKING CLIENT MANAGEMENT VALIDATION PATTERN
  if (!formData.firstName || !formData.lastName || !formData.email || !formData.roleId) {
    setError("Please fill in all required fields");
    return;
  }

  // Client validation - MIMICKING CLIENT MANAGEMENT CLIENT VALIDATION
  if (!formData.clientId || formData.clientId === "no-client") {
    setError("Please select a client");
    return;
  }

  // Email format validation - MIMICKING CLIENT MANAGEMENT VALIDATION
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    setError("Please enter a valid email address");
    return;
  }

  // Password strength validation for new users - MIMICKING CLIENT MANAGEMENT VALIDATION
  if (!isEditing) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 8 characters with uppercase, lowercase, number and special character");
      return;
    }
  }

  // Phone validation (if provided) - MIMICKING CLIENT MANAGEMENT VALIDATION
  if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
    setError("Please enter a valid phone number");
    return;
  }

  setIsLoading(true);
  setError("");

  try {
    let result;
    let verificationEmailSent = false;
    let verificationError = "";
    
    // ✅ FIX: Find the selected role to get the role name
    const selectedRole = userRoles.find(role => role.id.toString() === formData.roleId);
    
    if (!selectedRole) {
      setError("Please select a valid role");
      setIsLoading(false);
      return;
    }

     const formatRoleName = (roleName: string): string => {
      return roleName.toLowerCase().replace(/\s+/g, '_');
    };

    const formattedRoleName = formatRoleName(selectedRole.role_name);
    console.log(`🎭 [AddEditUserModal] Role formatting: "${selectedRole.role_name}" -> "${formattedRoleName}"`);

    if (isEditing && user) {
      // Edit existing user - no password - MIMICKING CLIENT MANAGEMENT EDIT PATTERN
      const editData = {
        email: formData.email,
        firstname: formData.firstName,
        lastname: formData.lastName,
        role: formattedRoleName, // ✅ FIX: Send role NAME instead of numeric ID
        client_id: formData.clientId || "", // Include client_id - MIMICKING CLIENT MANAGEMENT
        phone: formData.phone || "",
        description: formData.description || "",
        disabled: formData.status !== "active",
      };

      console.log("🔄 [AddEditUserModal] Sending edit data:", editData);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/users/${user.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          credentials: "include",
          body: JSON.stringify(editData),
        }
      );

      console.log("📨 [AddEditUserModal] Edit response status:", response.status);
     
      result = await response.json();
      console.log("📨 [AddEditUserModal] Edit response data:", result);

      if (!result.success) {
        setError(result.error || "Failed to update user");
        return;
      }
    } else {
      // Create new user - password is REQUIRED - MIMICKING CLIENT MANAGEMENT CREATE PATTERN
      const createData = {
        email: formData.email,
        firstname: formData.firstName,
        lastname: formData.lastName,
        role: formattedRoleName, // ✅ FIX: Send role NAME instead of numeric ID
        client_id: formData.clientId || "", // Include client_id - MIMICKING CLIENT MANAGEMENT
        phone: formData.phone || "",
        description: formData.description || "",
        password: formData.password,
      };

      console.log("👤 [AddEditUserModal] Creating new user with data:", createData);

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(createData),
      });

      console.log("📨 [AddEditUserModal] Create response status:", response.status);
     
      result = await response.json();
      console.log("📨 [AddEditUserModal] Create response data:", result);

      if (!result.success) {
        setError(result.error || "Failed to create user");
       
        if (result.errors) {
          console.error("❌ [AddEditUserModal] Validation errors:", result.errors);
          setError(`Validation failed: ${JSON.stringify(result.errors)}`);
        }
        return;
      }

      // ✅ KEEP VERIFICATION EMAIL LOGIC FOR NEW USERS - MIMICKING CLIENT MANAGEMENT ADDITIONAL ACTIONS
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const verificationResponse = await fetch(
          `${API_BASE_URL}/api/v1/auth/resend-verification/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
            credentials: "include",
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        const verificationResult = await verificationResponse.json();
        if (verificationResult.success) {
          console.log("✅ Verification email sent successfully");
          verificationEmailSent = true; // ✅ SET VERIFICATION STATUS
        } else {
          console.error("❌ Failed to send verification email:", verificationResult.error);
          verificationEmailSent = false; // ✅ SET VERIFICATION STATUS
          verificationError = verificationResult.error || "Unknown error sending verification email"; // ✅ SET ERROR
        }
      } catch (verificationError: any) {
        console.error("❌ Error sending verification email:", verificationError);
        verificationEmailSent = false; // ✅ SET VERIFICATION STATUS

        if (verificationError.name === "AbortError") {
          verificationError = "Verification email request timed out. The user can request a new verification email from the login page."; // ✅ SET ERROR
        } else {
          verificationError = verificationError.message || "Failed to send verification email. The user can request a new verification email from the login page."; // ✅ SET ERROR
        }
      }
    }

    // SUCCESS: Call onSave with the user data - MIMICKING CLIENT MANAGEMENT SUCCESS HANDLING
    const userData: Partial<User> = {
      id: result.user.id,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      description: formData.description,
      role: selectedRole ? {
        id: selectedRole.id.toString(),
        name: selectedRole.role_name,
        description: selectedRole.description,
        color: getColorForRole(selectedRole.role_name),
        permissions: [],
        userCount: 0,
        isCustom: true,
      } : mockUserRoles[2], // Fallback to default user role
      status: formData.status,
      clientId: formData.clientId, // Include clientId - MIMICKING CLIENT MANAGEMENT
      lastLogin: result.user.last_login_formatted || "Never",
      createdAt: result.user.created_at_formatted || new Date().toISOString(),
      isEmailVerified: result.user.email_verified || false,
      twoFactorEnabled: result.user.two_factor_enabled || false,
      permissions: [],
      // ✅ ADD VERIFICATION STATUS FOR NEW USERS
      ...(!isEditing && {
        verificationEmailSent,
        ...(verificationError && { verificationError })
      })
    };

    console.log("✅ [AddEditUserModal] Success! Calling onSave with:", userData);
   
    // Call the parent's onSave callback - MIMICKING CLIENT MANAGEMENT CALLBACK PATTERN
    onSave(userData);
   
    // Close the modal
    onClose();

  } catch (err) {
    console.error("💥 [AddEditUserModal] Network error:", err);
    setError("Failed to save user. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

  // Avatar upload handler
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAvatarPreview(result);
        setFormData((prev) => ({ ...prev, avatar: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Permission change handler
  const handlePermissionChange = (
    moduleId: string,
    permission: string,
    granted: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleId]: {
          ...prev.permissions[moduleId],
          [permission]: granted,
        },
      },
    }));
  };

  // Helper function to assign colors based on role name - MIMICKING CLIENT MANAGEMENT COLOR MAPPING
  const getColorForRole = (roleName: string): string => {
    const colorMap: { [key: string]: string } = {
      'admin': '#2196F3',
      'super admin': '#9C27B0',
      'manager': '#FF9800',
      'user': '#4CAF50',
      'viewer': '#607D8B',
      'editor': '#7C3AED',
      'guest': '#6B7280'
    };
   
    return colorMap[roleName.toLowerCase()] || '#6B7280';
  };

  const selectedRole = userRoles.find(role => role.id.toString() === formData.roleId);

  // Get selected client name for display - MIMICKING CLIENT MANAGEMENT DISPLAY LOGIC
  const getSelectedClientName = () => {
    if (!formData.clientId || formData.clientId === "no-client") return "";
   
    const selectedClient = clients.find(client => client.id === formData.clientId);
   
    if (!selectedClient) {
      console.warn("❌ [getSelectedClientName] Client not found for ID:", formData.clientId);
      return "";
    }
   
    // Use the client_name directly, don't try to format it - MIMICKING CLIENT MANAGEMENT
    const displayName = selectedClient.client_name;
    console.log("🔍 [getSelectedClientName]", {
      clientId: formData.clientId,
      foundClient: !!selectedClient,
      clientName: selectedClient.client_name,
      displayName,
      allProps: Object.keys(selectedClient)
    });
   
    return displayName;
  };

  // Format display name - MIMICKING CLIENT MANAGEMENT FORMATTING
  const formatDisplayName = (client: Client): string => {
    // If client_name is empty, check if there's a 'name' property directly on the client object
    if (!client.client_name) {
      console.log("⚠️ [formatDisplayName] client_name is empty, checking raw client:", client);
     
      // Check if the client object has a 'name' property (direct from backend)
      const directName = (client as any).name;
      if (directName) {
        console.log("✅ [formatDisplayName] Found direct 'name' property:", directName);
        return directName.toLowerCase();
      }
     
      // Fallback to ID - MIMICKING CLIENT MANAGEMENT FALLBACK
      return `Client ${client.id}`;
    }
   
    return client.client_name.toLowerCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {isEditing ? "Edit User" : "Add New User"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6 mt-6">
            {/* Basic Information - MIMICKING CLIENT MANAGEMENT FORM LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Enter email address"
                />
              </div>

              {!isEditing && (
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Enter password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Default password: TempPassword123!
                  </p>
                </div>
              )}

              {/* Role Dropdown - MIMICKING CLIENT MANAGEMENT DROPDOWN PATTERN */}
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, roleId: value }))
                  }
                  disabled={loadingRoles}
                >
                  <SelectTrigger>
                    {loadingRoles ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading roles...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select role" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getColorForRole(role.role_name) }}
                          />
                          <span className="capitalize">{role.role_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {userRoles.length === 0 && !loadingRoles && (
                      <SelectItem value="no-roles" disabled>
                        No roles available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">{selectedRole.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedRole.can_view && <Badge variant="secondary" className="text-xs">View</Badge>}
                      {selectedRole.can_create && <Badge variant="secondary" className="text-xs">Create</Badge>}
                      {selectedRole.can_edit && <Badge variant="secondary" className="text-xs">Edit</Badge>}
                      {selectedRole.can_delete && <Badge variant="secondary" className="text-xs">Delete</Badge>}
                    </div>
                  </div>
                )}
              </div>

              {/* Client Dropdown - MIMICKING CLIENT MANAGEMENT DROPDOWN PATTERN */}
              <div>
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) => {
                    console.log("🎯 [AddEditUserModal] Selected client:", value);
                    setFormData((prev) => ({ ...prev, clientId: value }))
                  }}
                  disabled={clientsLoading}
                >
                  <SelectTrigger>
                    {clientsLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading clients...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select client">
                        {getSelectedClientName() || "Select client"}
                      </SelectValue>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                  {clients && clients.length > 0 ? (
                    // When clients exist - ONLY show the clients, no "No Client" option
                    clients.map((client) => {
                      const displayName = formatDisplayName(client);
                      console.log("📦 [Client Dropdown Item]", {
                        id: client.id,
                        client_name: client.client_name,
                        rawClient: client,
                        displayName
                      });
                     
                      return (
                        <SelectItem
                          key={client.id}
                          value={client.id}
                        >
                          {displayName}
                        </SelectItem>
                      );
                    })
                  ) : (
                    // When no clients exist - show "No Client" as the only option
                    <SelectItem value="no-client">
                      No Client
                    </SelectItem>
                  )}
                </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Enter phone number"
                />
              </div>

              {/* Add description field - make it span full width - MIMICKING CLIENT MANAGEMENT LAYOUT */}
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions - MIMICKING CLIENT MANAGEMENT ACTION BUTTONS */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isLoading ||
              !formData.firstName ||
              !formData.lastName ||
              !formData.email ||
              (!isEditing && !formData.password) ||
              !formData.roleId ||
              !formData.clientId || // Add client validation - MIMICKING CLIENT MANAGEMENT
              formData.clientId === "no-client" // Prevent "No Client" selection
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
              ? "Update User"
              : "Create User"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}