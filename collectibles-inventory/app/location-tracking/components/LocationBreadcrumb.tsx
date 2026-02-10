// components/locations/LocationBreadcrumb.tsx
"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function LocationBreadcrumb({ path }: { path: string }) {
  const parts = path.split(" > ");
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {parts.map((p, i) => (
          <BreadcrumbItem key={i}>
            {p}
            {i < parts.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
