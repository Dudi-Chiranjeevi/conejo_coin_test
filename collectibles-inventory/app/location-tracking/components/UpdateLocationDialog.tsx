"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Location, LocationType, LocationTreeNode } from "../types/location";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LocationService } from "../services/location-service";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParentTreeSelect } from "./ParentTreeSelect";
import { toast } from "sonner";

const TYPES: LocationType[] = ["site", "room", "shelf", "row", "box", "slot"];

interface UpdateLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationTreeNode | null;
  onUpdated: () => void;
}

export function UpdateLocationDialog({
  open,
  onOpenChange,
  location,
  onUpdated,
}: UpdateLocationDialogProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [type, setType] = useState<LocationType>("room");
  const [capacity, setCapacity] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableParents, setAvailableParents] = useState<LocationTreeNode[]>(
    []
  );
  const [clientId, setClientId] = useState<string | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [rootsTree, setRootsTree] = useState<LocationTreeNode[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  // Allowed parent types by location type (Site → Room → Shelf → Box → Row → Slot)
  const ALLOWED_PARENT: Record<LocationType, LocationType[] | null> = {
    site: null, // no parent
    room: ["site"],
    shelf: ["room"],
    box: ["shelf"],
    row: ["box"],
    slot: ["row"],
  };

  useEffect(() => {
    if (open && location) {
      // First get the full location details to get the client_id
      api<Location>(`/locations/locations/${location.id}/`)
        .then((fullLocation) => {
          const clientId = fullLocation.client_id;
          setClientId(clientId);

          // Fetch all locations for this client (flat list, paginated)
          return api<{ results: Location[] }>(
            `/locations/locations/?client_id=${clientId}`
          );
        })
        .then((data) => {
          const flat: Location[] = (data as any)?.results || [];
          setAllLocations(flat);
          const map = new Map<string, Location>();
          flat.forEach((l: Location) => map.set(l.id, l));

          // Build a simple tree from flat list for exclusion and display
          const byId = new Map<string, LocationTreeNode>();
          flat.forEach((l: Location) =>
            byId.set(l.id, {
              id: l.id,
              name: l.name,
              type: l.type as LocationType,
              parent_id: l.parent || null,
              capacity: (l as any).capacity ?? null,
              path: "",
              children: [],
            })
          );
          const roots: LocationTreeNode[] = [];
          byId.forEach((n) => {
            if (n.parent_id && byId.get(n.parent_id)) {
              byId.get(n.parent_id)!.children!.push(n);
            } else {
              roots.push(n);
            }
          });

          // Compute path strings
          const computePath = (n: LocationTreeNode): string => {
            const segs: string[] = [];
            let cur: LocationTreeNode | undefined = n;
            while (cur) {
              segs.unshift(cur.name);
              cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
            }
            return segs.join(" / ");
          };
          byId.forEach((n) => (n.path = computePath(n)));

          // Flatten full tree
          const flattened = flattenLocationTree(roots);

          // Build set of ids in the current node's subtree (to exclude)
          const subtreeIds = new Set<string>();
          const addSubtree = (node: LocationTreeNode) => {
            subtreeIds.add(node.id);
            node.children?.forEach(addSubtree);
          };
          const findNodeById = (
            nodes: LocationTreeNode[],
            id: string
          ): LocationTreeNode | null => {
            for (const n of nodes) {
              if (n.id === id) return n;
              const inChild = findNodeById(n.children || [], id);
              if (inChild) return inChild;
            }
            return null;
          };
          const currentNode = findNodeById(roots, location.id);
          if (currentNode) addSubtree(currentNode);
          setBlockedIds(Array.from(subtreeIds));
          setRootsTree(roots);

          // Full tree minus current subtree; sort by path
          const candidates = flattened
            .filter((item) => !subtreeIds.has(item.id))
            .sort((a, b) => a.path.localeCompare(b.path));

          setAvailableParents(candidates);
        })
        .catch((err) => {
          console.error("Error fetching locations:", err);
          setError("Failed to load parent locations");
        });
    }
  }, [open, location]);

  // Reset form when dialog opens with new location
  useEffect(() => {
    if (open && location) {
      setName(location.name);
      setType(location.type);
      setParentId(location.parent_id);
      setCapacity(location.capacity || "");
      setError(null);
    }
  }, [open, location]);

  // Helper function to flatten the location tree
  const flattenLocationTree = (
    nodes: LocationTreeNode[]
  ): LocationTreeNode[] => {
    let result: LocationTreeNode[] = [];

    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = [...result, ...flattenLocationTree(node.children)];
      }
    }

    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!location) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Validate hierarchy: non-site types must have a parent
      if (type !== "site" && !parentId) {
        setIsSubmitting(false);
        const msg = "Please select a parent location.";
        setError(msg);
        toast.error(msg);
        return;
      }
      // Prepare update data
      const updateData: Partial<Location> = {
        name,
      };

      // For site type, explicitly set parent to null
      // For other types, use parentId if provided
      if (type === "site") {
        updateData.parent = null;
      } else {
        updateData.parent = parentId;
      }

      // Include capacity if provided
      if (capacity !== "") {
        updateData.capacity = Number(capacity);
      } else {
        updateData.capacity = null;
      }

      await LocationService.updateLocation(location.id, updateData);

      toast.success(`Updated ${name}`);
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      console.error("Error updating location:", err);
      toast.error(err.message || "Failed to update location");
      setError(err.message || "Failed to update location");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md backdrop-blur-sm">
        <DialogHeader>
          <div className="h-1.5 w-full bg-sky-500/70 rounded-t-md" />
          <DialogTitle className="text-slate-900">Update Location</DialogTitle>
          <DialogDescription>
            Update the details for this location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Location name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="text-sm">{type}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Location type cannot be changed
              </p>
            </div>

            {type !== "site" && (
              <div className="space-y-1.5">
                <Label>Parent Location</Label>
                {(() => {
                  const allowedParents: Record<
                    LocationType,
                    LocationType[] | null
                  > = {
                    site: null,
                    room: ["site"],
                    shelf: ["room"],
                    box: ["shelf"],
                    row: ["box"],
                    slot: ["row"],
                  };
                  return (
                    <ParentTreeSelect
                      value={parentId}
                      onChange={setParentId}
                      roots={rootsTree as any}
                      allowedParents={allowedParents}
                      currentType={type}
                      disabledIds={[...(blockedIds || []), location!.id]}
                      placeholder="Select parent location"
                    />
                  );
                })()}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="capacity">Capacity (optional)</Label>
              <Input
                id="capacity"
                type="number"
                value={capacity}
                onChange={(e) =>
                  setCapacity(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="e.g. 50"
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of items this location can hold
              </p>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border-slate-200 text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              {isSubmitting ? "Updating..." : "Update Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
