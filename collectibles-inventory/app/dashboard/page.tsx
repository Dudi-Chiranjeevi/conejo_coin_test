"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/context/auth-context";
import { Dashboard } from "./components/dashboard";
import { ProtectedRoute } from "../auth/components/protected-route";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // console.log("Dashboard received user:", user);

  return (
    <ProtectedRoute>
      <Dashboard
        user={user!}
        onLogout={async () => {
          await logout();
          router.replace("/");
        }}
        onNavigate={(path) => {
          router.push(path);
        }}
      />
    </ProtectedRoute>
  );
}
