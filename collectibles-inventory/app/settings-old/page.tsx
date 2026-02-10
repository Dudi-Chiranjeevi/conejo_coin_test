"use client";

import { UserManagementSettings } from "./components/user-management-settings";
import { Toaster } from "@/components/ui/toaster";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Component that uses useSearchParams wrapped in Suspense
function SettingsWithParams() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "users";

  return <UserManagementSettings defaultTab={defaultTab} />;
}

export default function UserManagementSettingsPage() {
  return (
    <>
      <Suspense fallback={<div>Loading settings...</div>}>
        <SettingsWithParams />
      </Suspense>
      <Toaster />
    </>
  );
}
