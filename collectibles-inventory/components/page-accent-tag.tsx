"use client";

import { cn } from "@/lib/utils";

interface PageAccentTagProps {
  className?: string;
}

export function PageAccentTag({ className }: PageAccentTagProps) {
  return (
    <div
      className={cn(
        "relative h-6 w-28 overflow-hidden rounded-full border border-black/10 shadow-sm",
        className,
      )}
    >
      <span className="absolute inset-0 bg-[url('/bg.png')] bg-cover bg-center" />
      <span className="absolute inset-0 bg-white/25 backdrop-blur-[1px]" />
    </div>
  );
}
