"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Location, LocationType } from "../types/location";
import type { InventoryItem } from "@/app/inventory-management/types/inventory";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateLocationDialog } from "./CreateLocationDialog";
import { toast } from "sonner";

const ALLOWED_DROP_TYPES = new Set<LocationType>([
  "site",
  "room",
  "shelf",
  "row",
  "box",
  "slot",
]); // show all location types

type Props = {
  clientId: string;
  itemsEndpoint?: string; // defaults to /inventory_items/?client_id=<uuid>
  itemPatchPath?: (id: string) => string; // defaults to /inventory_items/:id/
};

export function LocationBoard({
  clientId,
  itemsEndpoint,
  itemPatchPath = (id) => `/inventory/inventory_items/${id}/`,
}: Props) {
  console.log("LocationBoard rendering with clientId:", clientId);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [createParent, setCreateParent] = useState<string | null>(null);
  const [createDefaultType, setCreateDefaultType] =
    useState<LocationType>("row");

  // Debug state values on each render
  console.log("Current state - locations:", locations);
  console.log("Current state - items:", items);

  // Define types for paginated responses
  type PaginatedResponse<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
  };

  useEffect(() => {
    (async () => {
      try {
        console.log("Fetching locations with client_id:", clientId);
        const locsResponse = await api<PaginatedResponse<Location>>(
          `/locations/locations/?client_id=${clientId}`
        );
        console.log("Locations API response:", locsResponse);

        // Extract the results array from the paginated response
        const locs = locsResponse.results || [];
        setLocations(locs);

        const url =
          itemsEndpoint ?? `/inventory/inventory_items/?client_id=${clientId}`;
        console.log("Fetching items from URL:", url);
        const itsResponse = await api<PaginatedResponse<InventoryItem>>(url);
        console.log("Items API response:", itsResponse);

        // Extract the results array from the paginated response
        const its = itsResponse.results || [];
        setItems(its);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch data");
      }
    })();
  }, [clientId, itemsEndpoint]);

  const itemsByLocation = useMemo(() => {
    const map: Record<string, InventoryItem[]> = { unassigned: [] };
    // Ensure locations is an array before iterating
    const locationArray = Array.isArray(locations) ? locations : [];
    for (const loc of locationArray) map[loc.id] = [];

    // Ensure items is an array before iterating
    const itemsArray = Array.isArray(items) ? items : [];
    for (const it of itemsArray) {
      const k = it.location ?? "unassigned";
      if (!map[k]) map[k] = [];
      map[k].push(it);
    }
    return map;
  }, [items, locations]);

  const onDragEnd = async (e: DragEndEvent) => {
    const itemId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const target = locations.find((l) => l.id === overId);
    if (!target) return;

    if (!ALLOWED_DROP_TYPES.has(target.type)) {
      toast.warning(`You cannot drop into a ${target.type}.`);
      return;
    }

    const cap = target.capacity ?? null;
    if (cap !== null) {
      const count = itemsByLocation[overId]?.length ?? 0;
      if (count >= cap) {
        toast.error("Target location is full.");
        return;
      }
    }

    const prevLoc = item.location;
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, location: overId } : i))
    );

    try {
      await api(`/inventory/inventory_items/${itemId}/`, {
        method: "PATCH",
        body: JSON.stringify({ location: overId }),
      });
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, location: prevLoc } : i))
      );
      toast.error(err.message ?? "Failed to move item");
    }
  };

  const openCreateForParent = (parentId: string, defaultType: LocationType) => {
    setCreateParent(parentId);
    setCreateDefaultType(defaultType);
    setOpenCreate(true);
  };

  const nextType: Record<LocationType, LocationType> = {
    site: "room",
    room: "shelf",
    shelf: "row",
    row: "box",
    box: "slot",
    slot: "slot",
  };

  const droppableLocations = Array.isArray(locations)
    ? locations.filter((l) => {
        console.log(
          `Location ${l.name} has type ${
            l.type
          }, allowed: ${ALLOWED_DROP_TYPES.has(l.type)}`
        );
        return ALLOWED_DROP_TYPES.has(l.type);
      })
    : [];

  console.log("Filtered droppableLocations:", droppableLocations);

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold">
            Locations ({Array.isArray(locations) ? locations.length : 0})
          </div>
          <Button
            size="sm"
            onClick={() => {
              setCreateParent(null);
              setOpenCreate(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New Location
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <LocationColumn
            id="unassigned"
            title="Unassigned"
            type="slot"
            items={itemsByLocation["unassigned"] || []}
            droppable={false}
            capacity={undefined}
            onQuickAdd={null}
          />

          {droppableLocations.map((loc) => (
            <LocationColumn
              key={loc.id}
              id={loc.id}
              title={`${loc.name} (${loc.type})`}
              type={loc.type}
              capacity={loc.capacity ?? undefined}
              items={itemsByLocation[loc.id] || []}
              droppable
              onQuickAdd={() => openCreateForParent(loc.id, nextType[loc.type])}
            />
          ))}
        </div>
      </DndContext>

      <CreateLocationDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        clientId={clientId}
        parentId={createParent}
        defaultType={createDefaultType}
        onCreated={(loc) => setLocations((prev) => [...prev, loc])}
      />
    </>
  );
}

function LocationColumn({
  id,
  title,
  type,
  items,
  droppable,
  capacity,
  onQuickAdd,
}: {
  id: string;
  title: string;
  type: LocationType;
  items: InventoryItem[];
  droppable?: boolean;
  capacity?: number;
  onQuickAdd: null | (() => void);
}) {
  const { setNodeRef } = useDroppable({ id });
  const full = typeof capacity === "number" ? items.length >= capacity : false;

  return (
    <div ref={droppable ? setNodeRef : undefined} className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {typeof capacity === "number" && (
            <span
              className={`text-xs ${
                full ? "text-red-600" : "text-muted-foreground"
              }`}
            >
              {items.length}/{capacity}
            </span>
          )}
          {onQuickAdd ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onQuickAdd}
              title="Add child"
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={`min-h-32 rounded-2xl border p-2 ${
          droppable ? "bg-muted/30" : "bg-muted/10"
        }`}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-2">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: InventoryItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md ${
        isDragging ? "opacity-60 scale-105" : ""
      }`}
    >
      <CardHeader className="py-2 text-sm font-medium truncate">
        {item.name}
      </CardHeader>
      <CardContent className="flex items-center gap-2 py-2">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt=""
            className="h-10 w-10 rounded object-cover border border-gray-200"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">
            <span className="text-xs">No img</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground flex flex-col">
          <span className="font-medium">
            {item.categorySpecifics?.grade || ""}
          </span>
          <span className="text-xs opacity-80">{item.displayStatus || ""}</span>
        </div>
      </CardContent>
    </Card>
  );
}
