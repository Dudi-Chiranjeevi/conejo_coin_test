"use client";

import { UserManagementSettings } from "./components/user-management-settings";
import { Toaster } from "@/components/ui/toaster";

export default function UserManagementSettingsPage() {
  return (
    <>
      <UserManagementSettings />
      <Toaster />
    </>
  );
}
