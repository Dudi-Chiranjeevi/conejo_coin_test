"use client";

import React, { useEffect, useState } from "react";
import { TreeView, TreeNode } from "../../../components/ui/tree-view";
import { useInventory } from "../context/inventory-context";
import { Category } from "../../../lib/services/inventory-service";
import { Tag, Loader2 } from "lucide-react";

interface CategoryTreeProps {
  onSelectCategory: (category: Category | null) => void;
  selectedCategoryId?: string;
  className?: string;
}

export function CategoryTree({
  onSelectCategory,
  selectedCategoryId,
  className = "",
}: CategoryTreeProps) {
  const { categories, fetchCategories, isLoading } = useInventory();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

  // Convert flat categories to hierarchical structure
  useEffect(() => {
    // First, create a map of all categories by ID
    const categoryMap = new Map<string, Category & { children: Category[] }>();
    
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });
    
    // Then build the tree structure
    const rootCategories: TreeNode[] = [];
    
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;
      
      if (!category.parent) {
        // This is a root category
        rootCategories.push(categoryWithChildren);
      } else if (categoryMap.has(category.parent)) {
        // Add as child to parent category
        const parent = categoryMap.get(category.parent)!;
        parent.children.push(categoryWithChildren);
      } else {
        // Parent not found, add to root
        rootCategories.push(categoryWithChildren);
      }
    });
    
    setTreeData(rootCategories);
  }, [categories]);

  // Handle category selection
  const handleSelectNode = (node: TreeNode) => {
    const selectedCategory = categories.find(c => c.id === node.id);
    if (selectedCategory) {
      onSelectCategory(selectedCategory);
    }
  };

  // Handle "All Categories" selection
  const handleSelectAll = () => {
    onSelectCategory(null);
  };

  return (
    <div className={`category-tree ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Categories</h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
      </div>
      
      {/* "All Categories" option */}
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 rounded-md mb-1 ${
          !selectedCategoryId ? "bg-blue-100 text-blue-800" : ""
        }`}
        onClick={handleSelectAll}
      >
        <Tag className="h-4 w-4 mr-2 text-gray-500" />
        <span className="text-sm">All Categories</span>
      </div>
      
      {/* Category tree */}
      {treeData.length > 0 ? (
        <TreeView
          data={treeData}
          onSelect={handleSelectNode}
          selectedId={selectedCategoryId}
          icon={<Tag className="h-4 w-4" />}
          iconOpen={<Tag className="h-4 w-4" />}
        />
      ) : (
        <div className="text-sm text-gray-500 py-2">No categories found</div>
      )}
    </div>
  );
}
