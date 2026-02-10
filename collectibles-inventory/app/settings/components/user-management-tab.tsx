"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  RotateCcw,
  Eye,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  Shield,
  Activity,
} from "lucide-react";
import { env } from "@/app/config/env";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddEditUserModal } from "./add-edit-user-modal";
import { ForgotPasswordModal } from "../../auth/components/forgot-password-modal";
import { type User } from "../types/user-management";
import { MyProfileTab } from "./my-profile-tab";

interface UserManagementTabProps {
  onChangesDetected: (hasChanges: boolean) => void;
}

// Define the API response type
interface UsersApiResponse {
  success: boolean;
  users: User[];
  count: number;
}

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

const convertToAuthUser = (managementUser: any): any => {
  if (!managementUser) return null;

  return {
    ...managementUser,
    role:
      typeof managementUser.role === "object"
        ? managementUser.role.id
        : managementUser.role,
  };
};

// Client conversion function
const backendToFrontendClient = (backendClient: any): Client => {
  return {
    id: backendClient.id,
    client_name: backendClient.name || "",
    contact_email: backendClient.contact_email || "",
    created_at: backendClient.created_at || backendClient.createdAt || "",
    updated_at: backendClient.updated_at || backendClient.updatedAt || "",
  };
};

// Update the convertBackendUserToFrontend function
const convertBackendUserToFrontend = (backendUser: any): User => {
  // Handle role conversion
  let roleObj;
  if (typeof backendUser.role === "string") {
    // Map string roles to role objects
    const roleMapping = {
      admin: { id: "admin", name: "Administrator", color: "#DC2626" },
      manager: { id: "manager", name: "Manager", color: "#2563EB" },
      user: { id: "user", name: "User", color: "#16A34A" },
      guest: { id: "guest", name: "Guest", color: "#4B5563" },
    };
    roleObj = roleMapping[backendUser.role as keyof typeof roleMapping] || {
      id: backendUser.role,
      name:
        backendUser.role.charAt(0).toUpperCase() + backendUser.role.slice(1),
      color: "#6B7280",
    };
  } else {
    roleObj = backendUser.role || {
      id: "user",
      name: "User",
      color: "#6B7280",
    };
  }

  // Handle last login - prioritize the formatted version from backend
  const lastLogin =
    backendUser.last_login_formatted ||
    backendUser.lastLogin ||
    backendUser.last_login ||
    "";

  // Handle created at - prioritize the formatted version from backend
  const createdAt =
    backendUser.created_at_formatted ||
    backendUser.createdAt ||
    backendUser.created_at ||
    new Date().toISOString();

  // Handle status - check both disabled status and status field
  let status: "active" | "inactive" | "pending";
  if (backendUser.disabled !== undefined) {
    status = backendUser.disabled ? "inactive" : "active";
  } else {
    status = backendUser.status || "inactive";
  }

  return {
    id: backendUser.id,
    firstName: backendUser.firstname || backendUser.firstName || "",
    lastName: backendUser.lastname || backendUser.lastName || "",
    email: backendUser.email || "",
    phone: backendUser.phone || "",
    description: backendUser.description || "",
    avatar: backendUser.avatar || "",
    role: roleObj,
    status: status,
    department: backendUser.department || "",
    lastLogin: lastLogin,
    createdAt: createdAt,
    isEmailVerified:
      backendUser.isEmailVerified ||
      backendUser.is_email_verified ||
      backendUser.email_verified ||
      false,
    twoFactorEnabled:
      backendUser.twoFactorEnabled || backendUser.two_factor_enabled || false,
    permissions: backendUser.permissions || [],
    clientId: backendUser.client_id || backendUser.clientId || "", // Include clientId
  };
};

// Update the getRoleBadge function to handle both string and object roles
const getRoleBadge = (role: any) => {
  if (!role) return {};

  // If role is a string, convert it to a basic role object
  if (typeof role === "string") {
    const roleMapping = {
      admin: { color: "#DC2626" },
      manager: { color: "#2563EB" },
      user: { color: "#16A34A" },
      guest: { color: "#4B5563" },
    };
    const roleInfo = roleMapping[role as keyof typeof roleMapping] || {
      color: "#6B7280",
    };
    return {
      backgroundColor: `${roleInfo.color}20`,
      color: roleInfo.color,
      borderColor: `${roleInfo.color}40`,
    };
  }

  // If role is already an object
  return {
    backgroundColor: `${role.color}20`,
    color: role.color,
    borderColor: `${role.color}40`,
  };
};

export function UserManagementTab({
  onChangesDetected,
}: UserManagementTabProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Add client states
  const [clients, setClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(
    null,
  );

  // userprofile states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] =
    useState<User | null>(null);

  const API_BASE_URL = env.api.baseUrl;

  // Fetch all clients (without search) for total count
  const fetchAllClients = async () => {
    try {
      setClientsLoading(true);
      console.log(
        "🔄 [UserManagementTab] Fetching clients from:",
        `${API_BASE_URL}/api/v1/clients/`,
      );

      const response = await fetch(`${API_BASE_URL}/api/v1/clients/`, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      const data: ClientsApiResponse = await response.json();
      console.log("📦 [UserManagementTab] Clients API response:", data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch clients");
      }

      const normalized = (data.clients || []).map(backendToFrontendClient);
      console.log("✅ [UserManagementTab] Normalized clients:", normalized);

      setAllClients(normalized);
      setClients(normalized);
      return normalized;
    } catch (err) {
      console.error("💥 [UserManagementTab] Error fetching all clients:", err);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
      return [];
    } finally {
      setClientsLoading(false);
    }
  };

  // Fetch users function
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/users/all/`, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UsersApiResponse = await response.json();

      if (data.success) {
        // Convert backend data to frontend format
        const formattedUsers = data.users.map(convertBackendUserToFrontend);
        setUsers(formattedUsers);
      } else {
        throw new Error("Failed to fetch users");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    }
  };

  // ✅ FIXED: Initialize both users and clients data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        await Promise.all([fetchUsers(), fetchAllClients()]);
      } catch (error) {
        console.error("Error initializing data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [API_BASE_URL]);

  // Calculate statistics from real data
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.status === "active").length,
    adminUsers: users.filter((user) => user.role?.id === "admin").length,
    recentActivity:
      users.filter((user) => {
        if (!user.lastLogin) return false;

        try {
          // Parse the lastLogin date, handling different formats
          const lastLogin = new Date(user.lastLogin);
          const today = new Date();

          // Check if the date is valid
          if (isNaN(lastLogin.getTime())) return false;

          // Consider activity within the last 24 hours as "today"
          const hoursDiff =
            (today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
          return hoursDiff <= 24;
        } catch (e) {
          console.error("Error parsing date:", e, user.lastLogin);
          return false;
        }
      }).length || 1, // Always show at least 1 active user (current user)
    trends: {
      totalChange: 0, // You might want to track this separately
    },
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === "all" || user.role?.id === filterRole;
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleUserStatusToggle = async (
    userId: string,
    newStatus: "active" | "inactive",
  ) => {
    try {
      // First update UI optimistically
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                status: newStatus,
                disabled: newStatus === "inactive", // Also update disabled field for consistency
              }
            : user,
        ),
      );

      // Make API call to update the backend - using your actual endpoint
      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/users/${userId}/status/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          credentials: "include",
          body: JSON.stringify({
            disabled: newStatus === "inactive", // Send disabled boolean instead of status string
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update user status");
      }

      const result = await response.json();
      console.log("User status updated successfully:", result);

      onChangesDetected(true);
    } catch (err) {
      console.error("Error updating user status:", err);
      // Revert UI change if API call fails
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                status: user.status === "active" ? "inactive" : "active",
                disabled: user.status === "active", // Revert disabled field too
              }
            : user,
        ),
      );
      alert("Failed to update user status");
    }
  };

  // Add delete user function
  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      // Show loading state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isDeleting: true } : user,
        ),
      );

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/users/${userId}/delete/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Remove the user from the local state
        setUsers((prev) => prev.filter((user) => user.id !== userId));
        setSelectedUsers((prev) => prev.filter((id) => id !== userId));

        // Show success message
        alert("User deleted successfully");
        onChangesDetected(true);
      } else {
        throw new Error(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      alert(err instanceof Error ? err.message : "Failed to delete user");

      // Revert the loading state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isDeleting: false } : user,
        ),
      );
    }
  };

  // Add bulk delete functionality
  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedUsers.length} user(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      // Delete users one by one
      for (const userId of selectedUsers) {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/auth/users/${userId}/delete/`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || `Failed to delete user ${userId}`);
        }
      }

      // Remove deleted users from local state
      setUsers((prev) =>
        prev.filter((user) => !selectedUsers.includes(user.id)),
      );
      setSelectedUsers([]);

      // Show success message
      alert(`${selectedUsers.length} user(s) deleted successfully`);
      onChangesDetected(true);
    } catch (err) {
      console.error("Error in bulk delete:", err);
      alert(err instanceof Error ? err.message : "Failed to delete users");
    }
  };

  const handleSelectUser = (userId: string, selected: boolean) => {
    if (selected) {
      setSelectedUsers((prev) => [...prev, userId]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      pending: "bg-sky-100 text-sky-800",
    };
    return variants[status as keyof typeof variants] || variants.inactive;
  };

  const formatLastLogin = (lastLogin?: string) => {
    // Handle the "Never" case first
    if (!lastLogin || lastLogin === "Never") return "Never logged in";

    // If it's already a formatted string like "2025-09-02 16:40:43",
    // we need to convert it to a proper Date object
    let date: Date;

    if (lastLogin.includes("-") && lastLogin.includes(":")) {
      // Handle formatted date strings like "2025-09-02 16:40:43"
      date = new Date(lastLogin.replace(" ", "T") + "Z"); // Convert to ISO format
    } else {
      // Handle ISO strings or timestamps
      date = new Date(lastLogin);
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return "Never logged in";
    }

    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error loading users</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.totalUsers}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              {stats.trends.totalChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span
                className={`text-sm ${
                  stats.trends.totalChange > 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {stats.trends.totalChange > 0 ? "+" : ""}
                {stats.trends.totalChange} this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Users
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.activeUsers}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <span className="text-sm text-gray-600">
                {stats.totalUsers > 0
                  ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
                  : 0}
                % of total users
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Admin Users</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.adminUsers}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <span className="text-sm text-gray-600">
                {stats.totalUsers > 0
                  ? Math.round((stats.adminUsers / stats.totalUsers) * 100)
                  : 0}
                % admin access
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Recent Activity
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.recentActivity}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-slate-600" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <span className="text-sm text-gray-600">Users active today</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Management</CardTitle>
            <Button
              onClick={() => setShowAddUserModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="manager">User</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-4 mb-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-900">
                {selectedUsers.length} user{selectedUsers.length > 1 ? "s" : ""}{" "}
                selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 bg-transparent"
                  onClick={handleBulkDelete}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedUsers.length === filteredUsers.length &&
                        filteredUsers.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) =>
                            handleSelectUser(user.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={user.avatar || "/placeholder.svg"}
                              alt={`${user.firstName} ${user.lastName}`}
                            />
                            <AvatarFallback>
                              {user.firstName?.charAt(0) || ""}
                              {user.lastName?.charAt(0) || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              {user.email}
                              {user.isEmailVerified && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            {user.department && (
                              <div className="text-xs text-gray-400">
                                {user.department}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="border"
                          style={getRoleBadge(user.role)}
                        >
                          {user.role?.name || "No role"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={user.status === "active"}
                            onCheckedChange={(checked) =>
                              handleUserStatusToggle(
                                user.id,
                                checked ? "active" : "inactive",
                              )
                            }
                          />
                          <Badge
                            className={getStatusBadge(
                              user.status || "inactive",
                            )}
                          >
                            {user.status || "inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {formatLastLogin(user.lastLogin)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUserForReset(user);
                                setResetPasswordModalOpen(true);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.isDeleting}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {user.isDeleting ? "Deleting..." : "Delete User"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-gray-500"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-700">
              Showing {filteredUsers.length} of {users.length} users
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <AddEditUserModal
        isOpen={showAddUserModal || !!editingUser}
        onClose={() => {
          setShowAddUserModal(false);
          setEditingUser(null);
        }}
        user={editingUser}
        clients={allClients} // ✅ Now properly populated with fetched clients
        clientsLoading={clientsLoading} // ✅ Proper loading state
        onSave={(userData: Partial<User>) => {
          if (editingUser) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === editingUser.id ? { ...u, ...userData } : u,
              ),
            );
          } else {
            // Ensure newUser conforms to User type
            const newUser: User = {
              ...userData,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
              isEmailVerified: false,
              twoFactorEnabled: false,
              permissions: [],
              // Ensure all required User properties are present
              firstName: userData.firstName || "",
              lastName: userData.lastName || "",
              email: userData.email || "",
              description: userData.description || "",
              role: userData.role || {
                id: "user",
                name: "User",
                color: "#16A34A",
                description: "Standard user access",
                permissions: [],
                userCount: 0,
                isCustom: false,
              },
              status: userData.status || "active",
            };
            setUsers((prev) => [...prev, newUser]);

            // Show toast notification about verification email status
            if (userData.verificationEmailSent) {
              toast({
                title: "Verification Email Sent",
                description: `A verification email has been sent to ${userData.email}. Please ask the user to check their inbox.`,
                variant: "default",
              });
            } else if (userData.verificationEmailSent === false) {
              toast({
                title: "Verification Email Failed",
                description:
                  userData.verificationError ||
                  `Failed to send verification email to ${userData.email}. The user can request a new verification email from the login page.`,
                variant: "destructive",
              });
            }
          }
          onChangesDetected(true);
        }}
        onChangesDetected={onChangesDetected}
      />

      {/* Reset Password Modal */}
      <ForgotPasswordModal
        isOpen={resetPasswordModalOpen}
        onClose={() => {
          setResetPasswordModalOpen(false);
          setSelectedUserForReset(null);
        }}
        prefilledEmail={selectedUserForReset?.email || ""}
      />

      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <MyProfileTab
            onChangesDetected={onChangesDetected}
            user={convertToAuthUser(selectedUserForProfile)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
