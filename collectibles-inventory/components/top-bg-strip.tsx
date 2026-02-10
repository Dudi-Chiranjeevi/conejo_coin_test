"use client";

import { usePathname } from "next/navigation";

export function TopBgStrip() {
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

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-2 overflow-hidden bg-[url('/bg.png')] bg-repeat-x bg-[length:200px_100%] bg-center shadow-[0_1px_0_rgba(15,23,42,0.10)]"
      >
        <div className="absolute inset-0 opacity-20" />
      </div>
      <div className="h-2" />
    </>
  );
}
