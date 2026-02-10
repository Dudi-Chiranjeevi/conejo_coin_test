"use client";

import { useState, useEffect } from "react";
import { Settings, Users, UserIcon, Save, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTab } from "./user-management-tab";
import { SystemSettingsTab } from "./system-settings-tab";
import { MyProfileTab } from "./my-profile-tab";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface UserManagementSettingsProps {
  defaultTab?: string;
}

export function UserManagementSettings({
  defaultTab = "users",
}: UserManagementSettingsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

    // Simulate save operation
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
          {/* Breadcrumb */}
          <div className="flex items-center py-4 text-sm text-gray-500">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center px-2 py-1 rounded-md transition-all duration-200
                hover:bg-blue-100 hover:text-blue-700 hover:underline
                active:bg-blue-200 active:scale-95"
            >
              <span>Dashboard</span>
            </button>
            <ChevronRight className="h-4 w-4 mx-2" />
            <span className="text-gray-900 font-medium">Settings</span>
          </div>

          {/* Page Header */}
          <div className="flex items-center justify-between pb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  User Management & Settings
                </h1>
                <p className="text-gray-600">
                  Manage users, roles, and system configuration
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            {hasUnsavedChanges && (
              <Button
                onClick={handleSaveAll}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 shadow-lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save All Changes"}
              </Button>
            )}
          </div>

          {/* Tab Navigation */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Management
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                System Settings
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                My Profile
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="users" className="mt-0">
            <UserManagementTab onChangesDetected={setHasUnsavedChanges} />
          </TabsContent>

          <TabsContent value="system" className="mt-0">
            <SystemSettingsTab onChangesDetected={setHasUnsavedChanges} />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <MyProfileTab onChangesDetected={setHasUnsavedChanges} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Unsaved Changes Indicator */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 bg-sky-100 border border-sky-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-sky-800">
              You have unsaved changes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
