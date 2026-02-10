"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  Category, 
  Location, 
  InventoryStats,
  categoryApi, 
  locationApi
} from "../../../lib/services/inventory-service";
import { inventoryApi } from "../services/api";
import { InventoryItem } from "../types/inventory";

interface InventoryContextType {
  // Data
  categories: Category[];
  locations: Location[];
  inventoryItems: InventoryItem[];
  selectedItem: InventoryItem | null;
  stats: InventoryStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Client ID (would come from user context in a real app)
  clientId: string;
  
  // Filter state
  filters: {
    category?: string;
    location?: string;
    status?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    hasImages?: boolean;
  };
  
  // Actions
  setFilters: (filters: any) => void;
  fetchCategories: () => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchInventoryItems: () => Promise<void>;
  fetchItemById: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  createItem: (item: Partial<InventoryItem>) => Promise<InventoryItem>;
  updateItem: (id: string, item: Partial<InventoryItem>) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
  updateItemStatus: (id: string, status: string, notes?: string) => Promise<InventoryItem>;
  bulkUpdateStatus: (itemIds: string[], status: string, notes?: string) => Promise<{ success: boolean, updated: number }>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

interface InventoryProviderProps {
  children: ReactNode;
  initialClientId?: string;
}

export const InventoryProvider = ({ 
  children, 
  initialClientId = "default-client-id" // This would come from auth in a real app
}: InventoryProviderProps) => {
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(initialClientId);
  const [filters, setFilters] = useState<InventoryContextType["filters"]>({});

  // Fetch categories
  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await categoryApi.getAll(clientId);
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch categories");
      console.error("Error fetching categories:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch locations
  const fetchLocations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await locationApi.getAll(clientId);
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch locations");
      console.error("Error fetching locations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch inventory items with filters
  const fetchInventoryItems = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params: Record<string, string> = { client_id: clientId };
      
      // Add filters to params
      if (filters.category) params.category = filters.category;
      if (filters.location) params.location = filters.location;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.minPrice) params.min_price = filters.minPrice.toString();
      if (filters.maxPrice) params.max_price = filters.maxPrice.toString();
      if (filters.hasImages) params.has_images = "true";
      
      const response = await inventoryApi.getItems(params);
      const data = response.results;
      setInventoryItems(data as InventoryItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch inventory items");
      console.error("Error fetching inventory items:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch a single inventory item by ID
  const fetchItemById = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await inventoryApi.getItem(id);
      setSelectedItem(data as InventoryItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch inventory item");
      console.error("Error fetching inventory item:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch inventory statistics
  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await inventoryApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch inventory stats");
      console.error("Error fetching inventory stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new inventory item
  const createItem = async (item: Partial<InventoryItem>): Promise<InventoryItem> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Ensure client_id is set
      const itemWithClient = { ...item, client_id: clientId } as any;
      const data = await inventoryApi.createItem(itemWithClient);
      
      // Update the items list with the new item
      setInventoryItems(prev => [...prev, data]);
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create inventory item");
      console.error("Error creating inventory item:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update an existing inventory item
  const updateItem = async (id: string, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await inventoryApi.updateItem(id, item as any);
      
      // Update the items list with the updated item
      setInventoryItems(prev => 
        prev.map(i => i.id === id ? (data as InventoryItem) : i)
      );
      
      // Update selected item if it's the one being edited
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem(data);
      }
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update inventory item");
      console.error("Error updating inventory item:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an inventory item
  const deleteItem = async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await inventoryApi.deleteItem(id);
      
      // Remove the item from the list
      setInventoryItems(prev => 
        prev.filter(i => i.id !== id)
      );
      
      // Clear selected item if it's the one being deleted
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete inventory item");
      console.error("Error deleting inventory item:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update an item's status
  const updateItemStatus = async (id: string, status: string, notes?: string): Promise<InventoryItem> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await inventoryApi.updateItemStatus(id, status);
      
      // Update the items list with the updated item
      setInventoryItems(prev => 
        prev.map(i => i.id === id ? { ...i, status: status as InventoryItem['status'] } : i)
      );
      
      // Update selected item if it's the one being edited
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem({ ...selectedItem, status: status as InventoryItem['status'] });
      }
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item status");
      console.error("Error updating item status:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk update status for multiple items
  const bulkUpdateStatus = async (itemIds: string[], status: string, notes?: string): Promise<{ success: boolean, updated: number }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await inventoryApi.bulkUpdateStatus(itemIds, status);
      
      // Update the items list with the updated status
      if (result.success) {
        setInventoryItems(prev => 
          prev.map(i => itemIds.includes(i.id) ? { ...i, status: status as InventoryItem['status'] } : i)
        );
        
        // Update selected item if it's one of the ones being updated
        if (selectedItem && itemIds.includes(selectedItem.id)) {
          setSelectedItem({ ...selectedItem, status: status as InventoryItem['status'] });
        }
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk update status");
      console.error("Error bulk updating status:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchCategories();
    fetchLocations();
    fetchInventoryItems();
    fetchStats();
  }, [clientId]);

  // Reload inventory items when filters change
  useEffect(() => {
    fetchInventoryItems();
  }, [filters]);

  const value = {
    categories,
    locations,
    inventoryItems,
    selectedItem,
    stats,
    isLoading,
    error,
    clientId,
    filters,
    setFilters,
    fetchCategories,
    fetchLocations,
    fetchInventoryItems,
    fetchItemById,
    fetchStats,
    createItem,
    updateItem,
    deleteItem,
    updateItemStatus,
    bulkUpdateStatus,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
};
