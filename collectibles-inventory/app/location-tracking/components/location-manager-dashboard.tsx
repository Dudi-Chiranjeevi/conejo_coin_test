"use client";

import { useState, useEffect, useRef } from "react";
import { LocationTree } from "./location-tree";
import { ItemCards } from "./item-cards";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Location, LocationType } from "../types/location";
import type { InventoryItem } from "../../inventory-management/types/inventory";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  MapPin,
  ArrowLeft,
  Lightbulb,
  X,
  LayoutGrid,
  List,
  PanelLeft,
  MousePointerClick,
} from "lucide-react";
import { ParentTreeSelect } from "./ParentTreeSelect";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { UpdateLocationDialog } from "./UpdateLocationDialog";

// Extended Location type with children for tree view
interface LocationWithChildren extends Location {
  children: LocationWithChildren[];
  itemCount?: number;
}

interface LocationManagerDashboardProps {
  clientId: string;
}

export function LocationManagerDashboard({
  clientId,
}: LocationManagerDashboardProps) {
  const [locations, setLocations] = useState<LocationWithChildren[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggingItem, setDraggingItem] = useState<InventoryItem | null>(null);
  const [dragOverLocation, setDragOverLocation] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationType, setNewLocationType] = useState<string>("slot");
  const [newLocationCapacity, setNewLocationCapacity] = useState<number>(1);
  const [newLocationParent, setNewLocationParent] = useState<string | null>(
    null,
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>("");
  const [affectedItemCount, setAffectedItemCount] = useState<number>(0);
  const [showHierarchyHint, setShowHierarchyHint] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [itemView, setItemView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("locHintDismissed");
      if (dismissed === "1") setShowHierarchyHint(false);
    } catch (e) {
      // no-op if sessionStorage not available
    }
  }, []);

  useEffect(() => {
    if (selectedLocation) setSidebarOpen(false);
  }, [selectedLocation]);

  // Centralized refresh: fetch locations and items from API
  const refreshData = async () => {
    try {
      console.log("Fetching data with clientId:", clientId);

      // Fetch all locations with pagination handling
      let allLocations: Location[] = [];
      let nextUrl = `/locations/locations/?client_id=${clientId}`;

      // Keep fetching until we have all pages
      while (nextUrl) {
        console.log("Fetching locations from:", nextUrl);
        const locationsResponse = await api<{
          results: Location[];
          next: string | null;
          count: number;
        }>(nextUrl);
        console.log("Locations API response:", locationsResponse);

        if (locationsResponse && locationsResponse.results) {
          // Add this page's results to our collection
          allLocations = [...allLocations, ...locationsResponse.results];

          // Check if there are more pages
          nextUrl = locationsResponse.next
            ? locationsResponse.next.replace(
                /^http:\/\/localhost:[0-9]+\/api\/v1/,
                "",
              )
            : "";
        } else {
          nextUrl = "";
        }
      }

      // Debug: Log all locations received from API
      console.log(`Received ${allLocations.length} total locations from API`);
      allLocations.forEach((loc) => {
        console.log(
          `Location: ${loc.name} (${loc.id}), Type: ${loc.type}, Parent: ${
            loc.parent || "null"
          }`,
        );
      });

      // Check specifically for Slot 2
      const slot2 = allLocations.find((loc) => loc.name === "Slot 2");
      if (slot2) {
        console.log("Found Slot 2 in API data:", slot2);
      } else {
        console.warn("Slot 2 not found in API data after fetching all pages");
      }

      if (allLocations.length > 0) {
        // Build tree structure from flat list
        const locationTree = buildLocationTree(allLocations);
        setLocations(locationTree);

        // Expand root nodes by default and also their immediate children
        if (locationTree.length > 0) {
          const newExpanded = new Set<string>();
          locationTree.forEach((location) => {
            // Add root node
            newExpanded.add(location.id);

            // Also expand immediate children of root nodes for better visibility
            location.children.forEach((child) => {
              newExpanded.add(child.id);

              // Also expand Box A to show Slot 2
              if (child.name === "Room A1") {
                const shelf1 = child.children.find((c) => c.name === "Shelf 1");
                if (shelf1) {
                  newExpanded.add(shelf1.id);
                  const row1 = shelf1.children.find((c) => c.name === "Row 1");
                  if (row1) {
                    newExpanded.add(row1.id);
                    const boxA = row1.children.find((c) => c.name === "Box A");
                    if (boxA) {
                      newExpanded.add(boxA.id);
                    }
                  }
                }
              }
            });
          });

          setExpandedNodes(newExpanded);
        }
      }

      // Fetch inventory items
      const itemsResponse = await api<{ results: InventoryItem[] }>(
        `/inventory/inventory_items/?client_id=${clientId}`,
      );
      console.log("Items API response:", itemsResponse);

      if (itemsResponse && itemsResponse.results) {
        // Debug: Log all items received from API
        console.log(`Received ${itemsResponse.results.length} items from API`);

        // Check if items have location property that matches any location ID
        const itemsWithLocation = itemsResponse.results.filter((item) => {
          const hasLocation = !!item.location;
          if (hasLocation) {
            const locationExists = allLocations.some(
              (loc) => loc.id === item.location,
            );
            if (!locationExists) {
              console.warn(
                `Item ${item.id} has location ${item.location} which does not exist in locations data`,
              );
            }
            return locationExists;
          }
          return false;
        });

        // Process items to ensure they have the correct location format
        const processedItems = itemsWithLocation.map((item) => {
          // Log each item's location for debugging
          console.log(
            `Item ${item.id} (${item.name}) has location: ${item.location}`,
          );
          return item;
        });

        setItems(processedItems);

        // If we have real items, let's associate them with locations for the item count
        if (processedItems.length > 0 && locations.length > 0) {
          // Update location tree with item counts
          const updatedLocations = [...locations];

          // Count items per location
          const itemCountByLocation: Record<string, number> = {};
          processedItems.forEach((item) => {
            if (item.location) {
              itemCountByLocation[item.location] =
                (itemCountByLocation[item.location] || 0) + 1;
            }
          });

          console.log("Item counts by location:", itemCountByLocation);

          // Update the tree with item counts
          const updateItemCounts = (nodes: LocationWithChildren[]) => {
            nodes.forEach((node) => {
              node.itemCount = itemCountByLocation[node.id] || 0;
              if (node.children && node.children.length > 0) {
                updateItemCounts(node.children);
              }
            });
          };

          updateItemCounts(updatedLocations);
          setLocations(updatedLocations);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(
        "Error loading locations and items. Please check authentication.",
      );
    }
  };

  // Initial load
  useEffect(() => {
    refreshData();
  }, [clientId]);

  // Build tree structure from flat list of locations
  const buildLocationTree = (
    flatLocations: Location[],
  ): LocationWithChildren[] => {
    console.log(
      "Building location tree from",
      flatLocations.length,
      "locations",
    );

    // Create a map for quick lookup
    const locationMap = new Map<string, LocationWithChildren>();

    // Initialize with empty children arrays
    flatLocations.forEach((location) => {
      locationMap.set(location.id, {
        ...location,
        children: [],
        itemCount: 0,
      });
    });

    console.log("Location map created with", locationMap.size, "entries");

    // Build tree structure
    const rootNodes: LocationWithChildren[] = [];

    // First pass: add children to their parents
    flatLocations.forEach((location) => {
      const locationWithChildren = locationMap.get(location.id)!;

      if (location.parent) {
        // Add as child to parent
        const parent = locationMap.get(location.parent);
        if (parent) {
          console.log(
            `Adding ${location.name} (${location.id}) as child to ${parent.name} (${parent.id})`,
          );
          parent.children.push(locationWithChildren);
        } else {
          console.warn(
            `Parent location ${location.parent} not found for ${location.name} (${location.id})`,
          );
          // Don't add to root nodes if parent is specified but not found
          // This prevents incorrect hierarchy
        }
      } else {
        // No parent, add as root
        console.log(`Adding ${location.name} (${location.id}) as root node`);
        rootNodes.push(locationWithChildren);
      }
    });

    // Debug the tree structure
    console.log("Location tree structure:", JSON.stringify(rootNodes, null, 2));

    // Debug: Count all nodes in the tree to verify all locations are included
    let totalNodes = 0;
    const countNodes = (nodes: LocationWithChildren[]) => {
      totalNodes += nodes.length;
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          countNodes(node.children);
        }
      });
    };

    countNodes(rootNodes);
    console.log(
      `Total nodes in tree: ${totalNodes}, Original locations: ${flatLocations.length}`,
    );

    // Debug: Check for specific locations like Slot 2
    const slot2 = flatLocations.find((loc) => loc.name === "Slot 2");
    if (slot2) {
      console.log("Found Slot 2 in original data:", slot2);
      const boxA = flatLocations.find((loc) => loc.id === slot2.parent);
      if (boxA) {
        console.log("Parent of Slot 2 is:", boxA.name, boxA.id);
      }
    } else {
      console.warn("Slot 2 not found in original data");
    }

    return rootNodes;
  };

  // Get items for selected location
  const getItemsForLocation = (locationId: string | null) => {
    if (!locationId) return [];

    console.log("Getting items for location:", locationId);
    console.log("Available items:", items);

    // Guard: only consider items whose location still exists in the current tree
    const allLocationIds = new Set<string>();
    const collectIds = (nodes: LocationWithChildren[]) => {
      nodes.forEach((n) => {
        allLocationIds.add(n.id);
        if (n.children?.length) collectIds(n.children);
      });
    };
    collectIds(locations);
    const validItems = items.filter(
      (it) => it.location && allLocationIds.has(it.location),
    );

    // If current is a slot: show only exact items in that slot
    const locationInfo = findLocationById(locationId, locations);
    if (locationInfo && locationInfo.type === "slot") {
      const slotItems = validItems.filter(
        (item) => item.location === locationId,
      );
      return slotItems;
    }

    // For non-slot nodes: show items only from descendant slots (leaf nodes)
    const descendantSlotIds = getDescendantIdsByType(
      locationId,
      locations,
      "slot",
    );
    console.log("Looking for items in descendant slots:", descendantSlotIds);
    const childLocationItems = validItems.filter(
      (item) => item.location && descendantSlotIds.includes(item.location),
    );
    return childLocationItems;

    // If we're still here, no items were found for this location or its children
    console.log(`No items found for location: ${locationId}`);
    return [];
  };

  // Helper function to get all descendant location IDs
  const getAllDescendantIds = (
    locationId: string,
    locationNodes: LocationWithChildren[],
  ): string[] => {
    const ids: string[] = [];

    const addChildIds = (nodeId: string, nodes: LocationWithChildren[]) => {
      const node = findLocationById(nodeId, nodes);
      if (!node) return;

      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          ids.push(child.id);
          addChildIds(child.id, nodes);
        });
      }
    };

    addChildIds(locationId, locationNodes);
    return ids;
  };

  // Helper: get descendant IDs filtered by location type
  const getDescendantIdsByType = (
    locationId: string,
    locationNodes: LocationWithChildren[],
    type: LocationType,
  ): string[] => {
    const ids: string[] = [];
    const node = findLocationById(locationId, locationNodes);
    if (!node) return ids;
    const traverse = (n: LocationWithChildren) => {
      if (n.children && n.children.length > 0) {
        n.children.forEach((c) => {
          if (c.type === type) ids.push(c.id);
          traverse(c);
        });
      }
    };
    traverse(node);
    return ids;
  };

  // Helper function to find a location by ID in the tree
  const findLocationById = (
    id: string,
    locationNodes: LocationWithChildren[],
  ): LocationWithChildren | null => {
    for (const node of locationNodes) {
      if (node.id === id) {
        return node;
      }

      if (node.children && node.children.length > 0) {
        const found = findLocationById(id, node.children);
        if (found) return found;
      }
    }

    return null;
  };

  // Get location path for breadcrumb
  const getLocationPath = (
    locationId: string,
    nodes: LocationWithChildren[] = locations,
    path: string[] = [],
  ): string[] => {
    for (const node of nodes) {
      if (node.id === locationId) {
        return [...path, node.name];
      }

      if (node.children.length > 0) {
        const childPath = getLocationPath(locationId, node.children, [
          ...path,
          node.name,
        ]);
        if (childPath.length > 0) {
          return childPath;
        }
      }
    }

    return [];
  };

  // Handle location selection
  const handleLocationSelect = (locationId: string) => {
    setSelectedLocation(locationId);
    setBreadcrumb(getLocationPath(locationId));
  };

  // Handle tree node expand/collapse
  const handleToggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Handle drag start
  const handleDragStart = (item: InventoryItem) => {
    setDraggingItem(item);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggingItem(null);
    setDragOverLocation(null);
  };

  // Handle drag over location
  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    locationId: string,
  ) => {
    e.preventDefault();
    setDragOverLocation(locationId);
  };

  // Handle drop on location
  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetLocationId: string,
  ) => {
    e.preventDefault();

    if (!draggingItem) return;

    // Check if target is valid
    if (!isValidDropTarget(targetLocationId)) {
      toast.error("Cannot drop item in this location type");
      return;
    }

    try {
      // Update item location in API
      const updatedItem = await api<InventoryItem>(
        `/inventory/inventory_items/${draggingItem.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            location: targetLocationId,
          }),
        },
      );

      // Update local state
      const updatedItems = items.map((item) =>
        item.id === updatedItem.id ? updatedItem : item,
      );

      setItems(updatedItems);
      updateItemCounts(updatedItems);

      toast.success(`${updatedItem.name} moved successfully`);
    } catch (error) {
      console.error("Error moving item:", error);
      toast.error("Failed to move item");
    }

    setDraggingItem(null);
    setDragOverLocation(null);
  };

  // Check if location is valid drop target
  const isValidDropTarget = (locationId: string): boolean => {
    // Only allow dropping on row-type locations
    const findLocation = (
      nodes: LocationWithChildren[],
    ): LocationWithChildren | null => {
      for (const node of nodes) {
        if (node.id === locationId) {
          return node;
        }

        if (node.children.length > 0) {
          const found = findLocation(node.children);
          if (found) return found;
        }
      }

      return null;
    };

    const location = findLocation(locations);
    return location !== null;
  };

  // Update item counts in location tree
  const updateItemCounts = (updatedItems: InventoryItem[]) => {
    const updateCounts = (node: LocationWithChildren): LocationWithChildren => {
      const itemsInLocation = updatedItems.filter(
        (item) => item.location === node.id,
      );

      const updatedChildren = node.children.map(updateCounts);

      return {
        ...node,
        itemCount: itemsInLocation.length,
        children: updatedChildren,
      };
    };

    const updatedLocations = locations.map(updateCounts);
    setLocations(updatedLocations);
  };

  // Handle add location
  const handleAddLocation = (newLocation: Location) => {
    // Add new location to the tree
    const updatedLocations = [...locations];

    // Find parent location if exists
    if (newLocation.parent) {
      const findAndAddToParent = (nodes: LocationWithChildren[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === newLocation.parent) {
            // Add to parent's children
            nodes[i].children = [
              ...nodes[i].children,
              { ...newLocation, children: [] },
            ];
            return true;
          }

          // Check children recursively
          if (
            nodes[i].children.length > 0 &&
            findAndAddToParent(nodes[i].children)
          ) {
            return true;
          }
        }
        return false;
      };

      findAndAddToParent(updatedLocations);
    } else {
      // Add as root node
      updatedLocations.push({ ...newLocation, children: [] });
    }

    setLocations(updatedLocations);

    // Select the new location
    setSelectedLocation(newLocation.id);

    // Update breadcrumb
    setBreadcrumb(getLocationPath(newLocation.id));
  };

  // Handle add location form submission
  const handleAddLocationSubmit = async () => {
    if (!newLocationName.trim()) {
      toast.error("Please enter a location name");
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading("Creating new location...");

    try {
      // Create location data object (always include parent key)
      const locationData: any = {
        name: newLocationName,
        type: newLocationType,
        client_id: clientId,
        client: clientId,
        parent: null,
      };

      if (newLocationType !== "site" && newLocationParent) {
        locationData.parent = newLocationParent;
      }

      if (newLocationCapacity && newLocationCapacity > 0) {
        locationData.capacity = newLocationCapacity;
      }

      console.log("Creating location with data:", locationData);
      console.log("Request payload:", JSON.stringify(locationData, null, 2));

      // Send API request to create location
      console.log("Using api utility for consistent endpoint handling");
      const newLocation = await api<Location>("/locations/locations/", {
        method: "POST",
        body: JSON.stringify(locationData),
      });

      console.log("API call successful, received location:", newLocation);

      // Add the new location to our state
      handleAddLocation(newLocation);

      // Auto-expand the parent node if it exists
      if (newLocationParent) {
        setExpandedNodes((prev) => new Set([...prev, newLocationParent]));
      }

      toast.success(`${newLocation.name} has been added to the location tree.`);

      // Reset form state
      setNewLocationName("");
      setNewLocationType("slot"); // Default to slot since that's most commonly added
      setNewLocationCapacity(1); // Reset capacity
      setNewLocationParent(null); // Reset parent
      setShowAddModal(false); // Close the modal
    } catch (error: any) {
      // Handle errors
      console.error("Error creating location:", error);

      // Try to parse the error message for more details
      try {
        const errorMessage = error.message;
        const match = errorMessage.match(/HTTP 400 at \/locations\/ — (.+)/);
        if (match && match[1]) {
          console.error("Parsed error details:", match[1]);
          try {
            const errorJson = JSON.parse(match[1]);
            console.error("Error JSON:", errorJson);

            // Show more specific error message
            if (typeof errorJson === "object") {
              const errorDetails = Object.entries(errorJson)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ");
              toast.error(`Validation error: ${errorDetails}`);
            } else {
              toast.error(`Failed to create location: ${error.message}`);
            }
          } catch (e) {
            console.error("Could not parse error JSON:", e);
            toast.error(`Failed to create location: ${error.message}`);
          }
        } else {
          toast.error(`Failed to create location: ${error.message}`);
        }
      } catch (parseError) {
        console.error("Error parsing error message:", parseError);
        toast.error(`Failed to create location: ${error.message}`);
      }
    } finally {
      // Clear loading toast
      toast.dismiss(loadingToast);
    }
  };

  // Get total items in current location
  const currentLocationItems = getItemsForLocation(selectedLocation);
  const totalItems = currentLocationItems.length;

  const renderItems = () => {
    if (!selectedLocation) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 px-6">
          <MousePointerClick className="h-10 w-10 text-sky-600" />
          <p className="mt-5 text-center text-lg font-medium text-slate-900">
            Select a location on the left panel to display inventory items and
            actions.
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            Tip: Use the search box to jump quickly using shortcuts like "WH1".
          </p>
        </div>
      );
    }

    if (itemView === "cards") {
      return (
        <ItemCards
          items={currentLocationItems}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          draggingItem={draggingItem}
        />
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[680px] w-full text-sm">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-700 px-4 py-3">
                  Item
                </th>
                <th className="text-left font-medium text-slate-700 px-4 py-3">
                  Price
                </th>
                <th className="text-left font-medium text-slate-700 px-4 py-3">
                  Certificate / ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentLocationItems.map((item: InventoryItem) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.price
                      ? `$${Number(item.price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.identification_number || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const buildAbbrMap = (roots: LocationWithChildren[]) => {
    const m = new Map<string, string>();
    const walk = (arr: LocationWithChildren[]) => {
      for (const node of arr) {
        const name = (node.name || "").toLowerCase();
        const words = name.split(/[\s\-_]+/).filter(Boolean);
        if (words.length) {
          const firstLetters = words.map((w) => w[0]).join("");
          if (firstLetters.length >= 2) m.set(firstLetters, name);
          const firstTwo = words.map((w) => w.slice(0, 2)).join("");
          if (firstTwo.length >= 4) m.set(firstTwo, name);
          for (const w of words) {
            if (w.length >= 2) m.set(w.slice(0, 2), w);
            if (w.length >= 3) m.set(w.slice(0, 3), w);
          }
        }
        if (node.children && node.children.length) walk(node.children as any);
      }
    };
    walk(roots);
    if (!m.has("sh")) m.set("sh", "shelf");
    if (!m.has("sl")) m.set("sl", "slot");
    if (!m.has("rm")) m.set("rm", "room");
    if (!m.has("mv")) m.set("mv", "main vault");
    return m;
  };

  const expandPatterns = (token: string, abbr: Map<string, string>) => {
    const t = token.toLowerCase();
    const out = new Set<string>([t]);
    if (abbr.has(t)) out.add(abbr.get(t)!);
    const m = t.match(/^([a-z]+)(\d+[a-z]?)$/i);
    if (m) {
      const p = m[1];
      const num = m[2];
      out.add(`${p}${num}`);
      out.add(`${p} ${num}`);
      if (abbr.has(p)) {
        const full = abbr.get(p)!;
        out.add(`${full}${num}`);
        out.add(`${full} ${num}`);
      }
    }
    return Array.from(out);
  };

  const filterLocationTree = (
    nodes: LocationWithChildren[],
    query: string,
  ): LocationWithChildren[] => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    const abbr = buildAbbrMap(locations);
    const tokens = q.split(/\s+/).filter(Boolean);
    const recur = (list: LocationWithChildren[]): LocationWithChildren[] =>
      list
        .map((n) => {
          const childMatches = n.children ? recur(n.children) : [];
          const name = (n.name || "").toLowerCase();
          const path = (n as any).path
            ? String((n as any).path).toLowerCase()
            : name;
          const arrow = path.replace(/\s*>\s*/g, " → ");
          const continuous = path.replace(/\s+/g, "");
          const searchable = `${name} ${path} ${arrow} ${continuous}`;
          const ok = tokens.every((tok) =>
            expandPatterns(tok, abbr).some((p) => searchable.includes(p)),
          );
          if (ok || childMatches.length) {
            return { ...n, children: childMatches } as LocationWithChildren;
          }
          return null;
        })
        .filter(Boolean) as LocationWithChildren[];
    return recur(nodes);
  };

  const filteredLocations = filterLocationTree(locations, searchTerm || "");

  const findFirstMatch = (
    nodes: LocationWithChildren[],
    query: string,
  ): LocationWithChildren | null => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const abbr = buildAbbrMap(locations);
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = (text: string) =>
      tokens.every((tok) =>
        expandPatterns(tok, abbr).some((p) => text.toLowerCase().includes(p)),
      );
    const stack: LocationWithChildren[] = [...nodes];
    while (stack.length) {
      const node = stack.shift()!;
      const name = (node.name || "").toLowerCase();
      const path = (node as any).path
        ? String((node as any).path).toLowerCase()
        : name;
      if (matches(name) || matches(path)) return node;
      if (node.children?.length) stack.unshift(...node.children);
    }
    return null;
  };

  const getAncestorIds = (
    targetId: string,
    roots: LocationWithChildren[],
  ): string[] => {
    const parents = new Map<string, string | null>();
    const walk = (arr: LocationWithChildren[], parent: string | null) => {
      for (const n of arr) {
        parents.set(n.id, parent);
        if (n.children?.length) walk(n.children, n.id);
      }
    };
    walk(roots, null);
    const chain: string[] = [];
    let curr: string | null = targetId;
    while (curr) {
      chain.push(curr);
      curr = parents.get(curr) || null;
    }
    return chain.reverse();
  };

  useEffect(() => {
    if (!searchTerm.trim()) return;
    const match = findFirstMatch(locations, searchTerm);
    if (match) {
      const ids = getAncestorIds(match.id, locations);
      setExpandedNodes((prev) => new Set([...prev, ...ids]));
    }
  }, [searchTerm, locations]);

  const [locSuggestions, setLocSuggestions] = useState<
    { id: string; name: string; path: string }[]
  >([]);
  const [locSuggestOpen, setLocSuggestOpen] = useState(false);
  const [locHighlight, setLocHighlight] = useState(0);
  const locSuggestRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!locSuggestRef.current) return;
      const target = e.target as Node;
      if (!locSuggestRef.current.contains(target)) {
        setLocSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler as any);
    };
  }, []);

  const flattenMatches = (
    nodes: LocationWithChildren[],
  ): { id: string; name: string; path: string }[] => {
    const out: { id: string; name: string; path: string }[] = [];
    const stack = [...nodes];
    while (stack.length) {
      const n = stack.shift()!;
      out.push({ id: n.id, name: n.name, path: (n as any).path || n.name });
      if (n.children?.length) stack.unshift(...n.children);
    }
    return out;
  };

  useEffect(() => {
    const q = searchTerm.trim();
    if (!q) {
      setLocSuggestions([]);
      setLocSuggestOpen(false);
      setLocHighlight(0);
      return;
    }
    const list = flattenMatches(filteredLocations).slice(0, 10);
    setLocSuggestions(list);
    setLocSuggestOpen(list.length > 0);
    setLocHighlight(0);
  }, [searchTerm, filteredLocations]);

  const SidebarContent = (
    <div className="relative h-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-left bg-no-repeat opacity-70"
        style={{ backgroundImage: "url('/bg-bw.png')" }}
      />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div className="relative z-10 h-full overflow-y-auto">
        <div className="p-4 border-b border-slate-200 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Locations</h2>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  setNewLocationParent(selectedLocation);
                  setShowAddModal(true);
                }}
                className="bg-sky-500 hover:bg-sky-600 text-white shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Location
              </Button>
            </div>
          </div>

          <div className="relative" ref={locSuggestRef}>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search locations or use shortcuts (e.g., 'WH1')"
              className="pl-9 pr-9 h-9 rounded-full bg-white/70 backdrop-blur-sm border-slate-200 focus-visible:ring-sky-300 transition-all"
              value={searchTerm}
              onKeyDown={(e) => {
                if (!locSuggestOpen || locSuggestions.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setLocHighlight((h) => (h + 1) % locSuggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setLocHighlight(
                    (h) =>
                      (h - 1 + locSuggestions.length) % locSuggestions.length,
                  );
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const s = locSuggestions[locHighlight];
                  if (s) {
                    setSelectedLocation(s.id);
                    const ids = getAncestorIds(s.id, locations);
                    setExpandedNodes((prev) => new Set([...prev, ...ids]));
                    setLocSuggestOpen(false);
                  }
                } else if (e.key === "Escape") {
                  setLocSuggestOpen(false);
                }
              }}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search locations"
            />
            {locSuggestOpen && locSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-sm max-h-64 overflow-auto">
                {locSuggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseEnter={() => setLocHighlight(idx)}
                    onClick={() => {
                      setSelectedLocation(s.id);
                      const ids = getAncestorIds(s.id, locations);
                      setExpandedNodes((prev) => new Set([...prev, ...ids]));
                      setLocSuggestOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm ${
                      idx === locHighlight ? "bg-slate-100" : "bg-white"
                    }`}
                  >
                    <div className="font-medium text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {s.path}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <LocationTree
            locations={filteredLocations}
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            expandedNodes={expandedNodes}
            onToggleExpand={handleToggleExpand}
            dragOverLocation={dragOverLocation}
            isValidDropTarget={
              dragOverLocation ? isValidDropTarget(dragOverLocation) : false
            }
            onUpdateLocation={(id) => {
              setUpdateTargetId(id);
              setShowUpdateDialog(true);
            }}
            onDeleteLocation={(id) => {
              const ids = [id, ...getAllDescendantIds(id, locations)];
              const count = items.filter(
                (it) => it.location && ids.includes(it.location),
              ).length;
              const node = findLocationById(id, locations);
              setDeleteTargetId(id);
              setDeleteTargetName(node?.name || "this location");
              setAffectedItemCount(count);
              setShowDeleteDialog(true);
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="hidden md:block relative w-1/3 border-r border-slate-200 overflow-hidden">
        {SidebarContent}
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close locations panel"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[360px] bg-white shadow-2xl">
            <div className="h-12 flex items-center justify-between px-4 border-b border-slate-200">
              <div className="sr-only">Locations</div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {SidebarContent}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            {/* Back Button and Breadcrumb */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open locations panel"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="text-sky-600 hover:text-sky-700 transition-colors mr-2"
                aria-label="Back"
                type="button"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <MapPin className="h-4 w-4 text-gray-500 mr-2" />
              {breadcrumb.length > 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {breadcrumb.map((crumb, index) => (
                    <span key={index}>
                      {index > 0 && (
                        <span className="mx-2 text-slate-300">/</span>
                      )}
                      <span
                        className={
                          index === breadcrumb.length - 1
                            ? "font-medium text-slate-900"
                            : ""
                        }
                      >
                        {crumb}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-500">
                  No location selected
                </span>
              )}
            </div>

            {/* Item count */}
            <div className="flex items-center gap-2">
              {selectedLocation && (
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-800 border-slate-200 shadow-sm"
                >
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </Badge>
              )}
              <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  aria-label="Card view"
                  onClick={() => setItemView("cards")}
                  className={`h-9 px-3 flex items-center gap-2 text-sm ${
                    itemView === "cards"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  onClick={() => setItemView("list")}
                  className={`h-9 px-3 flex items-center gap-2 text-sm border-l border-slate-200 ${
                    itemView === "list"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>
          </div>
          {/* Hierarchy helper moved below main header - subtle caption, dismissible */}
          {showHierarchyHint && (
            <div className="mt-2 text-xs text-slate-600 flex items-start justify-between">
              <div className="flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-sky-500" />
                <span>
                  Hierarchy:{" "}
                  <span className="font-medium">
                    Site → Room → Shelf → Box → Row → Slot
                  </span>
                </span>
              </div>
              <button
                aria-label="Dismiss hierarchy hint"
                className="ml-3 text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setShowHierarchyHint(false);
                  try {
                    sessionStorage.setItem("locHintDismissed", "1");
                  } catch {}
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-[radial-gradient(1200px_400px_at_80%_-200px,rgba(59,130,246,0.06),transparent)]">
          {renderItems()}
        </div>
      </div>

      {/* Add Location Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md backdrop-blur-sm">
          <DialogHeader>
            <div className="h-1.5 w-full bg-sky-500/70 rounded-t-md" />
            <DialogTitle className="text-slate-900">
              Add New Location
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="name"
                className="text-right font-medium text-gray-800"
              >
                Name
              </label>
              <Input
                id="name"
                placeholder="Location name"
                className="col-span-3 border-gray-200 focus-visible:ring-gray-500"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="type"
                className="text-right font-medium text-gray-800"
              >
                Type
              </label>
              <select
                id="type"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={newLocationType}
                onChange={(e) => setNewLocationType(e.target.value)}
              >
                <option value="site">Site</option>
                <option value="room">Room</option>
                <option value="shelf">Shelf</option>
                <option value="box">Box</option>
                <option value="row">Row</option>
                <option value="slot">Slot</option>
              </select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="capacity"
                className="text-right font-medium text-gray-800"
              >
                Capacity
              </label>
              <Input
                id="capacity"
                type="number"
                min="0"
                placeholder="Location capacity"
                className="col-span-3 border-gray-200 focus-visible:ring-gray-500"
                value={newLocationCapacity || ""}
                onChange={(e) =>
                  setNewLocationCapacity(parseInt(e.target.value) || 0)
                }
              />
              <div className="col-span-4 col-start-2 text-xs text-gray-500">
                Optional. Mainly used for box/row/slot types.
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="parent"
                className="text-right font-medium text-gray-800"
              >
                Parent
              </label>
              <div className="col-span-3">
                {(() => {
                  const roots = locations.map((n) => ({
                    id: n.id,
                    name: n.name,
                    type: n.type as LocationType,
                    children: n.children?.map((c) => ({
                      id: c.id,
                      name: c.name,
                      type: c.type as LocationType,
                      children: c.children as any,
                    })) as any,
                  }));
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
                      value={newLocationParent}
                      onChange={setNewLocationParent}
                      roots={roots as any}
                      allowedParents={allowedParents}
                      currentType={newLocationType as unknown as LocationType}
                      placeholder={"No parent (root location)"}
                    />
                  );
                })()}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="border-gray-200 text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLocationSubmit}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              Add Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Location Dialog */}
      {showUpdateDialog && updateTargetId && (
        <UpdateLocationDialog
          open={showUpdateDialog}
          onOpenChange={(o) => setShowUpdateDialog(o)}
          location={{
            id: updateTargetId,
            name: findLocationById(updateTargetId, locations)?.name || "",
            type:
              (findLocationById(updateTargetId, locations)?.type as any) ||
              "room",
            parent_id:
              findLocationById(updateTargetId, locations)?.parent || null,
            capacity:
              findLocationById(updateTargetId, locations)?.capacity || null,
            path: findLocationById(updateTargetId, locations)?.path || "",
            children:
              (findLocationById(updateTargetId, locations)?.children as any) ||
              [],
          }}
          onUpdated={async () => {
            toast.success(`Location updated.`);
            // refresh locations and items
            await refreshData();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>
              {affectedItemCount > 0
                ? `${affectedItemCount} item${
                    affectedItemCount === 1 ? "" : "s"
                  } will be unassigned from this location.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTargetId) return;
                try {
                  // Unassign items under this location subtree
                  const ids = [
                    deleteTargetId,
                    ...getAllDescendantIds(deleteTargetId, locations),
                  ];
                  const affected = items.filter(
                    (it) => it.location && ids.includes(it.location),
                  );
                  await Promise.all(
                    affected.map((it) =>
                      api(`/inventory/inventory_items/${it.id}/`, {
                        method: "PATCH",
                        body: JSON.stringify({ location: null }),
                      }),
                    ),
                  );

                  // Delete the location (server may return 204 No Content)
                  try {
                    await api(`/locations/locations/${deleteTargetId}/`, {
                      method: "DELETE",
                    });
                  } catch (err: any) {
                    // Some backends return HTML/empty bodies causing JSON parse errors in api utility
                    const msg = String(err?.message || "");
                    const likelyNoContent =
                      msg.includes("Expected JSON") ||
                      msg.includes("Unexpected token") ||
                      msg.includes("text/html");
                    if (!likelyNoContent) {
                      throw err;
                    }
                  }

                  toast.success(
                    `Location "${deleteTargetName}" deleted. ${
                      affected.length
                    } item${
                      affected.length === 1 ? "" : "s"
                    } are now unassigned.`,
                  );
                  setShowDeleteDialog(false);
                  setDeleteTargetId(null);
                  setDeleteTargetName("");
                  setAffectedItemCount(0);
                  // Refresh UI
                  await refreshData();
                } catch (err: any) {
                  console.error("Error deleting location:", err);
                  toast.error(err?.message || "Failed to delete location");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
