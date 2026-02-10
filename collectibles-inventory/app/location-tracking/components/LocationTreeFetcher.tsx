// components/locations/LocationTreeFetcher.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LocationTreeNode, LocationType } from "../types/location";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { CreateLocationDialog } from "./CreateLocationDialog";
import { toast } from "sonner";

const NEXT: Record<LocationType, LocationType> = {
  site: "room",
  room: "shelf",
  shelf: "row",
  row: "box",
  box: "slot",
  slot: "slot",
};

export function LocationTreeFetcher({ clientId }: { clientId: string }) {
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openCreate, setOpenCreate] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<LocationType>("room");

  useEffect(() => {
    async function fetchTree() {
      try {
        setLoading(true);
        setError(null);
        const data = await api<LocationTreeNode[]>(
          `/locations/locations/tree/?client_id=${clientId}`
        );
        setTree(data);
      } catch (err: any) {
        setError(err.message || "Failed to load location tree");
        console.error("Error fetching location tree:", err);
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      fetchTree();
    } else {
      setTree([]);
      setLoading(false);
    }
  }, [clientId]);

  const refreshTree = async () => {
    try {
      setLoading(true);
      const data = await api<LocationTreeNode[]>(
        `/locations/locations/tree/?client_id=${clientId}`
      );
      setTree(data);
    } catch (err: any) {
      toast.error("Failed to refresh location tree");
    } finally {
      setLoading(false);
    }
  };

  if (loading && tree.length === 0) {
    return <div className="p-4">Loading location tree...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>Error: {error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshTree}
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Location Tree</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setParentId(null);
            setDefaultType("site");
            setOpenCreate(true);
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add Root
        </Button>
      </div>

      {tree.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border rounded-md">
          No locations found. Create your first location to get started.
        </div>
      ) : (
        tree.map((n) => (
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
          />
        ))
      )}

      <CreateLocationDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        clientId={clientId}
        parentId={parentId}
        defaultType={defaultType}
        onCreated={() => {
          refreshTree();
        }}
      />
    </div>
  );
}

function Node({
  node,
  level = 0,
  expanded,
  setExpanded,
  onQuickAdd,
}: {
  node: LocationTreeNode;
  level?: number;
  expanded: Record<string, boolean>;
  setExpanded: (v: Record<string, boolean>) => void;
  onQuickAdd: (parentId: string, nextType: LocationType) => void;
}) {
  const isOpen = expanded[node.id] ?? level === 0; // open roots by default
  const toggle = () => setExpanded({ ...expanded, [node.id]: !isOpen });
  const next = NEXT[node.type];

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 hover:bg-muted/30 rounded px-1"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
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
          <span className="text-xs text-muted-foreground">({node.type})</span>
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
      {isOpen &&
        node.children.map((c) => (
          <Node
            key={c.id}
            node={c}
            level={level + 1}
            expanded={expanded}
            setExpanded={setExpanded}
            onQuickAdd={onQuickAdd}
          />
        ))}
    </div>
  );
}
