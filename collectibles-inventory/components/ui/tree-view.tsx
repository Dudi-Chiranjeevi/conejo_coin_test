"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  [key: string]: any; // For additional properties
}

interface TreeViewProps {
  data: TreeNode[];
  onSelect: (node: TreeNode) => void;
  selectedId?: string;
  className?: string;
  expandAll?: boolean;
  icon?: React.ReactNode;
  iconOpen?: React.ReactNode;
}

export function TreeView({
  data,
  onSelect,
  selectedId,
  className = "",
  expandAll = false,
  icon = <Folder className="h-4 w-4" />,
  iconOpen = <FolderOpen className="h-4 w-4" />
}: TreeViewProps) {
  return (
    <div className={`tree-view ${className}`}>
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          onSelect={onSelect}
          selectedId={selectedId}
          level={0}
          expandAll={expandAll}
          icon={icon}
          iconOpen={iconOpen}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: TreeNode;
  onSelect: (node: TreeNode) => void;
  selectedId?: string;
  level: number;
  expandAll?: boolean;
  icon: React.ReactNode;
  iconOpen: React.ReactNode;
}

function TreeNode({
  node,
  onSelect,
  selectedId,
  level,
  expandAll,
  icon,
  iconOpen
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(expandAll);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleSelect = () => {
    onSelect(node);
  };

  return (
    <div className="tree-node">
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 rounded-md ${
          isSelected ? "bg-blue-100 text-blue-800" : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        {hasChildren ? (
          <div className="mr-1 cursor-pointer" onClick={handleToggle}>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </div>
        ) : (
          <div className="w-4 mr-1" />
        )}
        <div className="mr-2 text-gray-500">
          {expanded && hasChildren ? iconOpen : icon}
        </div>
        <span className="text-sm">{node.name}</span>
      </div>
      
      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
              level={level + 1}
              expandAll={expandAll}
              icon={icon}
              iconOpen={iconOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
