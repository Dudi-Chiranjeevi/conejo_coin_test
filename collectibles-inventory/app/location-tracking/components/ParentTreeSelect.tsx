"use client";

import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export type LocationType = "site" | "room" | "shelf" | "box" | "row" | "slot";

export interface ParentTreeNode {
  id: string;
  name: string;
  type: LocationType;
  children?: ParentTreeNode[];
}

interface ParentTreeSelectProps {
  value: string | null;
  onChange: (val: string | null) => void;
  roots: ParentTreeNode[];
  allowedParents: Record<LocationType, LocationType[] | null>;
  currentType: LocationType; // type of the location being added/updated
  disabledIds?: string[]; // e.g., self + descendants for Update
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}

export function ParentTreeSelect({
  value,
  onChange,
  roots,
  allowedParents,
  currentType,
  disabledIds = [],
  className = "",
  buttonClassName,
  placeholder = "Select parent",
}: ParentTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // helper
  const isAllowedType = (t: LocationType) => {
    const arr = allowedParents[currentType];
    if (!arr) return false; // null means must be root-only (site), so no parent allowed
    return arr.includes(t);
  };

  const buildAbbrMap = (nodes: ParentTreeNode[]) => {
    const m = new Map<string, string>();
    const walk = (arr: ParentTreeNode[]) => {
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
        if (node.children && node.children.length) walk(node.children);
      }
    };
    walk(nodes);
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

  const abbrMap = useMemo(() => buildAbbrMap(roots), [roots]);

  const nodePathMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const walk = (nodes: ParentTreeNode[], path: string[]) => {
      nodes.forEach((node) => {
        const nextPath = [...path, node.name || ""];
        map.set(node.id, nextPath);
        if (node.children?.length) walk(node.children, nextPath);
      });
    };
    walk(roots, []);
    return map;
  }, [roots]);

  const buildSearchableString = (node: ParentTreeNode) => {
    const name = (node.name || "").toLowerCase();
    const path = (nodePathMap.get(node.id) || []).map((p) => p.toLowerCase());
    const pathInline = path.join(" ");
    const pathArrow = path.join(" -> ");
    const continuous = pathInline.replace(/\s+/g, "");
    return `${name} ${pathInline} ${pathArrow} ${continuous}`;
  };

  const filteredRoots = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roots;
    const tokens = q.split(/\s+/).filter(Boolean);
    const matchTree = (nodes: ParentTreeNode[]): ParentTreeNode[] =>
      nodes
        .map((n) => {
          const kids = n.children ? matchTree(n.children) : [];
          const searchable = buildSearchableString(n);
          const ok = tokens.every((tok) =>
            expandPatterns(tok, abbrMap).some((p) => searchable.includes(p)),
          );
          if (ok || kids.length) {
            return { ...n, children: kids } as ParentTreeNode;
          }
          return null;
        })
        .filter(Boolean) as ParentTreeNode[];
    return matchTree(roots);
  }, [roots, query, abbrMap]);

  const isDisabled = (node: ParentTreeNode) =>
    disabledIds.includes(node.id) ||
    !isAllowedType(node.type) ||
    node.type === "slot";

  const toggleExpand = (id: string, isRoot: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const isOpen = next.has(id);
      if (isOpen) {
        next.delete(id);
      } else {
        // if this is a root, close other roots (single-open-site rule)
        if (isRoot) {
          // close all roots (best effort): easiest is to clear and add this id
          return new Set([id]);
        }
        next.add(id);
      }
      return next;
    });
  };

  const renderNodes = (
    nodes: ParentTreeNode[],
    depth = 0,
    isRootLevel = false,
  ): React.ReactNode => {
    return (
      <ul className="space-y-0.5">
        {nodes.map((node) => {
          const hasChildren = !!node.children && node.children.length > 0;
          const openNode = expanded.has(node.id);
          const disabled = isDisabled(node);
          const indent = {
            paddingLeft: `${depth * 12}px`,
          } as React.CSSProperties;

          return (
            <li key={node.id}>
              <div className="flex items-center" style={indent}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(node.id, isRootLevel)}
                    className="mr-1 text-slate-500 hover:text-slate-700 transition-colors"
                    aria-label={openNode ? "Collapse" : "Expand"}
                  >
                    {openNode ? (
                      <ChevronDown className="h-4 w-4 transition-transform" />
                    ) : (
                      <ChevronRight className="h-4 w-4 transition-transform" />
                    )}
                  </button>
                ) : (
                  <span className="w-4 mr-1" />
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) {
                      if (hasChildren) {
                        toggleExpand(node.id, isRootLevel);
                        return;
                      }
                      toast.error(
                        "Invalid selection. Follow: Site → Room → Shelf → Box → Row → Slot",
                      );
                      return;
                    }
                    onChange(node.id);
                    setOpen(false);
                  }}
                  className={`flex-1 text-left text-sm px-1.5 py-1 rounded-md transition-colors ${
                    disabled
                      ? "text-slate-400 cursor-not-allowed"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium text-slate-900">
                    {node.name}{" "}
                    <span className="text-[10px] text-slate-400">
                      ({node.type})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {(nodePathMap.get(node.id) || []).join(" • ")}
                  </div>
                </button>
              </div>
              {hasChildren &&
                openNode &&
                renderNodes(node.children!, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  const selectedLabel = useMemo(() => {
    if (!value) return placeholder;
    // simple lookup
    const stack: ParentTreeNode[] = [...roots];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === value) return `${n.name} (${n.type})`;
      if (n.children) stack.push(...n.children);
    }
    return placeholder;
  }, [value, roots, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span
            className={`truncate ${!value ? "text-gray-400" : "text-gray-800"}`}
          >
            {selectedLabel}
          </span>
          <ChevronDown className="h-4 w-4 ml-2 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[60] w-[320px] p-2 rounded-lg shadow-md">
        <Input
          placeholder="Search locations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 h-8 rounded-full"
        />
        <div className="max-h-64 overflow-auto pr-1">
          {renderNodes(filteredRoots, 0, true)}
        </div>
      </PopoverContent>
    </Popover>
  );
}
