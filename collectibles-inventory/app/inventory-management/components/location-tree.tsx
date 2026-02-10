"use client";

import React, { useEffect, useState } from "react";
import { TreeView, TreeNode } from "../../../components/ui/tree-view";
import { useInventory } from "../context/inventory-context";
import { Location } from "../../../lib/services/inventory-service";
import { MapPin, Home, Box, Loader2 } from "lucide-react";

interface LocationTreeProps {
  onSelectLocation: (location: Location | null) => void;
  selectedLocationId?: string;
  className?: string;
}

export function LocationTree({
  onSelectLocation,
  selectedLocationId,
  className = "",
}: LocationTreeProps) {
  const { locations, fetchLocations, isLoading } = useInventory();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

  // Get appropriate icon based on location type
  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'site':
        return <Home className="h-4 w-4" />;
      case 'room':
      case 'shelf':
        return <MapPin className="h-4 w-4" />;
      case 'box':
      case 'row':
      case 'slot':
        return <Box className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  // Convert flat locations to hierarchical structure
  useEffect(() => {
    // First, create a map of all locations by ID
    const locationMap = new Map<string, (Location & { children: (Location & { icon?: React.ReactNode })[] })>();
    
    locations.forEach(location => {
      locationMap.set(location.id, { ...location, children: [] });
    });
    
    // Then build the tree structure
    const rootLocations: TreeNode[] = [];
    
    locations.forEach(location => {
      const locationWithChildren = locationMap.get(location.id)!;
      
      if (!location.parent) {
        // This is a root location
        rootLocations.push({
          ...locationWithChildren,
          icon: getLocationIcon(location.type)
        } as unknown as TreeNode);
      } else if (locationMap.has(location.parent)) {
        // Add as child to parent location
        const parent = locationMap.get(location.parent)!;
        parent.children.push({
          ...locationWithChildren,
          icon: getLocationIcon(location.type)
        } as unknown as (Location & { icon: React.ReactNode }));
      } else {
        // Parent not found, add to root
        rootLocations.push({
          ...locationWithChildren,
          icon: getLocationIcon(location.type)
        } as unknown as TreeNode);
      }
    });
    
    setTreeData(rootLocations);
  }, [locations]);

  // Handle location selection
  const handleSelectNode = (node: TreeNode) => {
    const selectedLocation = locations.find(l => l.id === node.id);
    if (selectedLocation) {
      onSelectLocation(selectedLocation);
    }
  };

  // Handle "All Locations" selection
  const handleSelectAll = () => {
    onSelectLocation(null);
  };

  return (
    <div className={`location-tree ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Locations</h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
      </div>
      
      {/* "All Locations" option */}
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 rounded-md mb-1 ${
          !selectedLocationId ? "bg-blue-100 text-blue-800" : ""
        }`}
        onClick={handleSelectAll}
      >
        <MapPin className="h-4 w-4 mr-2 text-gray-500" />
        <span className="text-sm">All Locations</span>
      </div>
      
      {/* Location tree */}
      {treeData.length > 0 ? (
        <TreeView
          data={treeData}
          onSelect={handleSelectNode}
          selectedId={selectedLocationId}
          icon={<MapPin className="h-4 w-4" />}
          iconOpen={<MapPin className="h-4 w-4" />}
        />
      ) : (
        <div className="text-sm text-gray-500 py-2">No locations found</div>
      )}
    </div>
  );
}
