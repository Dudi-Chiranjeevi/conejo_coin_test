"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/auth/context/auth-context";
import {
  Save,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Gem,
  Coins,
  Star,
  ChevronRight as ChevronRightIcon,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { InventoryItem } from "../types/inventory";
import { inventoryApi } from "../services/api";
import { locationApi, Location } from "@/lib/services/inventory-service";

/* =============================================================================
   Helpers
============================================================================= */

type AttributesMap = Record<string, any>;

const statusColors: Record<string, string> = {
  "In Store": "bg-goldYellow/20 text-ink border border-goldYellow/40",
  "In Transit": "bg-vividOrange/20 text-ink border border-vividOrange/40",
  Consigned: "bg-warmBg/30 text-ink border border-lightBorder",
  Sold: "bg-gray-200/30 text-gray-700 border border-gray-300/40",
  eBay: "bg-purple-200/30 text-purple-700 border border-purple-300/40",
  in_store: "bg-goldYellow/20 text-ink border border-goldYellow/40",
  in_transit: "bg-vividOrange/20 text-ink border border-vividOrange/40",
  consigned: "bg-warmBg/30 text-ink border border-lightBorder",
  sold: "bg-gray-200/30 text-gray-700 border border-gray-300/40",
  ebay: "bg-purple-200/30 text-purple-700 border border-purple-300/40",
};

const categoryIcons = {
  Coins: <Coins className="h-4 w-4 mr-2 text-sky-600" />,
  Stamps: <Gem className="h-4 w-4 mr-2 text-red-400" />,
  Cards: <Gem className="h-4 w-4 mr-2 text-blue-400" />,
  Metals: <Gem className="h-4 w-4 mr-2 text-gray-400" />,
  Bullion: <Gem className="h-4 w-4 mr-2 text-slate-500" />,
  Gold: <Star className="h-4 w-4 mr-2 text-sky-500" />,
  Silver: <Star className="h-4 w-4 mr-2 text-slate-300" />,
  Diamonds: <Gem className="h-4 w-4 mr-2 text-pink-300" />,
  Other: <Star className="h-4 w-4 mr-2 text-moss-400" />,
};

const safeParse = <T,>(v: any, fallback: T): T => {
  try {
    if (typeof v === "string") return JSON.parse(v) as T;
    if (typeof v === "object" && v !== null) return v as T;
    return fallback;
  } catch {
    return fallback;
  }
};

const kv = (label: string, value: React.ReactNode) => (
  <div className="grid grid-cols-3 gap-3 py-2 border-b border-lightBorder/60 last:border-0">
    <div className="text-sm text-gray-500">{label}</div>
    <div className="col-span-2 text-sm text-gray-900 break-all">
      {value ?? "—"}
    </div>
  </div>
);

// ---------------------------------------------
// Location helpers (robust mapping + id fallback)
// ---------------------------------------------
type NodeOption = {
  id: string;
  label: string;
  parentId?: string;
  type: string;
  path: string;
};

const normalizeType = (
  t: any,
): "site" | "room" | "shelf" | "row" | "box" | "slot" => {
  const v = String(t ?? "").toLowerCase();
  if (["site", "room", "shelf", "row", "box", "slot"].includes(v))
    return v as any;
  if (v === "bin") return "box";
  if (v === "position") return "slot";
  return v as any;
};

const mapLocationsToNodeOptions = (locations: any[]): NodeOption[] => {
  const mapped = (locations || []).map((loc: any) => ({
    id: String(loc.id),
    label: String(loc.name ?? ""),
    parentId: loc.parent_id ?? loc.parent ?? undefined,
    type: normalizeType(loc.type),
    path: String(loc.path ?? ""),
  }));
  // nice-to-have: stable order for selects
  return mapped.sort(
    (a, b) => a.path.localeCompare(b.path) || a.label.localeCompare(b.label),
  );
};

// If we only have a leaf id, walk up parents and return the 6 IDs
const idsFromLeafId = (leafId?: string, locations: NodeOption[] = []) => {
  if (!leafId) return {};
  const byId = new Map(locations.map((l) => [l.id, l]));
  const out: any = {};
  let cur = byId.get(String(leafId));
  // walk backwards using parentId and capture ids by type
  while (cur) {
    if (cur.type === "slot") out.slotId = cur.id;
    else if (cur.type === "row") out.rowId = cur.id;
    else if (cur.type === "box") out.boxId = cur.id;
    else if (cur.type === "shelf") out.shelfId = cur.id;
    else if (cur.type === "room") out.roomId = cur.id;
    else if (cur.type === "site") out.siteId = cur.id;
    cur = cur.parentId ? byId.get(String(cur.parentId)) : undefined;
  }
  return out;
};

// Function to build a location path string from selected location IDs
const buildLocationPath = (
  sel: {
    siteId?: string;
    roomId?: string;
    shelfId?: string;
    rowId?: string;
    boxId?: string;
    slotId?: string;
  },
  locations: NodeOption[],
) => {
  // If we have a final selection (slotId), find that location's full path
  if (sel.slotId) {
    const slot = locations.find((l) => l.id === sel.slotId);
    if (slot) return slot.path;
  } else if (sel.rowId) {
    const row = locations.find((l) => l.id === sel.rowId);
    if (row) return row.path;
  } else if (sel.boxId) {
    const box = locations.find((l) => l.id === sel.boxId);
    if (box) return box.path;
  } else if (sel.shelfId) {
    const shelf = locations.find((l) => l.id === sel.shelfId);
    if (shelf) return shelf.path;
  } else if (sel.roomId) {
    const room = locations.find((l) => l.id === sel.roomId);
    if (room) return room.path;
  } else if (sel.siteId) {
    const site = locations.find((l) => l.id === sel.siteId);
    if (site) return site.path;
  }
  return "";
};

// Function to extract IDs from a location path string
const idsFromPath = (path?: string, locations: NodeOption[] = []) => {
  if (!path || locations.length === 0) return {};

  // Normalize the path for comparison
  const normalizedPath = path.trim();
  const pathParts = normalizedPath.split(">").map((part) => part.trim());

  // Log for debugging
  console.log("Path parts for matching:", pathParts);

  // Find locations for each level in the hierarchy with more flexible matching
  const site = locations.find(
    (l) =>
      l.type === "site" && l.label.toLowerCase() === pathParts[0].toLowerCase(),
  );

  const room = locations.find(
    (l) =>
      l.type === "room" &&
      l.parentId === site?.id &&
      l.label.toLowerCase() === (pathParts[1] || "").toLowerCase(),
  );

  const shelf = locations.find(
    (l) =>
      l.type === "shelf" &&
      l.parentId === room?.id &&
      l.label.toLowerCase() === (pathParts[2] || "").toLowerCase(),
  );

  const box = locations.find(
    (l) =>
      l.type === "box" &&
      l.parentId === shelf?.id &&
      l.label.toLowerCase() === (pathParts[3] || "").toLowerCase(),
  );

  const row = locations.find(
    (l) =>
      l.type === "row" &&
      l.parentId === box?.id &&
      l.label.toLowerCase() === (pathParts[4] || "").toLowerCase(),
  );

  const slot = locations.find(
    (l) =>
      l.type === "slot" &&
      l.parentId === row?.id &&
      l.label.toLowerCase() === (pathParts[5] || "").toLowerCase(),
  );

  // Log what we found for debugging
  console.log("Found locations by path parts:", {
    site: site?.label,
    room: room?.label,
    shelf: shelf?.label,
    box: box?.label,
    row: row?.label,
    slot: slot?.label,
  });

  return {
    siteId: site?.id,
    roomId: room?.id,
    shelfId: shelf?.id,
    boxId: box?.id,
    rowId: row?.id,
    slotId: slot?.id,
  };
};

// Function to get the most specific location ID
const getMostSpecificLocationId = (sel: {
  siteId?: string;
  roomId?: string;
  shelfId?: string;
  boxId?: string;
  rowId?: string;
  slotId?: string;
}) => {
  // Return the most specific location ID based on the correct hierarchy
  return (
    sel.slotId ||
    sel.rowId ||
    sel.boxId ||
    sel.shelfId ||
    sel.roomId ||
    sel.siteId
  );
};

/* =============================================================================
   Component
============================================================================= */

interface ItemDetailModalProps {
  item: InventoryItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
  onDelete: (itemId: string) => void;
}

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: ItemDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedItem, setEditedItem] = useState<InventoryItem>(item);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  // Track description separately to ensure it's properly saved
  const [description, setDescription] = useState<string>(
    (item as any).description || "",
  );
  const [error, setError] = useState<string | null>(null);
  const [lastApiPayload, setLastApiPayload] = useState<any | null>(null);

  // === Attributes editor state (GENERIC / schema-free) ===
  const [attrs, setAttrs] = useState<AttributesMap>(() =>
    safeParse<AttributesMap>(item.attributes, {}),
  );

  /*------------------------------------------------------------------------------
    Attribute edit helper
------------------------------------------------------------------------------*/
  const renameSectionKey = (
    section: "coin" | "grade" | "metadata",
    oldKey: string,
    newKey: string,
  ) => {
    if (!newKey || oldKey === newKey) return;
    setAttrs((prev) => {
      const next = { ...prev };
      const sec = { ...(next[section] || {}) };
      if (Object.prototype.hasOwnProperty.call(sec, oldKey)) {
        const val = sec[oldKey];
        delete sec[oldKey];
        sec[newKey] = val;
        next[section] = sec;
      }
      return next;
    });
  };

  // Update state when item changes
  useEffect(() => {
    console.log(
      "Item changed, updating state with description:",
      (item as any).description,
    );
    setEditedItem(item);
    setAttrs(safeParse<AttributesMap>(item.attributes, {}));

    // Extract description from multiple possible sources
    let description = (item as any).description || "";

    // If description is missing, try to find it in attributes
    if (!description && item.attributes) {
      try {
        const attrs =
          typeof item.attributes === "string"
            ? JSON.parse(item.attributes)
            : item.attributes;

        // Check for description in attributes
        if (attrs && typeof attrs === "object") {
          // Check top level
          if (attrs.description) {
            description = attrs.description;
          }
          // Check in metadata
          else if (attrs.metadata && attrs.metadata.description) {
            description = attrs.metadata.description;
          }
          // Check in coin section
          else if (attrs.coin && attrs.coin.description) {
            description = attrs.coin.description;
          }
          // Check for notes field that might contain description
          else if (attrs.notes) {
            description = attrs.notes;
          }
        }
      } catch (e) {
        console.warn("Error parsing attributes for description:", e);
      }
    }

    // For coins, create a description from attributes if none exists
    if (!description && item.attributes) {
      try {
        const attrs =
          typeof item.attributes === "string"
            ? JSON.parse(item.attributes)
            : item.attributes;

        if (attrs && attrs.coin && attrs.grade) {
          const year = attrs.coin.year || "";
          const denomination = attrs.coin.denomination || "";
          const mintMark = attrs.coin.mint_mark || "";
          const grade = attrs.grade.display || "";

          if (year || denomination || mintMark) {
            description = `${year} ${mintMark} ${denomination} ${grade}`.trim();
          }
        }
      } catch (e) {
        console.warn("Error creating description from attributes:", e);
      }
    }

    console.log("Final description:", description);
    setDescription(description);
  }, [item]);

  // image carousel setting
  const images = useMemo(() => {
    const imgs = safeParse<any[]>((item as any).images, []) || [];

    let front: string | undefined =
      (item as any).frontURL || (item as any).front_url || undefined;
    let rear: string | undefined =
      (item as any).rearURL || (item as any).rear_url || undefined;

    for (const it of imgs) {
      const f = it.front_url ?? it.frontUrl ?? it.front ?? it.obv_url;
      const r = it.rear_url ?? it.rearUrl ?? it.back ?? it.rev_url;
      if (!front && f) front = String(f);
      if (!rear && r) rear = String(r);
      if (front && rear) break;
    }

    // Fallback: use thumbnail if no front found
    if (!front) front = (item as any).thumbnail;

    return [front, rear].filter(Boolean) as string[];
  }, [item]);

  // Location state
  const [locations, setLocations] = useState<NodeOption[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const locationPath = (item as any).location_path || (item as any).location;

  // State for selected location IDs
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [roomId, setRoomId] = useState<string | undefined>(undefined);
  const [shelfId, setShelfId] = useState<string | undefined>(undefined);
  const [rowId, setRowId] = useState<string | undefined>(undefined);
  const [boxId, setBoxId] = useState<string | undefined>(undefined);
  const [slotId, setSlotId] = useState<string | undefined>(undefined);

  // Fetch locations from API
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      setLocationError(null);
      try {
        const clientId = "e9f3a0d4-0b71-4728-b131-ec7bc71e902d"; // you can lift this from /api/config if you prefer
        const locationsData = await locationApi.getAll(clientId);

        let locationsArray: any[] = [];
        if (
          !Array.isArray(locationsData) &&
          locationsData &&
          typeof locationsData === "object"
        ) {
          const responseObj = locationsData as any;
          if ("results" in responseObj && Array.isArray(responseObj.results)) {
            locationsArray = responseObj.results;
          } else {
            console.error(
              "Locations data is not an array and doesn't have results array:",
              locationsData,
            );
            setLocationError(
              "Invalid location data format. Please contact support.",
            );
            setIsLoadingLocations(false);
            return;
          }
        } else if (Array.isArray(locationsData)) {
          locationsArray = locationsData;
        } else {
          console.error(
            "Locations data is in an unexpected format:",
            locationsData,
          );
          setLocationError(
            "Invalid location data format. Please contact support.",
          );
          setIsLoadingLocations(false);
          return;
        }

        const mappedLocations = mapLocationsToNodeOptions(locationsArray);
        setLocations(mappedLocations);

        // Log the item's location information for debugging
        console.log("Item location info:", {
          location_path: (item as any).location_path,
          location_path_display: (item as any).location_path_display,
          locationPath: (item as any).locationPath,
          location: (item as any).location,
        });

        // Preselect: prefer location_path; if absent, use the leaf 'location' id
        const locationPath =
          (item as any).location_path ||
          (item as any).location_path_display ||
          (item as any).locationPath;

        if (locationPath) {
          console.log("Using location path:", locationPath);
          const initialLocIds = idsFromPath(locationPath, mappedLocations);
          console.log("Resolved location IDs from path:", initialLocIds);
          setSiteId(initialLocIds.siteId);
          setRoomId(initialLocIds.roomId);
          setShelfId(initialLocIds.shelfId);
          setRowId(initialLocIds.rowId);
          setBoxId(initialLocIds.boxId);
          setSlotId(initialLocIds.slotId);
        } else {
          // ▼ fallback from location id
          const leafId = (item as any).location as string | undefined;
          console.log("Using leaf location ID:", leafId);
          const fromId = idsFromLeafId(leafId, mappedLocations);
          console.log("Resolved location IDs from leaf ID:", fromId);
          setSiteId(fromId.siteId);
          setRoomId(fromId.roomId);
          setShelfId(fromId.shelfId);
          setRowId(fromId.rowId);
          setBoxId(fromId.boxId);
          setSlotId(fromId.slotId);
        }

        setIsLoadingLocations(false);
      } catch (error) {
        console.error("Error fetching locations:", error);
        setLocationError("Failed to load locations.");
        setIsLoadingLocations(false);
      }
    };

    fetchLocations();
  }, [item]);

  /* ===========================
     Console logs for debugging - reduced to avoid excessive logging
  ============================*/
  useEffect(() => {
    // Only log once when the modal is first opened
    if (isOpen) {
      console.groupCollapsed("[ItemDetailModal] open");
      console.log("item (raw):", item);
      console.log("attributes (parsed):", attrs);
      console.log("images (resolved):", images);
      console.groupEnd();
    }
  }, [isOpen]); // Only run when isOpen changes

  /* ===========================
     Attributes editor helpers
  ============================*/

  // Ensure section object exists
  const ensureSection = (section: "coin" | "grade" | "metadata") => {
    setAttrs((prev) => {
      const next = { ...prev };
      if (
        !next[section] ||
        typeof next[section] !== "object" ||
        Array.isArray(next[section])
      ) {
        next[section] = {};
      }
      return next;
    });
  };

  const setSectionField = (
    section: "coin" | "grade" | "metadata",
    key: string,
    value: string,
  ) => {
    setAttrs((prev) => {
      const next = { ...prev };
      const sec = { ...(next[section] || {}) };
      sec[key] = value;
      next[section] = sec;
      return next;
    });
  };

  const deleteSectionField = (
    section: "coin" | "grade" | "metadata",
    key: string,
  ) => {
    setAttrs((prev) => {
      const next = { ...prev };
      if (next[section] && typeof next[section] === "object") {
        const sec = { ...(next[section] as AttributesMap) };
        delete sec[key];
        next[section] = sec;
      }
      return next;
    });
  };

  const addSectionField = (section: "coin" | "grade" | "metadata") => {
    ensureSection(section);
    // add an empty pair
    setAttrs((prev) => {
      const next = { ...prev };
      const sec = { ...(next[section] as AttributesMap) };
      let i = 1;
      let candidate = "new_field";
      while (sec[candidate]) {
        candidate = `new_field_${i++}`;
      }
      sec[candidate] = "";
      next[section] = sec;
      return next;
    });
  };

  // Top-level (non-object) keys editor (e.g., cert_number, lookup_url)
  const topLevelPairs = useMemo(() => {
    const pairs: { key: string; value: any }[] = [];
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "coin" || k === "grade" || k === "metadata") return; // skip sections
      if (typeof v !== "object") {
        pairs.push({ key: k, value: v });
      }
    });
    return pairs;
  }, [attrs]);

  const setTopLevelKey = (oldKey: string, newKey: string) => {
    setAttrs((prev) => {
      const next = { ...prev };
      if (oldKey !== newKey) {
        const val = next[oldKey];
        delete next[oldKey];
        if (newKey) next[newKey] = val;
      }
      return next;
    });
  };

  const setTopLevelValue = (key: string, value: string) => {
    setAttrs((prev) => ({ ...prev, [key]: value }));
  };

  const addTopLevelPair = () => {
    setAttrs((prev) => {
      const next = { ...prev };
      let i = 1;
      let candidate = "new_key";
      while (candidate in next) candidate = `new_key_${i++}`;
      next[candidate] = "";
      return next;
    });
  };

  const deleteTopLevelKey = (key: string) => {
    setAttrs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /* ===========================
     Save / Delete
  ============================*/

  const { user } = useAuth();

  // Debug user object
  useEffect(() => {
    console.log("Auth user object:", user);
  }, [user]);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // keep editedItem updates (basic fields), but write attributes from editor
      const updated: InventoryItem = {
        ...(editedItem as any),
        attributes: attrs,
        description: description, // Add description to the updated item
      };

      // Get the most specific location ID
      const locationId = getMostSpecificLocationId({
        siteId,
        roomId,
        shelfId,
        rowId,
        boxId,
        slotId,
      });

      // Build the location path for display
      const locationPathDisplay = buildLocationPath(
        {
          siteId,
          roomId,
          shelfId,
          rowId,
          boxId,
          slotId,
        },
        locations,
      );

      const apiData: any = {
        name: (updated as any).name,
        description: description, // Use the separate description state
        category: (updated as any).category,
        status: (updated as any).status,
        location_id: locationId, // Use the most specific location ID
        location: locationId, // Use the most specific location ID
        location_path: locationPathDisplay, // Add the location path for display
        price: (updated as any).price,
        cost: (updated as any).cost,
        attributes: (updated as any).attributes, // <-- generic nested JSON
        updated_by:
          user?.email ||
          `${user?.firstName} ${user?.lastName}` ||
          user?.id ||
          "system",
      };

      console.log("API payload with updated_by:", apiData);
      console.log("Current user from auth context:", user);

      // Log the selected location for debugging
      console.log("Selected location ID:", locationId);
      console.log("Location path for display:", locationPathDisplay);

      console.groupCollapsed("[ItemDetailModal] API call");
      console.log("PUT /inventory/:id payload", apiData);
      console.groupEnd();
      setLastApiPayload(apiData);

      await inventoryApi.updateItem((updated as any).id, apiData);
      onSave(updated);
    } catch (err: any) {
      console.error("Failed to update item:", err);
      if (err?.response) {
        const { status, data } = err.response;
        console.error("Error response status:", status);
        console.error("Error response data:", data);
        if (status === 404) {
          // optimistic close if backend returns 404 after success
          onSave({ ...(editedItem as any), attributes: attrs });
          setIsLoading(false);
          return;
        }
        if (data && typeof data === "object") {
          const msgs: string[] = [];
          for (const [k, v] of Object.entries(data)) {
            msgs.push(
              Array.isArray(v) ? `${k}: ${v.join(", ")}` : `${k}: ${v}`,
            );
          }
          if (msgs.length) {
            setError(`Failed to save: ${msgs.join("; ")}`);
            setIsLoading(false);
            return;
          }
        }
      }
      setError("Failed to save changes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setShowDeleteConfirm(false);

      const cleanId = (item.id as any).toString().replace(/\/+$/, "");
      await inventoryApi.deleteItem(cleanId);

      // Call the onDelete callback to update parent component
      onDelete(cleanId);
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 404) {
        console.warn("404 received — assuming item was deleted anyway.");
        onDelete(item.id as any as string);
        onClose();
        return;
      }
      console.error("Delete error:", err);
      setError(`Failed to delete item: ${err.message || "Unknown error"}`);
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    if (isNaN(num as number)) return String(price ?? "");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num as number);
  };

  /* ===========================
     UI: Attributes editor blocks
  ============================*/

  const SectionEditor = ({
    title,
    sectionKey,
  }: {
    title: string;
    sectionKey: "coin" | "grade" | "metadata";
  }) => {
    const sectionObj =
      attrs?.[sectionKey] &&
      typeof attrs[sectionKey] === "object" &&
      !Array.isArray(attrs[sectionKey])
        ? (attrs[sectionKey] as AttributesMap)
        : ({} as AttributesMap);

    return (
      <div className="glass-container p-6 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-moss-700">{title}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addSectionField(sectionKey)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add field
          </Button>
        </div>

        {Object.keys(sectionObj).length === 0 && (
          <div className="text-sm text-moss-600 mb-3">
            No fields yet. Add one to start.
          </div>
        )}

        <div className="space-y-2">
          {Object.entries(sectionObj).map(([k, v]) => (
            <div
              key={`${sectionKey}-${k}`}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <Input
                className="col-span-5"
                defaultValue={k}
                onBlur={(e) => {
                  const newKey = e.currentTarget.value.trim();
                  if (newKey && newKey !== k)
                    renameSectionKey(sectionKey, k, newKey);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    (e.currentTarget as HTMLInputElement).blur();
                }}
                placeholder="key"
                autoComplete="off"
                spellCheck="false"
                onFocus={(e) => e.target.select()}
              />
              <AttributeValueInput
                sectionKey={sectionKey}
                fieldKey={k}
                initialValue={String(sectionObj[k] ?? "")}
                onUpdate={(key, value) =>
                  setSectionField(sectionKey, key, value)
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => deleteSectionField(sectionKey, k)}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TopLevelEditor = () => {
    return (
      <div className="glass-container p-6 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-moss-700">
            Other Attributes (top-level)
          </h3>
          <Button variant="outline" size="sm" onClick={addTopLevelPair}>
            <Plus className="h-4 w-4 mr-1" /> Add key
          </Button>
        </div>

        {topLevelPairs.length === 0 && (
          <div className="text-sm text-moss-600 mb-3">
            Add keys like <code>cert_number</code> or <code>lookup_url</code>.
          </div>
        )}

        <div className="space-y-2">
          {topLevelPairs.map(({ key, value }) => (
            <div
              key={`top-${key}`}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <Input
                className="col-span-5"
                defaultValue={key}
                onBlur={(e) => {
                  const newKey = e.currentTarget.value.trim();
                  if (newKey && newKey !== key) setTopLevelKey(key, newKey);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    (e.currentTarget as HTMLInputElement).blur();
                }}
                placeholder="key (e.g., cert_number)"
                autoComplete="off"
                spellCheck="false"
                onFocus={(e) => e.target.select()}
              />
              <Input
                className="col-span-6"
                value={String((attrs as any)[key] ?? value ?? "")}
                onChange={(e) => setTopLevelValue(key, e.target.value)}
                placeholder="value"
                autoComplete="off"
                spellCheck="false"
              />
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => deleteTopLevelKey(key)}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const AttributeValueInput = ({
    sectionKey,
    fieldKey,
    initialValue,
    onUpdate,
  }: {
    sectionKey: "coin" | "grade" | "metadata";
    fieldKey: string;
    initialValue: string;
    onUpdate: (key: string, value: string) => void;
  }) => {
    const [localValue, setLocalValue] = useState(String(initialValue ?? ""));

    useEffect(() => {
      setLocalValue(String(initialValue ?? ""));
    }, [initialValue]);

    return (
      <Input
        className="col-span-6"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onUpdate(fieldKey, localValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        placeholder="value"
        autoComplete="off"
        spellCheck="false"
      />
    );
  };

  const LocationPathDisplay = ({
    siteId,
    roomId,
    shelfId,
    rowId,
    boxId,
    slotId,
    locations,
  }: {
    siteId?: string;
    roomId?: string;
    shelfId?: string;
    rowId?: string;
    boxId?: string;
    slotId?: string;
    locations: NodeOption[];
  }) => {
    const locationPathDisplay = useMemo(
      () =>
        buildLocationPath(
          {
            siteId,
            roomId,
            shelfId,
            rowId,
            boxId,
            slotId,
          },
          locations,
        ) || "—",
      [siteId, roomId, shelfId, rowId, boxId, slotId, locations],
    );

    return (
      <p className="text-xs text-moss-600 mt-2">
        {/* Path: <span className="font-medium">{locationPathDisplay}</span> */}
      </p>
    );
  };

  /* ===========================
     Render
  ============================*/

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="p-0 overflow-hidden max-w-5xl max-h-[90vh] flex flex-col font-urbanist">
          {/* Header */}
          <div className="p-6 bg-vividOrange rounded-t-xl">
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="text-2xl font-urbanist font-semibold text-black">
                {(editedItem as any).name}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Badge className="glass-container bg-white/20 text-[#2b4030] border border-white/10 hover:bg-white/30">
                {categoryIcons[
                  (((editedItem as any).category_name ||
                    (editedItem as any)
                      .category) as keyof typeof categoryIcons) || "Other"
                ] || categoryIcons.Other}
                {(editedItem as any).category_name ||
                  (editedItem as any).category}
              </Badge>
              <Badge
                className={`${
                  statusColors[
                    ((editedItem as any).status as keyof typeof statusColors) ??
                      "in_store"
                  ]
                } text-xs font-medium px-2.5 py-0.5`}
              >
                {(editedItem as any).status}
              </Badge>
              <div className="ml-auto text-black font-medium text-lg">
                {formatPrice((editedItem as any).price)}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Image gallery */}
              <div className="space-y-6">
                <div className="relative group rounded-xl overflow-hidden bg-gradient-to-br from-white/5 to-white/10 border border-white/10">
                  <img
                    src={images[currentImageIndex] || "/placeholder.svg"}
                    alt={`${(editedItem as any).name} ${
                      currentImageIndex % 2 === 0 ? "front" : "back"
                    }`}
                    className="w-full h-[600px] object-contain bg-gray-100"
                  />

                  {images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(
                            Math.max(0, currentImageIndex - 1),
                          );
                        }}
                        aria-label="Prev image"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(
                            Math.min(images.length - 1, currentImageIndex + 1),
                          );
                        }}
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all ${
                            currentImageIndex === idx
                              ? "bg-gold w-6"
                              : "bg-white/50"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(idx);
                          }}
                          aria-label={`Go to image ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Basic info + Details */}
              <div className="space-y-4 bg-white/5 p-4 rounded-xl shadow-md">
                <div>
                  <Label
                    htmlFor="name"
                    className="text-moss-800 mb-1 block text-sm font-medium"
                  >
                    Item Name
                  </Label>
                  <Input
                    id="name"
                    value={(editedItem as any).name}
                    onChange={(e) =>
                      setEditedItem({
                        ...(editedItem as any),
                        name: e.target.value,
                      })
                    }
                    className="luxury-input"
                  />
                </div>

                <div>
                  <Label className="text-moss-800 mb-1 block text-sm font-medium">
                    Status
                  </Label>
                  <Select
                    value={(editedItem as any).status}
                    onValueChange={(value) =>
                      setEditedItem({
                        ...(editedItem as any),
                        status: value as any,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_store">In Store</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="consigned">Consigned</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="ebay">eBay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="description"
                    className="text-moss-800 mb-1 block text-sm font-medium"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="luxury-input"
                    spellCheck="false"
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="price"
                      className="text-moss-800 mb-1 block text-sm font-medium"
                    >
                      Price
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-moss-500">
                        $
                      </span>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={
                          typeof (editedItem as any).price === "string"
                            ? ((editedItem as any).price as string)
                            : String((editedItem as any).price ?? "")
                        }
                        onChange={(e) =>
                          setEditedItem({
                            ...(editedItem as any),
                            price: e.target.value as any,
                          })
                        }
                        className="luxury-input pl-8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label
                      htmlFor="dateAdded"
                      className="text-moss-800 mb-1 block text-sm font-medium"
                    >
                      Date Added
                    </Label>
                    <Input
                      id="dateAdded"
                      value={
                        (editedItem as any).date_added
                          ? new Date(
                              (editedItem as any).date_added,
                            ).toLocaleDateString()
                          : ""
                      }
                      readOnly
                      className="luxury-input"
                    />
                  </div>
                </div>

                {/* Storage location */}
                <div>
                  <Label className="text-moss-800 mb-2 block text-sm font-medium">
                    Storage Location (Site → Room → Shelf → Box → Row → Slot)
                  </Label>

                  {isLoadingLocations ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="animate-spin h-5 w-5 border-2 border-moss-600 rounded-full border-t-transparent"></div>
                      <span className="ml-2 text-moss-600">
                        Loading locations...
                      </span>
                    </div>
                  ) : locationError ? (
                    <div className="text-red-500 text-sm p-2 border border-red-200 rounded bg-red-50">
                      {locationError}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                        {/* Site selection */}
                        <Select
                          value={siteId}
                          onValueChange={(val) => {
                            setSiteId(val);
                            setRoomId(undefined);
                            setShelfId(undefined);
                            setRowId(undefined);
                            setBoxId(undefined);
                            setSlotId(undefined);
                          }}
                        >
                          <SelectTrigger className="luxury-input">
                            <SelectValue placeholder="Site" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter((loc) => loc.type === "site")
                              .map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        {/* Room selection */}
                        <Select
                          value={roomId}
                          onValueChange={(val) => {
                            setRoomId(val);
                            setShelfId(undefined);
                            setRowId(undefined);
                            setBoxId(undefined);
                            setSlotId(undefined);
                          }}
                          disabled={!siteId}
                        >
                          <SelectTrigger className="luxury-input">
                            <SelectValue placeholder="Room" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter(
                                (loc) =>
                                  loc.type === "room" &&
                                  loc.parentId === siteId,
                              )
                              .map((room) => (
                                <SelectItem key={room.id} value={room.id}>
                                  {room.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        {/* Shelf selection */}
                        <Select
                          value={shelfId}
                          onValueChange={(val) => {
                            setShelfId(val);
                            setRowId(undefined);
                            setBoxId(undefined);
                            setSlotId(undefined);
                          }}
                          disabled={!roomId}
                        >
                          <SelectTrigger className="luxury-input">
                            <SelectValue placeholder="Shelf" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter(
                                (loc) =>
                                  loc.type === "shelf" &&
                                  loc.parentId === roomId,
                              )
                              .map((shelf) => (
                                <SelectItem key={shelf.id} value={shelf.id}>
                                  {shelf.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 w-full">
                        {/* Box selection */}
                        <Select
                          value={boxId}
                          onValueChange={(val) => {
                            setBoxId(val);
                            setRowId(undefined);
                            setSlotId(undefined);
                          }}
                          disabled={!shelfId}
                        >
                          <SelectTrigger className="luxury-input">
                            <SelectValue placeholder="Box" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter(
                                (loc) =>
                                  loc.type === "box" &&
                                  loc.parentId === shelfId,
                              )
                              .map((box) => (
                                <SelectItem key={box.id} value={box.id}>
                                  {box.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        {/* Row selection */}
                        <Select
                          value={rowId}
                          onValueChange={(val) => {
                            setRowId(val);
                            setSlotId(undefined);
                          }}
                          disabled={!boxId}
                        >
                          <SelectTrigger className="luxury-input">
                            <SelectValue placeholder="Row" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter(
                                (loc) =>
                                  loc.type === "row" && loc.parentId === boxId,
                              )
                              .map((row) => (
                                <SelectItem key={row.id} value={row.id}>
                                  {row.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        {/* Slot selection */}
                        <Select
                          value={slotId}
                          onValueChange={setSlotId}
                          disabled={!rowId}
                        >
                          <SelectTrigger className="luxury-input">
                            <SelectValue placeholder="Slot" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations
                              .filter(
                                (loc) =>
                                  loc.type === "slot" && loc.parentId === rowId,
                              )
                              .map((slot) => (
                                <SelectItem key={slot.id} value={slot.id}>
                                  {slot.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Memoized path display */}
                      <LocationPathDisplay
                        siteId={siteId}
                        roomId={roomId}
                        shelfId={shelfId}
                        rowId={rowId}
                        boxId={boxId}
                        slotId={slotId}
                        locations={locations}
                      />
                    </>
                  )}
                </div>

                {/* Details panel removed to avoid repeating information */}
              </div>
            </div>

            {/* ================= ATTRIBUTES (GENERIC) ================= */}
            <div className="mt-6 space-y-6">
              <SectionEditor title="Coin Attributes" sectionKey="coin" />
              <SectionEditor title="Grade Attributes" sectionKey="grade" />
              <SectionEditor title="Metadata" sectionKey="metadata" />
              <TopLevelEditor />

              {/* Data Inspector (collapsible) */}
              <div className="glass-container p-6 rounded-xl border border-white/10">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-0 group"
                    >
                      <span className="font-urbanist font-medium text-moss-darker">
                        Data Inspector
                      </span>
                      <ChevronRightIcon className="h-5 w-5 text-moss-500 transition-transform group-data-[state=open]:rotate-90" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <div>
                      <div className="text-xs font-semibold mb-1 text-gray-600">
                        attributes (live)
                      </div>
                      <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-56">
                        {JSON.stringify(attrs, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-semibold mb-1 text-gray-600">
                        last API payload
                      </div>
                      <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-56">
                        {JSON.stringify(lastApiPayload, null, 2)}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Notes */}
              {/* <div className="glass-container p-6 rounded-xl border border-white/10">
                <Label
                  htmlFor="notes"
                  className="text-moss-800 mb-3 block text-sm font-medium"
                >
                  Additional Notes
                </Label>
                <Textarea
                  id="notes"
                  value={(editedItem as any).notes || ""}
                  onChange={(e) =>
                    setEditedItem({
                      ...(editedItem as any),
                      notes: e.target.value,
                    })
                  }
                  rows={6}
                  className="luxury-input"
                  placeholder="Add any additional notes or details about this item..."
                />
                <p className="text-xs text-moss-500 mt-2 text-right">
                  {((editedItem as any).notes || "").length} characters
                </p>
              </div> */}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md mb-3">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 group bg-sky-600 border border-sky-700 text-white hover:bg-sky-700 hover:border-sky-800"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                      Save Changes
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleDeleteClick}
                  variant="outline"
                  className="flex-1 text-red-400 border-red-400/40 hover:bg-red-400/10 hover:border-red-400/60"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </Button>

                <Button
                  variant="outline"
                  className="flex-1 text-purple-400 border-purple-400/40 hover:bg-purple-400/10 hover:border-purple-400/60"
                  onClick={() => {
                    // Close the current modal first
                    onClose();

                    // Navigate to eBay integration page after a small delay to ensure modal closes
                    setTimeout(() => {
                      window.location.href = "/ebay-integration";
                    }, 100);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  List on eBay
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <AlertDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
        >
          <AlertDialogContent className="font-urbanist">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-urbanist font-semibold text-green-600">
                Delete Item
              </AlertDialogTitle>
              <AlertDialogDescription className="text-moss-700">
                Are you sure you want to delete "{(editedItem as any).name}"?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="border border-sky-600/40 text-sky-600 hover:bg-sky-600/10 hover:text-sky-600"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteConfirm();
                }}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
