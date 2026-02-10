"use client";

import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/app/inventory-management/types/inventory";

interface ItemCardsProps {
  items: InventoryItem[];
  onDragStart: (item: InventoryItem) => void;
  onDragEnd: () => void;
  draggingItem: InventoryItem | null;
  className?: string;
}

const categoryColors: Record<string, string> = {
  Coins: "bg-slate-100 text-slate-800 border-slate-200",
  Stamps: "bg-rose-100 text-rose-800 border-rose-200",
  Cards: "bg-sky-100 text-sky-800 border-sky-200",
  Silver: "bg-slate-100 text-slate-800 border-slate-200",
  Gold: "bg-goldYellow/20 text-ink border-goldYellow/40",
  Other: "bg-neutral-100 text-neutral-800 border-neutral-200",
};

export function ItemCards({
  items,
  onDragStart,
  onDragEnd,
  draggingItem,
  className = "",
}: ItemCardsProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-slate-600">
          <div className="text-4xl mb-4 opacity-40 animate-pulse">📦</div>
          <p className="font-medium text-lg">No items in this location</p>
          <p className="text-sm text-slate-500">
            Add items to this location from your inventory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
    >
      {items.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => onDragStart(item)}
          onDragEnd={onDragEnd}
          className={`group bg-white rounded-2xl border border-slate-200 shadow-sm cursor-move hover:shadow-md hover:border-sky-300 hover:-translate-y-0.5 transition-all duration-200 ${
            draggingItem?.id === item.id
              ? "opacity-50 shadow-lg border-sky-300"
              : ""
          } flex flex-col`}
        >
          {/* Drag Handle and Category */}
          <div className="relative h-11 border-b border-slate-100">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-slate-500">
              <GripVertical className="h-3.5 w-3.5 opacity-70" />
            </div>
            <div className="flex h-full items-center justify-center">
              <Badge
                variant="outline"
                className={
                  categoryColors[
                    item.category_name as keyof typeof categoryColors
                  ] || categoryColors.Other
                }
              >
                {item.category_name || item.displayCategory || "Coin"}
              </Badge>
            </div>
          </div>

          {/* Item Image */}
          <div className="relative bg-white overflow-hidden rounded-t-xl rounded-b-none">
            {(() => {
              // Get image URL from various possible sources in order of preference
              const imageUrl =
                // 1. Try front thumbnail from images array
                (item.images && item.images[0]?.front_thumbnail_url) ||
                // 2. Try front image from images array
                (item.images && item.images[0]?.front_url) ||
                // 3. Try frontURL property (from previous implementation)
                item.frontURL ||
                // 4. Try thumbnail property (from previous implementation)
                item.thumbnail ||
                // 5. Fallback to placeholder
                "/placeholder.svg";

              return imageUrl ? (
                <div
                  className="w-full overflow-hidden bg-white"
                  style={{ aspectRatio: "3 / 4" }}
                >
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder.svg";
                      console.log("Image failed to load:", imageUrl);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <span className="text-slate-400 text-sm">No image</span>
                </div>
              );
            })()}
          </div>

          {/* Item Details */}
          <div className="p-4 space-y-1">
            <h3 className="text-sm font-medium line-clamp-2 text-slate-900">
              {item.name}
            </h3>
            {item.categorySpecifics?.year && (
              <p className="text-xs text-slate-500">
                {item.categorySpecifics.year}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
