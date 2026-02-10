"use client";

import { useRouter } from "next/navigation";
import { AuthSystem } from "./components/auth-system";

export default function AuthPage() {
  const router = useRouter();

  return (
    <AuthSystem
      onNavigate={(path) => {
        if (path === "/dashboard") {
          router.push("/dashboard");
        }
      }}
    />
  );
}
