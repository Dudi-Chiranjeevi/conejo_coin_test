"use client";

import type React from "react";
import { useRef, useState } from "react";
import {
  Package,
  Map,
  MapPin,
  Shield,
  ShoppingCart,
  Bot,
  BarChart3,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "../../auth/types/auth";
import { useRBAC } from "@/app/auth/hooks/use-rbac";
import FloatingChatWidget from "@/app/ai-assistant/components/floating-chat-widget";
import { Settings as SettingsIcon } from "lucide-react";

// Theme variables (override via CSS variables without editing this file)
const THEME = {
  pageBg: "var(--neutral-bg, #f5f5f5)",
  headerBg: "transparent",
  headerBorder: "transparent",
  sidebarBg: "#0d0c0b",
  tileBg: "#ffffff",
  tileHoverRing: "var(--accent-lime, #f5ed31)",
  font: "var(--dashboard-font, var(--font-urbanist, Urbanist, system-ui, sans-serif))",
};

const SOFT_YELLOW = "rgba(245, 237, 49, 0.92)";

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

interface NavigationTile {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  active: boolean; // false => dull/locked
  bgColor?: string;
  imageUrl?: string;
  textTone?: "light" | "dark";
  eyebrow?: string;
}

export function Dashboard({ user, onLogout, onNavigate }: DashboardProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tileRefs = useRef<Array<HTMLDivElement | null>>([]);
  const { hasPermission } = useRBAC();

  // Dashboard tiles - 6 blocks for 3x2 grid with yellow accent theme
  const mainTiles: NavigationTile[] = [
    {
      id: "inventory",
      title: "Inventory",
      description:
        "Review holdings, add new lots, and monitor appraisal-ready coins.",
      icon: Package,
      path: "/inventory-management",
      active: hasPermission("inventory", "view"),
      bgColor: SOFT_YELLOW,
      textTone: "dark",
      eyebrow: "Core",
    },
    {
      id: "locations",
      title: "Locations",
      description: "Track rooms, shelves, and slot utilization at a glance.",
      icon: MapPin,
      path: "/location-tracking",
      active: hasPermission("locations", "view"),
      bgColor: SOFT_YELLOW,
      imageUrl: "/bg.png",
      textTone: "dark",
      eyebrow: "Logistics",
    },
    {
      id: "ngc",
      title: "NGC Entry",
      description: "Fast intake flows for newly certified coins from NGC.",
      icon: Shield,
      path: "/ngc-integration",
      active: hasPermission("inventory", "create"),
      bgColor: SOFT_YELLOW,
      textTone: "dark",
      eyebrow: "Automation",
    },
    {
      id: "reports",
      title: "Reports",
      description: "Portfolio, insurance, and activity summaries in one click.",
      icon: BarChart3,
      path: "/reports",
      active: hasPermission("reports", "view"),
      bgColor: SOFT_YELLOW,
      imageUrl: "/bg.png",
      textTone: "dark",
      eyebrow: "Insights",
    },
    {
      id: "ebay",
      title: "Ebay",
      description: "Push curated listings and sync sale statuses.",
      icon: ShoppingCart,
      path: "/ebay-integration",
      active: hasPermission("inventory", "edit"),
      bgColor: SOFT_YELLOW,
      textTone: "dark",
      eyebrow: "Market",
    },
    {
      id: "ai",
      title: "AI Assistant",
      description: "Ask for SQL, pricing estimates, or quick summaries.",
      icon: Bot,
      path: "/ai-assistant",
      active: true, // AI assistant is available to all authenticated users
      bgColor: SOFT_YELLOW,
      imageUrl: "/bg.png",
      textTone: "dark",
      eyebrow: "Intelligence",
    },
  ];

  const introTile = mainTiles[hoveredIndex ?? focusedIndex] || mainTiles[0];

  return (
    <div
      className="min-h-screen grid grid-rows-[auto_1fr]"
      style={{ backgroundColor: THEME.pageBg, fontFamily: THEME.font }}
    >
      <header className="grid grid-cols-1 md:grid-cols-[30%_1fr]">
        <div
          className="h-16 md:h-20 flex items-center px-6 md:px-10"
          style={{ backgroundColor: THEME.sidebarBg }}
        >
          <h1 className="text-2xl font-medium text-white tracking-wide">
            CONEJO COINS
          </h1>
        </div>
        <div className="h-16 md:h-20 flex items-center justify-end px-6 md:px-10 bg-white/55 backdrop-blur-2xl">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onNavigate("/user-guide")}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Open user guide"
            >
              <Map className="h-5 w-5" />
            </button>
            <button
              onClick={() => onNavigate("/settings")}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Open settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-black/5"
                  style={{ color: "var(--neutral-ink, #0d0c0b)" }}
                >
                  <Avatar className="h-8 w-8 border border-black/10">
                    <AvatarImage
                      src={user.avatar || "/placeholder.svg"}
                      alt={user.firstName}
                    />
                    <AvatarFallback
                      className="bg-black/5"
                      style={{ color: "var(--neutral-ink, #0d0c0b)" }}
                    >
                      {user?.firstName
                        ? user.firstName.charAt(0)
                        : user?.email?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left leading-tight">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--neutral-ink, #0d0c0b)" }}
                    >
                      {user?.firstName || user?.email || "User"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user?.role || "Member"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-white border border-black/10"
              >
                <DropdownMenuItem
                  className="hover:bg-black/5"
                  onClick={() => onNavigate("/settings?tab=profile")}
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[30%_1fr] grid-rows-[auto_1fr] md:grid-rows-1 min-h-0">
        <aside
          className="px-6 md:px-10 py-8 md:py-10 text-white min-h-0 overflow-y-auto max-h-[45vh] md:max-h-none"
          style={{ backgroundColor: THEME.sidebarBg }}
        >
          <div className="space-y-3">
            {introTile?.eyebrow && (
              <p className="uppercase tracking-[0.3em] text-xs text-white/60">
                {introTile.eyebrow}
              </p>
            )}
            <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
              {introTile?.title}
            </h2>
            <p className="text-sm text-white/80 max-w-sm leading-relaxed">
              {introTile?.description}
            </p>
            {!introTile?.active && (
              <p className="text-xs text-white/60">Access restricted.</p>
            )}
          </div>
        </aside>

        <main
          className="relative overflow-hidden min-h-0"
          style={{ backgroundColor: THEME.pageBg }}
        >
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1" />
            <div className="h-[62%] w-full p-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2 gap-0 w-full h-full p-0">
                {mainTiles.map((tile, idx) => {
                  const disabled = !tile.active;
                  const textClass =
                    tile.textTone === "light"
                      ? "text-white"
                      : "text-neutral-900";

                  const tileBg = tile.bgColor || "#ffffff";
                  const tileBgImage = tile.imageUrl
                    ? `linear-gradient(${tileBg}, ${tileBg}), url(${tile.imageUrl})`
                    : undefined;

                  const Icon = tile.icon;
                  return (
                    <Card
                      key={tile.id}
                      ref={(el) => {
                        tileRefs.current[idx] = el;
                      }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => !disabled && onNavigate(tile.path)}
                      onFocus={() => setFocusedIndex(idx)}
                      onKeyDown={(e) => {
                        const cols = 3;
                        const len = mainTiles.length;
                        const rows = Math.ceil(len / cols);

                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!disabled) onNavigate(tile.path);
                          return;
                        }

                        let nextRow = Math.floor(idx / cols);
                        let nextCol = idx % cols;

                        if (e.key === "ArrowRight") nextCol += 1;
                        else if (e.key === "ArrowLeft") nextCol -= 1;
                        else if (e.key === "ArrowDown") nextRow += 1;
                        else if (e.key === "ArrowUp") nextRow -= 1;
                        else return;

                        e.preventDefault();
                        if (nextCol < 0 || nextCol >= cols) return;
                        if (nextRow < 0 || nextRow >= rows) return;
                        const next = nextRow * cols + nextCol;
                        if (next < 0 || next >= len) return;
                        setFocusedIndex(next);
                        window.requestAnimationFrame(() => {
                          tileRefs.current[next]?.focus();
                        });
                      }}
                      tabIndex={idx === focusedIndex ? 0 : -1}
                      role="button"
                      aria-disabled={disabled}
                      aria-label={tile.title}
                      className={[
                        "rounded-none border border-black/10 overflow-hidden transition-all h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
                        disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:-translate-y-1 hover:shadow-soft",
                      ].join(" ")}
                      style={{
                        backgroundColor: tileBg,
                        backgroundImage: tileBgImage,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <CardContent className="p-4 h-full flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {tile.eyebrow && (
                              <p className="text-[10px] uppercase tracking-[0.3em] text-black/60">
                                {tile.eyebrow}
                              </p>
                            )}
                            <h3
                              className={`text-sm font-semibold ${textClass}`}
                            >
                              {tile.title}
                            </h3>
                          </div>
                          <Icon
                            size={18}
                            className="flex-shrink-0"
                            style={{
                              color:
                                tile.textTone === "light"
                                  ? "#f8fafc"
                                  : "var(--neutral-ink, #0d0c0b)",
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      <FloatingChatWidget variant="floating" anchor="left" />
    </div>
  );
}
