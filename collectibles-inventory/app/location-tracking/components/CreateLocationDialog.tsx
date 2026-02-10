"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Location, LocationType } from "../types/location";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const TYPES: LocationType[] = ["site", "room", "shelf", "row", "box", "slot"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  parentId?: string | null;
  defaultType?: LocationType;
  onCreated?: (loc: Location) => void;
};

export function CreateLocationDialog({
  open,
  onOpenChange,
  clientId,
  parentId = null,
  defaultType = "room",
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>(defaultType);
  const [capacity, setCapacity] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [parent, setParent] = useState<string | null>(parentId);
  const [candidates, setCandidates] = useState<
    Array<Location & { parent_id?: string | null }>
  >([]);
  const [idToType, setIdToType] = useState<Record<string, LocationType>>({});

  // Allowed parent types by location type (Site → Room → Shelf → Box → Row → Slot)
  const ALLOWED_PARENT: Record<LocationType, LocationType[] | null> = {
    site: null,
    room: ["site"],
    shelf: ["room"],
    box: ["shelf"],
    row: ["box"],
    slot: ["row"],
  };

  useEffect(() => {
    if (!open) return;
    // fetch full tree for parent selection
    api<any>(`/locations/locations/tree/?client=${clientId}`)
      .then((nodes) => {
        const flat: any[] = [];
        const walk = (n: any) => {
          flat.push(n);
          (n.children || []).forEach(walk);
        };
        nodes.forEach(walk);
        // Build type map from flat nodes
        const map: Record<string, LocationType> = {} as any;
        flat.forEach((n) => {
          map[n.id] = n.type as LocationType;
        });
        setIdToType(map);
        setCandidates(flat);
      })
      .catch((e) => console.error("Failed to load parent locations", e));
  }, [open, clientId]);

  useEffect(() => {
    setParent(parentId ?? null);
  }, [parentId]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const body: any = { name, type, client_id: clientId };

      // Validate hierarchy at submit time
      const allowed = ALLOWED_PARENT[type];
      if (type !== "site") {
        if (!parent) {
          toast.error("Please select a parent location for this type");
          setSubmitting(false);
          return;
        }
        const parentType = idToType[parent];
        if (!allowed || !parentType || !allowed.includes(parentType)) {
          toast.error("Invalid parent type for selected location type");
          setSubmitting(false);
          return;
        }
        body.parent = parent;
      } else {
        body.parent = null;
      }

      if (capacity !== "") body.capacity = Number(capacity);

      const loc = await api<Location>("/locations/locations/", {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast.success(`Created ${loc.name}`);
      onCreated?.(loc);
      onOpenChange(false);
      setName("");
      setCapacity("");
      setType(defaultType);
      setParent(parentId ?? null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Row 3"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as LocationType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {type === "site" && (
              <p className="text-xs text-muted-foreground mt-1">
                Site locations are top-level and have no parent
              </p>
            )}
          </div>
          {/* Parent selection - full tree */}
          <div className="space-y-1.5">
            <Label>Parent</Label>
            <Select
              value={parent ?? "__none"}
              onValueChange={(v) => setParent(v === "__none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No parent (root)</SelectItem>
                {candidates
                  .slice()
                  .sort((a: any, b: any) =>
                    (a.path || "").localeCompare(b.path || "")
                  )
                  .map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.path}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Capacity (optional)</Label>
            <Input
              type="number"
              value={capacity}
              onChange={(e) =>
                setCapacity(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 50"
              min={0}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
