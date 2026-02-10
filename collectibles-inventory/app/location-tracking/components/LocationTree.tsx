"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LocationTreeNode, LocationType } from "../types/location";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Edit, Plus, Trash2 } from "lucide-react";
import { CreateLocationDialog } from "./CreateLocationDialog";
import { UpdateLocationDialog } from "./UpdateLocationDialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LocationService } from "../services/location-service";

const NEXT: Record<LocationType, LocationType> = {
  site: "room",
  room: "shelf",
  shelf: "box",
  box: "row",
  row: "slot",
  slot: "slot", // terminal; quick-add will still show "slot" but backend hierarchy prevents deeper nesting
};

export function LocationTree({ clientId }: { clientId: string }) {
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openCreate, setOpenCreate] = useState(false);
  const [openUpdate, setOpenUpdate] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<LocationType>("room");

  // State for delete confirmation dialog and update dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationTreeNode | null>(null);

  // Function to fetch location tree
  const fetchLocationTree = async () => {
    try {
      const data = await LocationService.getLocationTree(clientId);
      setTree(data);
    } catch (error) {
      console.error("Error fetching location tree:", error);
    }
  };

  useEffect(() => {
    fetchLocationTree();
  }, [clientId]);

  // Function to handle location deletion
  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;

    try {
      await LocationService.deleteLocation(selectedLocation.id);
      // Refresh the tree after deletion
      fetchLocationTree();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting location:", error);
    }
  };

  return (
    <div className="space-y-2">
      {tree.map((n) => (
        <Node
          key={n.id}
          node={n}
          expanded={expanded}
          setExpanded={setExpanded}
          onQuickAdd={(id, type) => {
            setParentId(id);
            setDefaultType(type);
            setOpenCreate(true);
          }}
          onUpdate={(node) => {
            setSelectedLocation(node);
            setOpenUpdate(true);
          }}
          onDelete={(node) => {
            setSelectedLocation(node);
            setDeleteDialogOpen(true);
          }}
        />
      ))}

      {/* Create Location Dialog */}
      <CreateLocationDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        clientId={clientId}
        parentId={parentId}
        defaultType={defaultType}
        onCreated={() => {
          // Refresh the tree after creation
          fetchLocationTree();
        }}
      />

      {/* Update Location Dialog */}
      <UpdateLocationDialog
        open={openUpdate}
        onOpenChange={setOpenUpdate}
        location={selectedLocation}
        onUpdated={() => {
          // Refresh the tree after update
          fetchLocationTree();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the location "
              {selectedLocation?.name}" and all its children. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Node({
  node,
  level = 0,
  expanded,
  setExpanded,
  onQuickAdd,
  onUpdate,
  onDelete,
}: {
  node: LocationTreeNode;
  level?: number;
  expanded: Record<string, boolean>;
  setExpanded: (v: Record<string, boolean>) => void;
  onQuickAdd: (parentId: string, nextType: LocationType) => void;
  onUpdate?: (node: LocationTreeNode) => void;
  onDelete?: (node: LocationTreeNode) => void;
}) {
  const isOpen = expanded[node.id] ?? level === 0; // open roots by default
  const toggle = () => setExpanded({ ...expanded, [node.id]: !isOpen });
  const next = NEXT[node.type];

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${level * 16}px` }}
          >
            <button
              className="p-1 text-muted-foreground"
              onClick={toggle}
              title="Toggle"
            >
              {node.children.length ? (
                isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="inline-block w-4" />
              )}
            </button>
            <div className="text-sm">
              {node.name}{" "}
              <span className="text-xs text-muted-foreground">
                ({node.type})
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto h-7 w-7"
              onClick={() => onQuickAdd(node.id, next)}
              title="Add child"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {onUpdate && (
            <ContextMenuItem
              onClick={() => onUpdate(node)}
              className="cursor-pointer"
            >
              <Edit className="mr-2 h-4 w-4" />
              Update
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onDelete(node)}
                className="cursor-pointer text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {isOpen &&
        node.children.map((c) => (
          <Node
            key={c.id}
            node={c}
            level={level + 1}
            expanded={expanded}
            setExpanded={setExpanded}
            onQuickAdd={onQuickAdd}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}
