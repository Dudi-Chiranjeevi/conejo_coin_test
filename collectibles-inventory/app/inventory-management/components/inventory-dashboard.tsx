"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/context/auth-context";
import {
  ArrowLeft,
  Search,
  Plus,
  Upload,
  Edit,
  Trash2,
  ExternalLink,
  Star,
  Coins,
  Gem,
  X,
  AlertCircle,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  type InventoryItem,
  mockItems,
  statusMapping,
} from "../types/inventory";
import { inventoryApi } from "../services/api";
import { ItemDetailModal } from "./item-detail-modal";
import { AddItemWizard } from "./add-item-wizard";
import { BulkUploadInterface } from "./bulk-upload-interface";
import { api } from "@/lib/api";

/* ---------------------------------- Constants ---------------------------------- */

const statusOptions = [
  { value: "All", label: "All Status" },
  { value: "in_store", label: "In Store" },
  { value: "in_transit", label: "In Transit" },
  { value: "consigned", label: "Consigned" },
  { value: "sold", label: "Sold" },
  { value: "ebay", label: "eBay" },
];

const statusColors: Record<string, string> = {
  "In Store": "bg-goldYellow/20 text-ink border border-goldYellow/40",
  "In Transit": "bg-vividOrange/20 text-ink border border-vividOrange/40",
  Consigned: "bg-sky-100 text-sky-700 border border-sky-200",
  Sold: "bg-green-100 text-green-700 border border-green-200",
  eBay: "bg-purple-200/30 text-purple-700 border border-purple-300/40",
  in_store: "bg-goldYellow/20 text-ink border border-goldYellow/40",
  in_transit: "bg-vividOrange/20 text-ink border border-vividOrange/40",
  consigned: "bg-sky-100 text-sky-700 border border-sky-200",
  sold: "bg-green-100 text-green-700 border border-green-200",
  ebay: "bg-purple-200/30 text-purple-700 border border-purple-300/40",
};

/* ---------------------------------- Types ---------------------------------- */

interface FilterState {
  dateAdded: {
    startDate: string;
    endDate: string;
  };
  certificateNumber: string;
  status: string;
  price: {
    min: string;
    max: string;
  };
  name: string;
  location: string;
  locationHierarchy: string[];
}

interface ActiveFilter {
  type: string;
  value: string;
  displayValue: string;
}

interface LocationNode {
  id: string;
  name: string;
  type: string;
  children?: LocationNode[];
}

/* ---------------------------------- LocationDropdown Component ---------------------------------- */

interface LocationDropdownProps {
  locations: LocationNode[];
  selectedLocation: string;
  onLocationChange: (
    locationId: string | null,
    locationHierarchy: string[],
  ) => void;
  getLocationDisplayName: (locationId: string) => string;
  getLocationPath: (
    locationId: string,
    nodes?: LocationNode[],
    path?: string[],
  ) => string[];
  getAllDescendantIds: (node: LocationNode) => string[];
}

const LocationDropdown = ({
  locations,
  selectedLocation,
  onLocationChange,
  getLocationDisplayName,
  getLocationPath,
  getAllDescendantIds,
}: LocationDropdownProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [filteredLocations, setFilteredLocations] =
    useState<LocationNode[]>(locations);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Find exact matching node based on search query
  // Find exact matching node based on search query
  // Find exact matching node based on search query
  // Dynamic abbreviation mapping function
  const generateAbbreviationMappings = useCallback(() => {
    const mappings = new Map();

    // Function to extract abbreviations from all location names
    const extractAbbreviations = (nodes: LocationNode[]) => {
      for (const node of nodes) {
        const name = node.name.toLowerCase();

        // Split by multiple separators: spaces, hyphens, underscores
        const words = name.split(/[\s\-_]+/).filter((word) => word.length > 0);

        if (words.length >= 1) {
          // Changed from >1 to >=1 to handle single words too
          // First letters abbreviation (e.g., "Westlake-Store" -> "ws")
          const firstLetters = words.map((word) => word.charAt(0)).join("");
          if (firstLetters.length >= 2) {
            mappings.set(firstLetters, name);
            console.log(`🔤 [ABBR GENERATED] ${firstLetters} -> ${name}`);
          }

          // First two letters abbreviation (e.g., "Westlake-Store" -> "westo")
          const firstTwoLetters = words
            .map((word) => word.substring(0, 2))
            .join("");
          if (firstTwoLetters.length >= 4) {
            mappings.set(firstTwoLetters, name);
            console.log(`🔤 [ABBR GENERATED] ${firstTwoLetters} -> ${name}`);
          }

          // Also generate abbreviations for individual parts
          words.forEach((word, index) => {
            if (word.length >= 2) {
              // First 2-3 characters of each word
              mappings.set(word.substring(0, 2), word);
              if (word.length >= 3) {
                mappings.set(word.substring(0, 3), word);
              }

              // For compound words, also try splitting further
              if (word.includes("-") || word.includes("_")) {
                const subWords = word.split(/[\-_]/);
                if (subWords.length > 1) {
                  const subFirstLetters = subWords
                    .map((w) => w.charAt(0))
                    .join("");
                  mappings.set(subFirstLetters, word);
                }
              }
            }
          });
        }

        // Common word mappings (enhanced)
        words.forEach((word) => {
          if (word.length >= 2) {
            // Map common location terms to their abbreviations
            if (word.includes("shelf") || word === "sh")
              mappings.set("sh", "shelf");
            if (word.includes("slot") || word === "sl")
              mappings.set("sl", "slot");
            if (word.includes("row") || word === "r") mappings.set("r", "row");
            if (word.includes("bin") || word === "b") mappings.set("b", "bin");
            if (word.includes("vault") || word === "v")
              mappings.set("v", "vault");
            if (word.includes("main") || word === "m")
              mappings.set("m", "main");
            if (word.includes("room") || word === "rm")
              mappings.set("rm", "room");
            if (word.includes("cabinet") || word === "c")
              mappings.set("c", "cabinet");
            if (word.includes("drawer") || word === "d")
              mappings.set("d", "drawer");
            if (word.includes("section") || word === "s")
              mappings.set("s", "section");
            if (word.includes("store") || word === "st")
              mappings.set("st", "store");
            if (word.includes("westlake") || word === "w")
              mappings.set("w", "westlake");
          }
        });

        // Process children
        if (node.children) {
          extractAbbreviations(node.children);
        }
      }
    };

    extractAbbreviations(locations);

    // Add common location terms if they don't exist
    const commonTerms = {
      sh: "shelf",
      sl: "slot",
      mv: "main vault",
      st: "store",
    };

    Object.entries(commonTerms).forEach(([abbr, full]) => {
      if (!mappings.has(abbr)) {
        mappings.set(abbr, full);
      }
    });

    console.log(
      "🔤 [FINAL ABBREVIATION MAPPINGS]",
      Array.from(mappings.entries()),
    );
    return mappings;
  }, [locations]);
  // Find exact matching node based on search query
  const findExactMatchingNode = useCallback(
    (query: string): LocationNode | null => {
      if (!query.trim()) return null;

      const searchTerm = query.toLowerCase().trim();
      const abbreviationMappings = generateAbbreviationMappings();

      // Expand search patterns (keeps your abbreviation logic + number suffix handling)
      const expandSearchPatterns = (searchPart: string): string[] => {
        const patterns = [searchPart];

        const trimmed = searchPart.toLowerCase().trim();
        if (trimmed.length >= 2) {
          for (const [abbr, full] of abbreviationMappings.entries()) {
            if (trimmed === abbr) {
              patterns.push(full as string);
            }
          }
        }

        // Number pattern handling like "sh1" => ["sh1", "sh 1", "shelf 1", "shelf1"]
        const numberMatch = trimmed.match(/^([a-z]+)(\d+[a-z]?)$/i);
        if (numberMatch) {
          const [, prefix, number] = numberMatch;
          patterns.push(`${prefix} ${number}`, `${prefix}${number}`);

          if (prefix.length >= 2) {
            for (const [abbr, full] of abbreviationMappings.entries()) {
              if (prefix === abbr) {
                patterns.push(`${full} ${number}`, `${full}${number}`);
              }
            }
          }
        }

        return Array.from(new Set(patterns));
      };

      // Normalize path helpers
      const pathFormsFor = (fullPath: string[]) => {
        const parts = fullPath.map((p) => p.toLowerCase());
        const arrow = parts.join(" → ");
        const spaceJoined = parts.join(" ");
        const continuous = parts.join("");
        return { parts, arrow, spaceJoined, continuous };
      };

      // Search through nodes recursively
      const searchNodes = (nodeList: LocationNode[]): LocationNode | null => {
        for (const node of nodeList) {
          const fullPath = getLocationPath(node.id); // array of names
          const {
            parts: individualPathParts,
            arrow: fullPathArrow,
            spaceJoined: fullPathSpace,
            continuous: fullPathNoSpace,
          } = pathFormsFor(fullPath);

          // Build a combined searchable string that covers common user inputs
          const combinedSearchable = [
            fullPathArrow,
            fullPathSpace,
            fullPathNoSpace,
            ...individualPathParts,
          ].join(" "); // all lowercased

          let matches = false;

          if (searchTerm.includes(" ")) {
            // Multi-word query. Split and require ordered matches in path parts (but allow matching across different path forms)
            const queryParts = searchTerm.split(/\s+/).filter(Boolean);
            const searchPatternsPerPart = queryParts.map((part) =>
              expandSearchPatterns(part),
            );

            // try simple substring match against combined forms first for quick match (handles "main vault" matching "main vault" or "main → vault")
            if (
              searchPatternsPerPart.every((patterns) =>
                patterns.some((p) => combinedSearchable.includes(p)),
              )
            ) {
              matches = true;
            } else {
              // fallback: require ordered per-segment matching across path parts
              let currentIndex = 0;
              let allFound = true;
              for (const patterns of searchPatternsPerPart) {
                let foundPart = false;
                for (
                  let i = currentIndex;
                  i < individualPathParts.length;
                  i++
                ) {
                  const pathPart = individualPathParts[i];
                  if (patterns.some((p) => pathPart.includes(p))) {
                    foundPart = true;
                    currentIndex = i + 1;
                    break;
                  }
                }
                if (!foundPart) {
                  allFound = false;
                  break;
                }
              }
              matches = allFound;
            }
          } else {
            // Single-word query: expand patterns and match against any of the path forms or individual parts
            const patterns = expandSearchPatterns(searchTerm);
            matches = patterns.some(
              (pattern) =>
                fullPathArrow.includes(pattern) ||
                fullPathSpace.includes(pattern) ||
                fullPathNoSpace.includes(pattern) ||
                individualPathParts.some((part) => part.includes(pattern)),
            );
          }

          if (matches) {
            console.log("🎯 [MATCH FOUND]", {
              searchTerm,
              nodeName: node.name,
              fullPath: fullPath.join(" → "),
              abbreviationMappings: Array.from(abbreviationMappings.entries()),
            });
            return node;
          }

          if (node.children) {
            const foundInChildren = searchNodes(node.children);
            if (foundInChildren) return foundInChildren;
          }
        }
        return null;
      };

      const result = searchNodes(locations);
      console.log("🔍 [SEARCH RESULT]", {
        searchTerm,
        found: !!result,
        result: result?.name,
        dynamicAbbreviations: Array.from(abbreviationMappings.entries()),
      });
      return result;
    },
    [locations, getLocationPath, generateAbbreviationMappings],
  );

  // Update filtered locations when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLocations(locations);
      setExpandedNodes(new Set());
      return;
    }

    const matchingNode = findExactMatchingNode(searchQuery);

    if (matchingNode) {
      // Auto-expand the matching node
      setExpandedNodes(new Set([matchingNode.id]));
      // Set ONLY the matching node
      setFilteredLocations([matchingNode]);
    } else {
      setFilteredLocations([]);
      setExpandedNodes(new Set());
    }
  }, [searchQuery, locations, findExactMatchingNode]);

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return newExpanded;
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        locationDropdownRef.current &&
        !locationDropdownRef.current.contains(event.target as Node)
      ) {
        setShowLocationDropdown(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderLocationTree = (nodes: LocationNode[], depth = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedLocation === node.id;
      const indent = depth * 20;
      const fullPath = getLocationPath(node.id);
      const fullPathLower = fullPath.map((p) => p.toLowerCase()).join(" ");

      // Check if this is the exact match for the search
      const trimmedQuery = searchQuery.trim().toLowerCase();

      return (
        <div key={node.id}>
          <div
            className={`flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors ${
              isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
            }`}
            style={{ paddingLeft: `${indent + 12}px` }}
            onClick={() => {
              console.log("📍 [LOCATION SELECTED]", {
                locationId: node.id,
                locationName: node.name,
                fullPath: fullPath.join(" → "),
              });

              const allLocationIds = getAllDescendantIds(node);
              onLocationChange(node.id, allLocationIds);
              setShowLocationDropdown(false);
              setSearchQuery("");
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="mr-2 text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-200"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    isExpanded ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
            ) : (
              <div className="w-5 mr-2" />
            )}

            <div className="flex-1 min-w-0">
              <div
                className={`font-medium text-sm truncate ${
                  isSelected ? "text-blue-600" : "text-gray-900"
                }`}
              >
                {node.name}
              </div>
              {/* Always show full path for context */}
              {fullPath.length > 1 && (
                <div className="text-xs text-gray-600 truncate">
                  {fullPath.join(" → ")}
                </div>
              )}
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="border-l border-gray-200 ml-6">
              {renderLocationTree(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="relative" ref={locationDropdownRef}>
      <button
        onClick={() => setShowLocationDropdown(!showLocationDropdown)}
        className="flex items-center justify-between h-11 w-full rounded-full border border-lightBorder px-4 text-[15px] bg-white hover:bg-gray-50 transition-colors"
        type="button"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span
            className={`truncate ${
              selectedLocation ? "text-ink" : "text-gray-500"
            }`}
          >
            {getLocationDisplayName(selectedLocation)}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform flex-shrink-0 ${
            showLocationDropdown ? "rotate-180" : ""
          }`}
        />
      </button>

      {showLocationDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-lightBorder rounded-b-2xl shadow-lg z-50 max-h-80 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-lightBorder flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search exact paths like: 'mv sh1 2b', 'shelf 1', '2b'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-lg border-lightBorder"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-48">
            <div
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
              onClick={() => {
                console.log("📍 [LOCATION CLEARED] Clearing location filter");
                onLocationChange(null, []);
                setShowLocationDropdown(false);
                setSearchQuery("");
              }}
            >
              <span
                className={
                  !selectedLocation
                    ? "text-blue-600 font-medium"
                    : "text-gray-600"
                }
              >
                All Locations
              </span>
            </div>

            {filteredLocations.length > 0 ? (
              renderLocationTree(filteredLocations)
            ) : searchQuery.trim() ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No exact match found for "{searchQuery}"
              </div>
            ) : (
              renderLocationTree(locations)
            )}
          </div>

          <div className="sticky bottom-0 p-2 border-t border-lightBorder bg-white flex-shrink-0 rounded-b-2xl">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLocationDropdown(false);
                setSearchQuery("");
              }}
              className="w-full bg-white hover:bg-gray-50 rounded-lg"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
/* ---------------------------------- PriceDropdown Component ---------------------------------- */

function PriceDropdown({
  anchorRef,
  show,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  show: boolean;
  children: React.ReactNode;
}) {
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!show || !anchorRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      setCoords({
        left: rect.left + window.scrollX,
        top: rect.bottom + window.scrollY + 8,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [show, anchorRef]);

  if (typeof document === "undefined") return null;
  if (!show || !coords) return null;

  return createPortal(
    <div
      ref={portalRef}
      style={{
        position: "absolute",
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        zIndex: 9999,
        minWidth: 240,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="bg-white border border-lightBorder rounded-md shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ---------------------------------- InventoryDashboard Component ---------------------------------- */

export function InventoryDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [invSuggestions, setInvSuggestions] = useState<
    { id: string; label: string; sub?: string }[]
  >([]);
  const [invSuggestOpen, setInvSuggestOpen] = useState(false);
  const [invHighlight, setInvHighlight] = useState(0);
  const invSuggestRef = useRef<HTMLDivElement | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showNonNGCSetupMessage, setShowNonNGCSetupMessage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!invSuggestRef.current) return;
      const target = e.target as Node;
      if (!invSuggestRef.current.contains(target)) {
        setInvSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler as any);
    };
  }, []);

  const clientId =
    (user as any)?.client_id ||
    (user as any)?.clientId ||
    user?.id ||
    (user as any)?.user?.client_id;

  const [filters, setFilters] = useState<FilterState>({
    dateAdded: { startDate: "", endDate: "" },
    certificateNumber: "",
    status: "All",
    price: { min: "", max: "" },
    name: "",
    location: "",
    locationHierarchy: [],
  });

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [dateFilterOption, setDateFilterOption] = useState<
    "all" | "recent" | "custom"
  >("recent");

  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [priceInputs, setPriceInputs] = useState<{ min: string; max: string }>({
    min: "",
    max: "",
  });
  const priceDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const priceDropdownRef = useRef<HTMLDivElement | null>(null);
  const pricePortalRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const [showPriceDropdown, setShowPriceDropdown] = useState(false);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedInsidePriceAnchor =
        priceDropdownRef.current && priceDropdownRef.current.contains(target);
      const clickedInsidePricePortal =
        pricePortalRef.current && pricePortalRef.current.contains(target);
      if (!clickedInsidePriceAnchor && !clickedInsidePricePortal) {
        setShowPriceDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    console.log("🔍 [DETAILED USER ANALYSIS]", {
      user,
      userFull: JSON.stringify(user, null, 2),
      allUserKeys: user ? Object.keys(user) : [],
      hasClientId: !!(user as any)?.client_id,
      hasClientIdAlt: !!(user as any)?.clientId,
      hasId: !!user?.id,
      userRole: user?.role,
      userOrganization: (user as any)?.organization,
      userCompany: (user as any)?.company,
      userTenant: (user as any)?.tenant,
    });
  }, [user]);

  const fetchLocations = async () => {
    setIsLoadingLocations(true);
    try {
      const userOrganizationId =
        (user as any)?.organization_id ||
        (user as any)?.organization?.id ||
        (user as any)?.org_id;

      console.log("🗺️ [FETCHING LOCATIONS - ORGANIZATION CONTEXT]", {
        userOrganizationId,
        clientId,
        usingClientIdInUrl: !!clientId,
        locationsUrl: `/locations/locations/?client_id=${clientId}`,
      });

      let allLocations: any[] = [];
      let nextUrl = `/locations/locations/?client_id=${clientId}`;

      while (nextUrl) {
        const locationsResponse = await api<{
          results: any[];
          next: string | null;
        }>(nextUrl);

        if (locationsResponse && locationsResponse.results) {
          console.log("📍 [LOCATIONS BATCH RECEIVED]", {
            batchSize: locationsResponse.results.length,
            firstLocation: locationsResponse.results[0]
              ? {
                  id: locationsResponse.results[0].id,
                  name: locationsResponse.results[0].name,
                  organization_id: locationsResponse.results[0].organization_id,
                  client_id: locationsResponse.results[0].client_id,
                }
              : "no locations",
            allOrganizationIds: [
              ...new Set(
                locationsResponse.results.map(
                  (loc: any) => loc.organization_id,
                ),
              ),
            ],
          });

          allLocations = [...allLocations, ...locationsResponse.results];
          nextUrl = locationsResponse.next
            ? locationsResponse.next.replace(
                /^http:\/\/localhost:[0-9]+\/api\/v1/,
                "",
              )
            : "";
        } else {
          break;
        }
      }

      const locationTree = buildLocationTree(allLocations);
      setLocations(locationTree);

      console.log("✅ [LOCATIONS TREE BUILT]", {
        totalLocations: allLocations.length,
        rootNodes: locationTree.length,
        allOrganizationsInTree: [
          ...new Set(allLocations.map((loc: any) => loc.organization_id)),
        ],
        treeSample: locationTree.slice(0, 2),
      });
    } catch (err) {
      console.error("❌ [LOCATIONS FETCH ERROR]", {
        error: err,
        clientId,
        user,
      });
      toast({
        title: "Error",
        description: "Failed to load locations",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const buildLocationTree = (flatLocations: any[]): LocationNode[] => {
    const locationMap = new Map<string, LocationNode>();
    const rootNodes: LocationNode[] = [];

    flatLocations.forEach((location) => {
      locationMap.set(location.id, {
        id: location.id,
        name: location.name,
        type: location.type,
        children: [],
      });
    });

    flatLocations.forEach((location) => {
      const locationWithChildren = locationMap.get(location.id)!;

      if (location.parent && locationMap.has(location.parent)) {
        const parent = locationMap.get(location.parent);
        if (parent) {
          parent.children!.push(locationWithChildren);
        }
      } else {
        rootNodes.push(locationWithChildren);
      }
    });

    return rootNodes;
  };

  const getAllDescendantIds = useCallback((node: LocationNode): string[] => {
    let ids: string[] = [node.id];
    if (node.children) {
      node.children.forEach((child) => {
        ids = ids.concat(getAllDescendantIds(child));
      });
    }
    return ids;
  }, []);

  const findLocationNode = (
    locationId: string,
    nodes: LocationNode[] = locations,
  ): LocationNode | null => {
    for (const node of nodes) {
      if (node.id === locationId) {
        return node;
      }
      if (node.children) {
        const found = findLocationNode(locationId, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const getLocationPath = (
    locationId: string,
    nodes: LocationNode[] = locations,
    path: string[] = [],
  ): string[] => {
    for (const node of nodes) {
      if (node.id === locationId) {
        return [...path, node.name];
      }
      if (node.children) {
        const found = getLocationPath(locationId, node.children, [
          ...path,
          node.name,
        ]);
        if (found.length > 0) return found;
      }
    }
    return [];
  };

  const getLocationDisplayName = useCallback(
    (locationId: string): string => {
      if (!locationId) return "All Locations";
      const path = getLocationPath(locationId);
      return path.length > 0 ? path.join(" → ") : "All Locations";
    },
    [locations],
  );

  useEffect(() => {
    if (user && clientId) {
      fetchLocations();
    }
  }, [user, clientId]);

  const getCurrentWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
      startDate: startOfWeek.toISOString().split("T")[0],
      endDate: endOfWeek.toISOString().split("T")[0],
    };
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : Number(price);
    if (Number.isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const tryParse = (v: unknown) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }
    return v && typeof v === "object" ? v : null;
  };

  const getFirstImageSrc = (images: any[] | undefined) => {
    if (!images || images.length === 0) return "";
    const first = images[0];
    if (typeof File !== "undefined" && first instanceof File) {
      try {
        return URL.createObjectURL(first);
      } catch {
        return "";
      }
    }
    if (typeof first === "string") return first;
    return first?.front_url ?? first?.rear_url ?? first?.url ?? "";
  };

  const updateActiveFilters = (newFilters: FilterState) => {
    const active: ActiveFilter[] = [];
    if (newFilters.dateAdded.startDate || newFilters.dateAdded.endDate) {
      active.push({
        type: "Date",
        value: `date:${newFilters.dateAdded.startDate}-${newFilters.dateAdded.endDate}`,
        displayValue:
          !newFilters.dateAdded.startDate && !newFilters.dateAdded.endDate
            ? "All dates"
            : `${newFilters.dateAdded.startDate || ""} to ${
                newFilters.dateAdded.endDate || ""
              }`,
      });
    }
    if (newFilters.certificateNumber) {
      active.push({
        type: "Certificate",
        value: `cert:${newFilters.certificateNumber}`,
        displayValue: newFilters.certificateNumber,
      });
    }
    if (newFilters.status !== "All") {
      const statusLabel =
        statusOptions.find((s) => s.value === newFilters.status)?.label ||
        newFilters.status;
      active.push({
        type: "Status",
        value: `status:${newFilters.status}`,
        displayValue: statusLabel,
      });
    }
    if (newFilters.price.min || newFilters.price.max) {
      active.push({
        type: "Price",
        value: `price:${newFilters.price.min}-${newFilters.price.max}`,
        displayValue:
          newFilters.price.min && newFilters.price.max
            ? `${formatPrice(newFilters.price.min)} - ${formatPrice(
                newFilters.price.max,
              )}`
            : newFilters.price.min
              ? `>= ${formatPrice(newFilters.price.min)}`
              : `<= ${formatPrice(newFilters.price.max)}`,
      });
    }
    if (newFilters.name) {
      active.push({
        type: "Search",
        value: `name:${newFilters.name}`,
        displayValue: newFilters.name,
      });
    }
    if (newFilters.location) {
      active.push({
        type: "Location",
        value: `location:${newFilters.location}`,
        displayValue: `${getLocationDisplayName(newFilters.location)}`,
      });
    }

    setActiveFilters(active);
  };

  const clearAllFilters = () => {
    const currentWeekRange = getCurrentWeekRange();
    const resetFilters: FilterState = {
      dateAdded: currentWeekRange,
      certificateNumber: "",
      status: "All",
      price: { min: "", max: "" },
      name: "",
      location: "",
      locationHierarchy: [],
    };

    setFilters(resetFilters);
    setSearchTerm("");
    setDateFilterOption("recent"); // This is the key fix - reset to "recent"
    setActiveFilters([]);
    setShowPriceDropdown(false);
    setPriceInputs({ min: "", max: "" });

    // Use the reset filters which now have current week dates AND "recent" option
    fetchInventoryItems(1, resetFilters);
  };

  const removeFilter = (filterToRemove: ActiveFilter) => {
    const newFilters = { ...filters };
    switch (filterToRemove.type) {
      case "Date":
        newFilters.dateAdded = { startDate: "", endDate: "" };
        setDateFilterOption("all");
        break;
      case "Certificate":
        newFilters.certificateNumber = "";
        break;
      case "Status":
        newFilters.status = "All";
        break;
      case "Price":
        newFilters.price = { min: "", max: "" };
        setPriceInputs({ min: "", max: "" });
        break;
      case "Search":
        newFilters.name = "";
        setSearchTerm("");
        break;
      case "Location":
        newFilters.location = "";
        newFilters.locationHierarchy = [];
        break;
    }
    setFilters(newFilters);
    updateActiveFilters(newFilters);
    fetchInventoryItems(1, newFilters);
  };

  const displayStart =
    totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const displayEnd =
    totalItems > 0 ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  const transformItems = (results: any[]): InventoryItem[] =>
    results.map((item: any) => {
      let description = item.description || "";
      const attrs: any = tryParse(item.attributes);

      if (!description && attrs) {
        description =
          attrs.description ||
          attrs?.metadata?.description ||
          attrs?.coin?.description ||
          attrs?.notes ||
          "";
      }

      if (!description && attrs?.coin && attrs?.grade) {
        const year = attrs.coin.year || "";
        const denomination = attrs.coin.denomination || "";
        const mintMark = attrs.coin.mint_mark || "";
        const grade = attrs.grade.display || "";
        if (year || denomination || mintMark) {
          description = `${year} ${mintMark} ${denomination} ${grade}`.trim();
        }
      }

      const displayLocation =
        item.location_name ||
        item.location_path?.split("/")?.pop() ||
        item.location ||
        "Unknown";

      return {
        ...item,
        description,
        displayStatus: (statusMapping as any)[item.status] || item.status,
        displayLocation,
      } as InventoryItem;
    });

  const recoverToLastPage = async (baseParams: Record<string, unknown>) => {
    try {
      const meta = await inventoryApi.getItems({ ...baseParams, page: 1 });
      const authoritativeCount =
        typeof meta.count === "number" ? meta.count : 0;
      const lastPage = Math.max(
        1,
        Math.ceil(authoritativeCount / itemsPerPage),
      );
      const finalResp = await inventoryApi.getItems({
        ...baseParams,
        page: lastPage,
      });
      const finalCount =
        typeof finalResp.count === "number" ? finalResp.count : 0;
      const finalResults = Array.isArray(finalResp.results)
        ? finalResp.results
        : [];

      toast({
        title: "Showing latest page",
        description: `Requested page was unavailable — showing page ${lastPage} instead.`,
        variant: "default",
        duration: 3000,
      });

      setTotalItems(finalCount);
      setTotalPages(Math.max(1, Math.ceil(finalCount / itemsPerPage)));
      setCurrentPage(lastPage);

      const transformed = transformItems(finalResults);
      setItems(transformed);
      setFilteredItems(transformed);
      setIsLoading(false);
      setError(null);
      return true;
    } catch (fallbackErr) {
      console.error("[recoverToLastPage] Recovery failed:", fallbackErr);
      setError("Failed to load inventory items. Please try again later.");
      setIsLoading(false);
      return false;
    }
  };

  const fetchInventoryItems = async (page = 1, filterParams?: FilterState) => {
    setIsLoading(true);
    setError(null);
    const requestedPage = Math.max(1, page);
    const currentFilters = filterParams || filters;
    const currentDateOption =
      filterParams === filters
        ? dateFilterOption
        : filterParams?.dateAdded.startDate || filterParams?.dateAdded.endDate
          ? "custom"
          : "recent";

    console.log("🔍 [API CALL - SPECIFIC LOCATION]", {
      page: requestedPage,
      page_size: itemsPerPage,
      location: currentFilters.location,
      locationHierarchy: currentFilters.locationHierarchy,
      locationName: currentFilters.location
        ? getLocationDisplayName(currentFilters.location)
        : "None",
      filterType: "specific_level_only",
    });

    const baseApiParams: Record<string, unknown> = {
      page: requestedPage,
      page_size: itemsPerPage,
      ordering: "-updated_at",
    };

    if (currentDateOption === "recent") {
      // Always apply current week filter for "recent" option
      if (currentFilters.dateAdded.startDate) {
        baseApiParams.date_added_after = currentFilters.dateAdded.startDate;
      }
      if (currentFilters.dateAdded.endDate) {
        baseApiParams.date_added_before = currentFilters.dateAdded.endDate;
      }
    } else if (currentDateOption === "custom") {
      // Only apply custom dates if they are provided
      if (currentFilters.dateAdded.startDate) {
        baseApiParams.date_added_after = currentFilters.dateAdded.startDate;
      }
      if (currentFilters.dateAdded.endDate) {
        baseApiParams.date_added_before = currentFilters.dateAdded.endDate;
      }
    }
    if (currentFilters.certificateNumber) {
      baseApiParams.certificate_number = currentFilters.certificateNumber;
    }

    if (currentFilters.status && currentFilters.status !== "All")
      baseApiParams.status = currentFilters.status;
    if (currentFilters.price.min)
      baseApiParams.min_price = currentFilters.price.min;
    if (currentFilters.price.max)
      baseApiParams.max_price = currentFilters.price.max;

    // Handle main search - always include the generic 'search' for backend SearchFilter
    if (currentFilters.name) {
      const searchStr = String(currentFilters.name).trim();
      baseApiParams.search = searchStr;

      const yearMatch = /^\d{1,4}$/.test(searchStr);
      const isIdentificationNumber =
        !yearMatch && // <-- don't treat 4-digit numbers as IDs
        (/^(?:CERT-|ID-|INV-|cert-|id-|inv-|#)[A-Za-z0-9_-]+$/i.test(
          searchStr,
        ) ||
          /^\d+(-\d+)*$/.test(searchStr));

      if (isIdentificationNumber) {
        baseApiParams.identification_number = searchStr;
        baseApiParams.certificate_number = searchStr;
      }
    }

    // FIXED: Use only the specific selected location without children
    if (
      currentFilters.location &&
      currentFilters.locationHierarchy.length > 0
    ) {
      console.log("📍 [API - APPLYING HIERARCHICAL LOCATION FILTER]", {
        selectedLocationId: currentFilters.location,
        selectedLocationName: getLocationDisplayName(currentFilters.location),
        allLocationIdsInHierarchy: currentFilters.locationHierarchy,
        hierarchySize: currentFilters.locationHierarchy.length,
        filterType: "hierarchical_includes_children",
      });

      if (currentFilters.locationHierarchy.length === 1) {
        // Single exact location
        baseApiParams.location = currentFilters.locationHierarchy[0];
      } else {
        // Multiple descendant locations – backend expects 'location_in'
        baseApiParams.location_in = currentFilters.locationHierarchy.join(",");
      }

      const possibleOrganizationIds = [
        (user as any)?.organization_id,
        (user as any)?.organization?.id,
        (user as any)?.org_id,
      ];

      const organizationId = possibleOrganizationIds.find((id) => id);

      if (organizationId) {
        baseApiParams.organization_id = organizationId;
      }
    }
    console.log("🧭 [DEBUG] fetchInventoryItems called", {
      requestedPage,
      itemsPerPage,
      dateFilterOption: currentDateOption,
      filters: currentFilters,
    });

    console.log("🚀 [API CALL - FINAL PARAMS]", baseApiParams);

    console.log(
      "🧾 [DEBUG] final API params about to be sent to inventoryApi.getItems",
      {
        baseApiParams,
        typeof_page_size: typeof baseApiParams.page_size,
        page_size_value: baseApiParams.page_size,
      },
    );

    try {
      const response: any = await inventoryApi.getItems(baseApiParams);

      console.log("📨 [DEBUG] inventoryApi.getItems response", {
        responseKeys: response ? Object.keys(response) : null,
        serverCount: response?.count,
        resultsLength: Array.isArray(response?.results)
          ? response.results.length
          : "not-array",
        sampleFirstResult:
          Array.isArray(response?.results) && response.results.length
            ? response.results[0]
            : null,
      });

      console.log("✅ [API RESPONSE - LOCATION FILTER]", {
        count: response.count,
        resultsLength: response.results?.length,
        currentPage: requestedPage,
        selectedLocation: currentFilters.location,
        locationName: getLocationDisplayName(currentFilters.location),
        itemsFound: response.results?.length || 0,
      });

      const allResults = Array.isArray(response.results)
        ? response.results
        : [];
      const transformed = transformItems(allResults);

      // Client-side verification for specific location only
      let finalFilteredItems = transformed;
      if (currentFilters.locationHierarchy.length > 0) {
        finalFilteredItems = transformed.filter((item: any) => {
          const itemLocation = item.location || item.location_id;
          const matches =
            currentFilters.locationHierarchy.includes(itemLocation);

          if (!matches && process.env.NODE_ENV === "development") {
            console.log("❌ [LOCATION MISMATCH]", {
              itemId: item.id,
              itemName: item.name,
              itemLocation,
              expectedLocations: currentFilters.locationHierarchy,
              matches,
            });
          }

          return matches;
        });

        console.log("✅ [SPECIFIC LOCATION FILTERING COMPLETE]", {
          totalItemsFromAPI: transformed.length,
          itemsAfterSpecificLocationFilter: finalFilteredItems.length,
          selectedLocation: currentFilters.locationHierarchy[0],
          selectedLocationName: getLocationDisplayName(currentFilters.location),
          matchingItems: finalFilteredItems.map((item) => ({
            id: item.id,
            name: item.name,
            location: item.location,
            location_name: item.displayLocation,
          })),
        });
      }

      // Proper pagination handling
      const serverCount =
        typeof response.count === "number" ? response.count : 0;
      const computedTotalPages = Math.max(
        1,
        Math.ceil(serverCount / itemsPerPage),
      );

      // Handle case where requested page is beyond available pages
      if (requestedPage > computedTotalPages && computedTotalPages > 0) {
        const recovered = await recoverToLastPage(baseApiParams);
        if (recovered) return;
      }

      setTotalItems(serverCount);
      setTotalPages(computedTotalPages);
      setCurrentPage(
        requestedPage > computedTotalPages ? computedTotalPages : requestedPage,
      );
      setItems(transformed);
      setFilteredItems(finalFilteredItems);
      setIsLoading(false);

      return;
    } catch (err: any) {
      console.error("❌ [API ERROR]", {
        error: err.message,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.url,
      });

      const status = err?.response?.status;
      if (status === 404 && requestedPage > 1) {
        const recovered = await recoverToLastPage({
          ...baseApiParams,
          page: 1,
        });
        if (recovered) return;
      }

      // Better error handling for validation errors
      if (status === 400) {
        console.error(
          "❌ [VALIDATION ERROR] Backend rejected parameters:",
          err?.response?.data,
        );
        // Try without the problematic parameters
        const cleanParams = { ...baseApiParams };
        delete cleanParams.client_id;
        delete cleanParams.location_client_id;
        delete cleanParams.organization_id;

        try {
          console.log("🔄 [RETRYING WITH CLEAN PARAMS]", cleanParams);
          const retryResponse = await inventoryApi.getItems(cleanParams);
          const retryResults = Array.isArray(retryResponse.results)
            ? retryResponse.results
            : [];
          const retryTransformed = transformItems(retryResults);

          // Apply client-side location filtering
          let retryFilteredItems = retryTransformed;
          if (
            currentFilters.location &&
            currentFilters.locationHierarchy.length > 0
          ) {
            retryFilteredItems = retryTransformed.filter((item: any) => {
              const itemLocation = item.location || item.location_id;
              return currentFilters.locationHierarchy.includes(itemLocation);
            });
          }

          const retryCount =
            typeof retryResponse.count === "number" ? retryResponse.count : 0;
          const retryPages = Math.max(1, Math.ceil(retryCount / itemsPerPage));

          setTotalItems(retryCount);
          setTotalPages(retryPages);
          setCurrentPage(
            requestedPage > retryPages ? retryPages : requestedPage,
          );
          setItems(retryTransformed);
          setFilteredItems(retryFilteredItems);
          setIsLoading(false);
          return;
        } catch (retryErr) {
          console.error("❌ [RETRY FAILED]", retryErr);
        }
      }

      setError("Failed to load inventory items. Please try again later.");
      if (process.env.NODE_ENV === "development") {
        setItems(mockItems);
        setFilteredItems(mockItems);
      }
      setIsLoading(false);
      return;
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const currentWeekRange = getCurrentWeekRange();
    setFilters((prev) => ({ ...prev, dateAdded: currentWeekRange }));
    setPriceInputs({ min: "", max: "" });
    fetchInventoryItems(1, { ...filters, dateAdded: currentWeekRange });

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get("search");
      const dataParam = params.get("ngcData");
      if (dataParam && !searchParam) {
        try {
          const ngcData = JSON.parse(decodeURIComponent(dataParam));
          const newItem: InventoryItem = {
            id: "",
            name: ngcData.name || "Unknown Coin",
            description: ngcData.description || "",
            category: ngcData.category || "Coins",
            status: ngcData.status || "in_store",
            price: ngcData.price || "0.00",
            attributes: ngcData.attributes || {},
            images: ngcData.images || [],
            thumbnail:
              Array.isArray(ngcData.images) && ngcData.images.length > 0
                ? typeof ngcData.images[0] === "string"
                  ? ngcData.images[0]
                  : (ngcData.images[0]?.front_url ??
                    ngcData.images[0]?.rear_url ??
                    "")
                : "",
          };
          setSelectedItem(newItem);
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        } catch (e) {
          console.error("Error parsing NGC data from URL:", e);
        }
      }
    }

    return () => {
      setIsMounted(false);
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (filterType: keyof FilterState, value: any) => {
    console.log("🔄 [FILTER CHANGE] Filter type:", filterType, "Value:", value);

    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);

    updateActiveFilters(newFilters);
    fetchInventoryItems(1, newFilters);
  };

  // FIXED: Enhanced location change handler for specific level filtering only
  const handleLocationChange = (
    locationId: string | null,
    locationHierarchy: string[] = [],
  ) => {
    console.log("📍 [HIERARCHICAL LOCATION CHANGE HANDLER]", {
      previousLocation: filters.location,
      newLocation: locationId,
      locationHierarchy,
      hierarchySize: locationHierarchy.length,
      locationName: locationId ? getLocationDisplayName(locationId) : "None",
      trigger: "hierarchical_location_dropdown",
      includesChildren: locationHierarchy.length > 1,
    });
    const newFilters = {
      ...filters,
      location: locationId || "",
      locationHierarchy: locationHierarchy,
    };
    setFilters(newFilters);
    updateActiveFilters(newFilters);
    fetchInventoryItems(1, newFilters);
  };

  const applyPriceFilter = (min: string, max: string) => {
    const newFilters = { ...filters, price: { min, max } };
    setFilters(newFilters);
    updateActiveFilters(newFilters);
    fetchInventoryItems(1, newFilters);
  };

  const onPriceInputChange = (field: "min" | "max", value: string) => {
    const sanitized = value.replace(/[^\d.]/g, "");
    const newPriceInputs = { ...priceInputs, [field]: sanitized };
    setPriceInputs(newPriceInputs);
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      applyPriceFilter(newPriceInputs.min, newPriceInputs.max);
    }, 450);
  };

  const onPriceInputBlur = (field: "min" | "max") => {
    if (priceDebounceRef.current) {
      clearTimeout(priceDebounceRef.current);
      priceDebounceRef.current = null;
    }
    applyPriceFilter(priceInputs.min, priceInputs.max);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const newFilters = { ...filters, name: term };
    setFilters(newFilters);
    updateActiveFilters(newFilters);
    fetchInventoryItems(1, newFilters);
  };

  useEffect(() => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) {
      setInvSuggestions([]);
      setInvSuggestOpen(false);
      setInvHighlight(0);
      return;
    }
    const pool =
      Array.isArray(filteredItems) && filteredItems.length > 0
        ? filteredItems
        : items;
    const matches: { id: string; label: string; sub?: string }[] = [];
    for (const it of pool) {
      const name = (it as any).name || "";
      const desc = (it as any).description || "";
      const ident = (it as any).identification_number || "";
      const text = `${name}\n${desc}\n${ident}`.toLowerCase();
      if (text.includes(q)) {
        matches.push({ id: (it as any).id, label: name, sub: ident || desc });
        if (matches.length >= 10) break;
      }
    }
    setInvSuggestions(matches);
    setInvSuggestOpen(matches.length > 0);
    setInvHighlight(0);
  }, [searchTerm, filteredItems, items]);

  const handleDateFilterOptionChange = (value: "all" | "recent" | "custom") => {
    console.log("📅 [DATE FILTER OPTION CHANGE]", {
      from: dateFilterOption,
      to: value,
      currentFilters: filters,
    });

    setDateFilterOption(value);

    // Use setTimeout to ensure state updates have completed before fetching
    setTimeout(() => {
      if (value === "recent") {
        const currentWeekRange = getCurrentWeekRange();
        const newFilters = {
          ...filters,
          dateAdded: currentWeekRange,
        };
        console.log("🔄 [APPLYING RECENT FILTER]", {
          dateRange: currentWeekRange,
          newFilters,
        });
        setFilters(newFilters);
        updateActiveFilters(newFilters);
        fetchInventoryItems(1, newFilters);
      } else if (value === "all") {
        const newFilters = {
          ...filters,
          dateAdded: { startDate: "", endDate: "" },
        };
        console.log("🔄 [APPLYING ALL DATA FILTER]", {
          newFilters,
        });
        setFilters(newFilters);
        updateActiveFilters(newFilters);
        fetchInventoryItems(1, newFilters);
      } else {
        // For "custom", just update the option but don't change dates automatically
        setDateFilterOption("custom");
        console.log("🔄 [CUSTOM DATE FILTER SELECTED]");
        // Don't trigger fetch here - wait for user to input custom dates
      }
    }, 0);
  };

  const handleRefreshClick = () => {
    console.log("🔄 [MANUAL REFRESH] Refreshing inventory data");
    fetchInventoryItems(1, filters);
  };

  const handleRowClick = (item: InventoryItem) => {
    const enhanced: any = {
      ...item,
      description: (item as any).description || "",
      location: (item as any).location || undefined,
      location_path:
        (item as any).location_path || (item as any).locationPath || "",
      location_path_display: (item as any).displayLocation || "Unknown",
    };
    setSelectedItem(enhanced);
  };

  const handleDeleteClick = (item: InventoryItem) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setIsLoading(true);
      await inventoryApi.deleteItem(itemToDelete.id);
      const newTotal = Math.max(0, totalItems - 1);
      const newPages = Math.max(1, Math.ceil(newTotal / itemsPerPage));
      setTotalItems(newTotal);
      setTotalPages(newPages);
      const targetPage = currentPage > newPages ? newPages : currentPage;
      await fetchInventoryItems(targetPage, filters);
      toast({
        title: "Item Deleted",
        description: `${itemToDelete.name} has been successfully deleted.`,
        variant: "default",
      });
    } catch (err) {
      console.error("Failed to delete item:", err);
      setError("Failed to delete item. Please try again.");
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  if (!isMounted) return null;

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => fetchInventoryItems(1, filters)}>
          Try Again
        </Button>
      </div>
    );
  }

  const routerBack = () => router.push("/dashboard");

  const formatUpdatedDate = (dateString: string): string => {
    try {
      // Extract just the date part (YYYY-MM-DD) - handle both space and T separators
      // First try native parsing for full ISO strings like 2025-11-20T08:03:36.479044Z
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const dd = String(parsed.getDate()).padStart(2, "0");
        const yy = String(parsed.getFullYear()).slice(-2);
        return `${mm}-${dd}-${yy}`;
      }
      const datePart = dateString.split(/[ T]/)[0]; // ← This handles both space and T
      const [year, month, day] = datePart.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yy = String(date.getFullYear()).slice(-2);
      return `${mm}-${dd}-${yy}`;
    } catch (error) {
      console.error("Error parsing date:", dateString, error);
      return "N/A";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-urbanist text-ink mx-[-40px] px-[40px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 rounded-xl mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={routerBack}
            className="text-sky-600 hover:text-sky-700 transition-colors"
            aria-label="Back"
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-medium text-ink tracking-tight">
              Inventory Management
            </h1>
            <p className="text-ink/70 text-lg font-urbanist">
              Manage your luxury collectibles
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Button
            onClick={() => setShowBulkUpload(true)}
            variant="outline"
            className="bg-sky-600 border border-sky-700 text-white hover:bg-sky-700 hover:border-sky-800 shadow-sm transition-all duration-200"
          >
            <Upload className="h-5 w-5 mr-2 text-white" />
            <span className="tracking-wide">Bulk Upload</span>
          </Button>

          <Button
            onClick={() => setShowNonNGCSetupMessage(true)}
            className="bg-goldYellow text-ink hover:bg-goldYellow/90 shadow-sm hover:shadow transition-all duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            <span className="tracking-wide">Add Item</span>
          </Button>

          <AlertDialog
            open={showNonNGCSetupMessage}
            onOpenChange={setShowNonNGCSetupMessage}
          >
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-slate-600" />
                  <AlertDialogTitle>Feature Coming Soon</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="pt-2">
                  The non-NGC setup is currently in progress. This feature will
                  be available soon.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-start">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setShowNonNGCSetupMessage(false)}
                  className="mt-2 w-full"
                >
                  Got it
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Table card + toolbar */}
      <div className="rounded-2xl border border-lightBorder bg-white shadow-card overflow-visible mx-[-40px] px-[40px]">
        {/* Top toolbar */}
        <div className="sticky top-0 z-30 bg-white border-b border-lightBorder px-4 md:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search */}
            <div className="md:col-span-7">
              <div className="relative" ref={invSuggestRef}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, year, description, or identification number"
                  value={searchTerm}
                  onKeyDown={(e) => {
                    if (!invSuggestOpen || invSuggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setInvHighlight((h) => (h + 1) % invSuggestions.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setInvHighlight(
                        (h) =>
                          (h - 1 + invSuggestions.length) %
                          invSuggestions.length,
                      );
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const s = invSuggestions[invHighlight];
                      if (s) {
                        const newFilters = { ...filters, name: s.label };
                        setFilters(newFilters);
                        setSearchTerm(s.label);
                        updateActiveFilters(newFilters);
                        fetchInventoryItems(1, newFilters);
                        setInvSuggestOpen(false);
                      }
                    } else if (e.key === "Escape") {
                      setInvSuggestOpen(false);
                    }
                  }}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-11 w-full pl-11 pr-4 rounded-full bg-white border-lightBorder focus:ring-0 focus:border-gray-300 text-[15px]"
                  aria-label="Search inventory"
                />
                {invSuggestOpen && invSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-lightBorder rounded-md shadow-sm max-h-64 overflow-auto">
                    {invSuggestions.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseEnter={() => setInvHighlight(idx)}
                        onClick={() => {
                          const newFilters = { ...filters, name: s.label };
                          setFilters(newFilters);
                          setSearchTerm(s.label);
                          updateActiveFilters(newFilters);
                          fetchInventoryItems(1, newFilters);
                          setInvSuggestOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm ${
                          idx === invHighlight ? "bg-gray-50" : "bg-white"
                        }`}
                      >
                        <div className="font-medium text-gray-900">
                          {s.label}
                        </div>
                        {s.sub ? (
                          <div className="text-xs text-gray-500 truncate">
                            {s.sub}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Location filter */}
            <div className="md:col-span-5">
              <LocationDropdown
                locations={locations}
                selectedLocation={filters.location}
                onLocationChange={handleLocationChange}
                getLocationDisplayName={getLocationDisplayName}
                getLocationPath={getLocationPath}
                getAllDescendantIds={getAllDescendantIds}
              />
            </div>
          </div>
        </div>

        {/* Data options row */}
        <div className="sticky top-[64px] z-20 bg-white px-4 md:px-6 py-3 border-t border-lightBorder">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left side - Filter dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date range */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  Date range:
                </span>
                <Select
                  value={dateFilterOption}
                  onValueChange={(value) =>
                    handleDateFilterOptionChange(
                      value as "all" | "recent" | "custom",
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-[140px] rounded-md">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Current Week</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                    <SelectItem value="all">All data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status filter */}
              <div className="relative">
                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange("status", value)}
                >
                  <SelectTrigger className="h-8 w-[140px] rounded-md">
                    <SelectValue placeholder="Status">
                      {filters.status === "All"
                        ? "Status"
                        : statusOptions.find((s) => s.value === filters.status)
                            ?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price filter */}
              <div ref={priceDropdownRef} className="relative">
                <button
                  onClick={() => setShowPriceDropdown((s) => !s)}
                  className="flex items-center justify-between h-8 w-[140px] rounded-md border border-lightBorder px-3 text-sm bg-white hover:bg-gray-50"
                  type="button"
                  aria-label="Filter by price"
                >
                  <span>Price</span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </button>

                <PriceDropdown
                  anchorRef={priceDropdownRef}
                  show={showPriceDropdown}
                >
                  <div className="p-3">
                    <div className="font-medium text-sm mb-3">
                      Filter by Price
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Min Price (&gt;=)
                        </label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0.00"
                          value={priceInputs.min}
                          onChange={(e) =>
                            onPriceInputChange("min", e.target.value)
                          }
                          onBlur={() => onPriceInputBlur("min")}
                          className="h-9 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Max Price (&lt;=)
                        </label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0.00"
                          value={priceInputs.max}
                          onChange={(e) =>
                            onPriceInputChange("max", e.target.value)
                          }
                          onBlur={() => onPriceInputBlur("max")}
                          className="h-9 text-sm w-full"
                        />
                      </div>
                      <div className="text-xs text-gray-500 italic">
                        Use either min or max or both.
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowPriceDropdown(false)}
                          className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                </PriceDropdown>
              </div>
            </div>

            {/* Right side - Count display */}
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {isLoading ? (
                "Loading items..."
              ) : (
                <>
                  Showing {displayStart} - {displayEnd} of {totalItems} items
                </>
              )}
            </div>
          </div>

          {/* Custom date inputs */}
          {dateFilterOption === "custom" && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  Custom date range:
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <label
                      htmlFor="start-date"
                      className="text-xs text-gray-500 mb-1"
                    >
                      From
                    </label>
                    <Input
                      id="start-date"
                      type="date"
                      value={filters.dateAdded.startDate}
                      onChange={(e) =>
                        handleFilterChange("dateAdded", {
                          ...filters.dateAdded,
                          startDate: e.target.value,
                        })
                      }
                      className="h-8 w-[140px] rounded-md"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label
                      htmlFor="end-date"
                      className="text-xs text-gray-500 mb-1"
                    >
                      To
                    </label>
                    <Input
                      id="end-date"
                      type="date"
                      value={filters.dateAdded.endDate}
                      onChange={(e) =>
                        handleFilterChange("dateAdded", {
                          ...filters.dateAdded,
                          endDate: e.target.value,
                        })
                      }
                      className="h-8 w-[140px] rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active Filters & Clear Button */}
        <div className="sticky top-[128px] z-20 bg-white px-4 md:px-6 py-3 border-t border-lightBorder flex justify-between items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">
              Active filters:
            </span>
            {activeFilters.length > 0 ? (
              activeFilters.map((filter) => (
                <Badge
                  key={filter.value}
                  variant="secondary"
                  className="flex items-center gap-1 bg-blue-100 text-blue-800"
                >
                  <span className="font-medium">{filter.type}:</span>
                  {filter.displayValue}
                  <button
                    onClick={() => removeFilter(filter)}
                    className="ml-1 hover:text-blue-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-500 italic">
                No active filters
              </span>
            )}
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="relative rounded-lg border border-gray-200 overflow-visible">
          <div
            ref={tableContainerRef}
            className="overflow-auto max-h-[calc(100vh-250px)]"
            style={{ scrollbarWidth: "thin" }}
          >
            <Table className="w-full font-urbanist min-w-[800px]">
              <TableHeader className="sticky top-0 z-10 bg-slate-100">
                <TableRow className="border-b border-lightBorder/70 bg-slate-100/90">
                  {/* <TableHead className="py-3 text-sm font-medium text-gray-600 min-w-[60px]">Image</TableHead> */}
                  <TableHead className="py-3 pl-8 text-sm font-medium text-gray-600 min-w-[300px]">
                    Product
                  </TableHead>
                  <TableHead className="py-3 pl-6 text-sm font-medium text-gray-600 min-w-[150px]">
                    Status
                  </TableHead>
                  <TableHead className="py-3 text-sm font-medium text-gray-600 text-center min-w-[120px]">
                    Price
                  </TableHead>
                  <TableHead className="py-3 text-sm font-medium text-gray-600 text-center min-w-[140px]">
                    Last Updated
                  </TableHead>
                  <TableHead className="py-3 text-center text-sm font-medium text-gray-600 min-w-[180px]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-200">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-goldYellow border-t-transparent" />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item: any) => (
                    <TableRow
                      key={item.id}
                      className="border-b border-lightBorder/60 hover:bg-gray-50/70 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(item)}
                    >
                      {/* Coin Image */}
                      {/* <TableCell className="py-3 px-4">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300">
                          {item.thumbnail || item.images?.length > 0 ? (
                            <img 
                              src={getFirstImageSrc(item.images)} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Coins className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                      </TableCell> */}

                      {/* Product Name and Description */}
                      {/* <TableCell className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.description?.substring(0, 50) || ""}</div>
                        </div>
                      </TableCell> */}

                      <TableCell className="py-3 pl-8 pr-4">
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.description?.substring(0, 30) || ""}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3 pl-6 px-4">
                        <Badge
                          className={`${
                            statusColors[item.displayStatus || ""] ||
                            "bg-gray-100 text-gray-700 border border-gray-200"
                          } text-xs font-medium px-2.5 py-1 rounded-full`}
                        >
                          {item.displayStatus || item.status}
                        </Badge>
                      </TableCell>

                      {/* Price */}
                      <TableCell className="py-3 px-4 text-center tabular-nums text-gray-900">
                        {formatPrice(item.price)}
                      </TableCell>

                      {/* Last Updated */}
                      <TableCell className="py-3 px-4 text-center text-sm text-gray-600">
                        {item.updated_at
                          ? formatUpdatedDate(item.updated_at)
                          : "N/A"}
                      </TableCell>

                      {/* Actions */}
                      {/* Actions */}
                      <TableCell className="py-3 px-6">
                        {" "}
                        {/* Increased padding from px-4 to px-6 */}
                        <div className="flex items-center justify-center space-x-3">
                          {" "}
                          {/* Increased spacing from space-x-1 to space-x-3 */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(item);
                            }}
                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full"
                            aria-label="Edit Item"
                          >
                            {" "}
                            {/* Increased padding from p-1.5 to p-2 */}
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(item);
                            }}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full"
                            aria-label="Delete Item"
                          >
                            {" "}
                            {/* Increased padding from p-1.5 to p-2 */}
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = "/ebay-integration";
                            }}
                            className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 p-2 rounded-full transition-colors"
                            aria-label="List on eBay"
                            title="List this item on eBay"
                          >
                            {" "}
                            {/* Increased padding from p-1.5 to p-2 */}
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-ink/60 italic"
                    >
                      No items found. Try adjusting your filters or add a new
                      item.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* FIXED: Pagination with better layout */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 px-4 py-3 border-t border-lightBorder">
              {/* <div className="text-sm text-gray-600">
                Showing {displayStart} - {displayEnd} of {totalItems} items
              </div> */}

              <Pagination>
                <PaginationContent className="flex items-center gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1)
                          fetchInventoryItems(currentPage - 1, filters);
                      }}
                      className={
                        currentPage <= 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  <PaginationItem>
                    <span className="text-sm font-medium px-3">
                      Page {currentPage} of {totalPages}
                    </span>
                  </PaginationItem>

                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages)
                          fetchInventoryItems(currentPage + 1, filters);
                      }}
                      className={
                        currentPage >= totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="font-urbanist">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-urbanist font-semibold text-green-600">
              Delete Item
            </AlertDialogTitle>
            <AlertDialogDescription className="text-moss-700">
              Are you sure you want to delete "{itemToDelete?.name}"? This
              action cannot be undone.
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
              onClick={handleDeleteConfirm}
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

      {/* Modals */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={async () => {
            try {
              await fetchInventoryItems(currentPage, filters);
              setSelectedItem(null);
            } catch (err) {
              console.error("Failed to update item:", err);
              alert("Failed to update item. Please try again.");
            }
          }}
          onDelete={(itemId) => {
            const newTotal = Math.max(0, totalItems - 1);
            const newPages = Math.max(1, Math.ceil(newTotal / itemsPerPage));
            const targetPage = currentPage > newPages ? newPages : currentPage;
            fetchInventoryItems(targetPage, filters);
            setSelectedItem(null);
          }}
        />
      )}

      {showAddWizard && (
        <AddItemWizard
          isOpen={showAddWizard}
          onClose={() => setShowAddWizard(false)}
          onSave={(createdItem: any) => {
            const normalized: any = {
              ...createdItem,
              displayStatus:
                (statusMapping as any)[createdItem.status] ||
                createdItem.status,
              displayLocation:
                createdItem.location_name || createdItem.location || "Unknown",
            };
            const updated = [...items, normalized];
            setItems(updated);
            setFilteredItems(updated);
            setShowAddWizard(false);
          }}
        />
      )}

      {showBulkUpload && (
        <BulkUploadInterface
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          onUpload={(newItems: any[]) => {
            const itemsWithCreator = newItems.map((item) =>
              user?.id && !item.created_by
                ? { ...item, created_by: user.id }
                : item,
            );
            const itemsWithIds = itemsWithCreator.map((item) => ({
              ...item,
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? (crypto as any).randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            }));
            const updated = [...items, ...itemsWithIds];
            setItems(updated);
            setFilteredItems(updated);
            setShowBulkUpload(false);
          }}
          onRefresh={() => fetchInventoryItems(1, filters)}
        />
      )}
    </div>
  );
}

export default InventoryDashboard;
