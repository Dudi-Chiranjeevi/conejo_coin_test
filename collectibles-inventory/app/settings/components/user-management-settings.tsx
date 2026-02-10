"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Users,
  UserIcon,
  Save,
  ChevronRight,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTab } from "./user-management-tab";
import { RoleManagementSection } from "./role-management-section";
import { MyProfileTab } from "./my-profile-tab";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/app/auth/context/auth-context";
import { useRBAC } from "@/app/auth/hooks/use-rbac";
import { PermissionGuard } from "@/app/auth/components/permission-guard";
import { SystemSettingsTab } from "./system-settings-tab";
import { ClientManagementTab } from "./client-management-tab";

export function UserManagementSettings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = useRBAC();

  // Check user role for access control - Modified by: Navateja
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  const canAccessUserManagement = isSuperAdmin || isAdmin;

  // Simulate unsaved changes detection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Math.random() > 0.7) {
        setHasUnsavedChanges(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleSaveAll = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setHasUnsavedChanges(false);
    setIsLoading(false);

    toast({
      title: "Changes saved successfully",
      description: "All settings have been updated.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="flex items-center justify-between pb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="text-sky-600 hover:text-sky-700 transition-colors"
                aria-label="Back"
                type="button"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mt-4">
                  User Management & Settings
                </h1>
                <p className="text-gray-600">
                  Manage users, roles, and system configuration
                </p>
              </div>
            </div>
            {/* commented by uday
            {hasUnsavedChanges && (
              <Button onClick={handleSaveAll} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save All Changes"}
              </Button>
            )} */}
          </div>

          {/* Tab Navigation */}
          <div className="w-full border-b border-gray-200 mb-6">
            <div className="flex overflow-x-auto scrollbar-hide justify-center">
              <div className="flex">
                {/* User Management Tab - Show for super-admin and admin - Modified by: Navateja */}
                {canAccessUserManagement && (
                  <button
                    onClick={() => setActiveTab("users")}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === "users" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <Users className="h-4 w-4" />
                    User Management
                  </button>
                )}

                {/* Client Management Tab - Show only for super-admin - Modified by: Navateja */}
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab("clients")}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === "clients"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Client Management
                  </button>
                )}

                {/* Role Management Tab - Show only for super-admin - Modified by: Navateja */}
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab("roles")}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === "roles" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <Shield className="h-4 w-4" />
                    Role Management
                  </button>
                )}

                {/* System Settings Tab - Show only for super-admin - Modified by: Navateja */}
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === "settings" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <Settings className="h-4 w-4" />
                    System Settings
                  </button>
                )}

                {/* Always show Profile */}
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === "profile" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <UserIcon className="h-4 w-4" />
                  My Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* User Management Tab Content - Show for super-admin and admin - Modified by: Navateja */}
          {canAccessUserManagement && (
            <TabsContent value="users" className="mt-0">
              <UserManagementTab onChangesDetected={setHasUnsavedChanges} />
            </TabsContent>
          )}

          {/* Client Management Tab Content - Show only for super-admin - Modified by: Navateja */}
          {isSuperAdmin && (
            <TabsContent value="clients" className="mt-0">
              <ClientManagementTab />
            </TabsContent>
          )}

          {/* Role Management Tab Content - Show only for super-admin - Modified by: Navateja */}
          {isSuperAdmin && (
            <TabsContent value="roles" className="mt-0">
              <RoleManagementSection onChangesDetected={setHasUnsavedChanges} />
            </TabsContent>
          )}

          {/* System Settings Tab Content - Show only for super-admin - Modified by: Navateja */}
          {isSuperAdmin && (
            <TabsContent value="settings" className="mt-0">
              <SystemSettingsTab onChangesDetected={setHasUnsavedChanges} />
            </TabsContent>
          )}

          {/* Profile Tab Content - Always visible */}
          <TabsContent value="profile" className="mt-0">
            <MyProfileTab
              onChangesDetected={setHasUnsavedChanges}
              user={user}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Unsaved Changes Indicator */}
      {/* {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 bg-orange-100 border border-orange-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-orange-800">
              You have unsaved changes
            </span>
          </div>
        </div>
      )} */}
    </div>
  );
}
