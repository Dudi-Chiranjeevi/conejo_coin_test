"use client";

import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Location } from "../types/location";

interface LocationTreeProps {
  locations: LocationWithChildren[];
  selectedLocation: string | null;
  onLocationSelect: (locationId: string) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  dragOverLocation: string | null;
  isValidDropTarget: boolean;
  onUpdateLocation?: (locationId: string) => void;
  onDeleteLocation?: (locationId: string) => void;
}

const locationIcons: Record<string, React.ReactNode> = {
  site: <span className="text-slate-600">🏢</span>,
  room: <span className="text-slate-700">🚪</span>,
  shelf: <span className="text-slate-700">📚</span>,
  box: <span className="text-sky-600">📦</span>,
  row: <span className="text-sky-700">📄</span>,
  slot: <span className="text-sky-800">📍</span>,
};

const getIndentLevel = (type: string): number => {
  // Visual hierarchy: site -> room -> shelf -> box -> row -> slot
  // This ensures rows under a box (e.g. "Row 1" under "1A") align
  // consistently with their parent/peers in the tree.
  const levels: Record<string, number> = {
    site: 0,
    room: 1,
    shelf: 2,
    box: 3,
    row: 4,
    slot: 5,
  };
  return levels[type] || 0;
};

// Define an extended Location type that includes children for tree structure
interface LocationWithChildren extends Location {
  children: LocationWithChildren[];
  itemCount?: number;
}

export function LocationTree({
  locations,
  selectedLocation,
  onLocationSelect,
  expandedNodes,
  onToggleExpand,
  dragOverLocation,
  isValidDropTarget,
  onUpdateLocation,
  onDeleteLocation,
}: LocationTreeProps) {
  // The locations prop is already a tree structure, so we don't need to rebuild it
  // Just use it directly
  console.log("LocationTree received locations:", locations);

  const renderNode = (node: LocationWithChildren): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedLocation === node.id;
    const isDragOver = dragOverLocation === node.id;
    const indentLevel = getIndentLevel(node.type);
    const isValidDropTarget =
      node.type === "row" || node.type === "slot" || node.type === "box";

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={`
            flex items-center h-9 px-2 cursor-pointer rounded-md
            transition-all duration-200 ease-out group
            hover:bg-slate-100/80
            ${
              isSelected
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-sky-200"
                : "text-slate-800"
            }
            ${
              isDragOver && isValidDropTarget
                ? "bg-sky-50 border border-sky-300 border-dashed"
                : ""
            }
            ${
              isDragOver && !isValidDropTarget
                ? "bg-red-50 border border-red-200 border-dashed"
                : ""
            }
          `}
              style={{ paddingLeft: `${indentLevel * 16 + 8}px` }}
              onClick={() => onLocationSelect(node.id)}
            >
              {/* Expand/Collapse Button */}
              <div className="w-5 h-5 flex items-center justify-center mr-1">
                {hasChildren ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 p-0 hover:bg-slate-100 text-slate-700"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(node.id);
                    }}
                  >
                    <span className="text-slate-700 text-xs font-semibold leading-none">
                      {isExpanded ? "v" : ">"}
                    </span>
                  </Button>
                ) : null}
              </div>

              {/* Location Icon */}
              <span className="mr-2">{locationIcons[node.type]}</span>

              {/* Location Name */}
              <span className="flex-1 text-sm">{node.name}</span>

              {/* Item Count Badge */}
              {node.itemCount !== undefined && node.itemCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 text-xs bg-slate-100 text-slate-700 border-slate-200"
                >
                  {node.itemCount}
                </Badge>
              )}

              {/* Capacity Info - Commented out for now */}
              {/* 
          {node.type === "slot" && node.identification_number ? (
            <span className="text-xs text-yellow-600 ml-2">
              /{node.identification_number}
            </span>
          ) : node.capacity ? (
            <span className="text-xs text-yellow-600 ml-2">
              /{node.capacity}
            </span>
          ) : null}
          */}
            </div>
          </ContextMenuTrigger>
          {(onUpdateLocation || onDeleteLocation) && (
            <ContextMenuContent className="w-44">
              {onUpdateLocation && (
                <ContextMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onUpdateLocation(node.id);
                  }}
                >
                  Update
                </ContextMenuItem>
              )}
              {onUpdateLocation && onDeleteLocation && <ContextMenuSeparator />}
              {onDeleteLocation && (
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    onDeleteLocation(node.id);
                  }}
                >
                  Delete
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          )}
        </ContextMenu>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="transition-all duration-200">
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  // Render the root node of the tree
  return (
    <div className="h-full overflow-y-auto py-2 bg-slate-50">
      {locations.length > 0 ? (
        locations.map((node: LocationWithChildren) => renderNode(node))
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <p className="text-slate-500">No locations found</p>
        </div>
      )}
    </div>
  );
}
