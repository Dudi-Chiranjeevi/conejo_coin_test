"use client";

import { useRouter } from "next/navigation";
import { AuthSystem } from "./auth/components/auth-system";

export default function Page() {
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
