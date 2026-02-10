// components/locations/LocationBreadcrumbFetcher.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

type BreadcrumbItem = {
  id: string;
  name: string;
  type: string;
};

export function LocationBreadcrumbFetcher({
  locationId,
}: {
  locationId: string;
}) {
  const [crumbs, setCrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBreadcrumbs() {
      try {
        setLoading(true);
        setError(null);
        const data = await api<BreadcrumbItem[]>(
          `/locations/${locationId}/breadcrumbs/`
        );
        setCrumbs(data);
      } catch (err: any) {
        setError(err.message || "Failed to load breadcrumbs");
        console.error("Error fetching breadcrumbs:", err);
      } finally {
        setLoading(false);
      }
    }

    if (locationId) {
      fetchBreadcrumbs();
    } else {
      setCrumbs([]);
      setLoading(false);
    }
  }, [locationId]);

  if (loading) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Skeleton className="h-4 w-20" />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Skeleton className="h-4 w-24" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500">Error: {error}</div>;
  }

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <BreadcrumbItem key={crumb.id}>
            <BreadcrumbLink href={`/location-tracking/${crumb.id}`}>
              {crumb.name}{" "}
              <span className="text-xs text-muted-foreground">
                ({crumb.type})
              </span>
            </BreadcrumbLink>
            {i < crumbs.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
