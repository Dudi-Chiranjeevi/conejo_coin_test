"use client";

import { usePathname } from "next/navigation";
import FloatingChatWidget from "./floating-chat-widget";

export default function GlobalAIWidget() {
  const pathname = usePathname();

  if (
    pathname === "/" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  ) {
    return null;
  }

  return <FloatingChatWidget />;
}
