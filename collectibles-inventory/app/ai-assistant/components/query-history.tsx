"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Star,
  StarOff,
  Play,
  Trash2,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { QueryHistoryItem } from "../types/ai-assistant";

interface QueryHistoryProps {
  onQueryRerun: (query: string) => void;
}

const mockQueryHistory: QueryHistoryItem[] = [
  {
    id: "1",
    query: "What's my total inventory value?",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    resultType: "summary",
    isFavorited: true,
    processingTime: "0.5s",
    resultPreview: "$2,847,350 total value",
    confidence: "high",
  },
  {
    id: "2",
    query: "Show coins graded MS-70",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    resultType: "table",
    isFavorited: false,
    processingTime: "1.2s",
    resultPreview: "23 items found",
    confidence: "high",
  },
  {
    id: "3",
    query: "Which locations have the most valuable items?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    resultType: "chart",
    isFavorited: true,
    processingTime: "0.8s",
    resultPreview: "Vault leads with $1.2M",
    confidence: "high",
  },
  {
    id: "4",
    query: "List all items added this week",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    resultType: "table",
    isFavorited: false,
    processingTime: "1.5s",
    resultPreview: "47 new items",
    confidence: "medium",
  },
  {
    id: "5",
    query: "Average price of Morgan Dollars",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    resultType: "summary",
    isFavorited: true,
    processingTime: "0.7s",
    resultPreview: "$245 average price",
    confidence: "high",
  },
];

export function QueryHistory({ onQueryRerun }: QueryHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [historyItems, setHistoryItems] = useState(mockQueryHistory);

  const filteredHistory = historyItems.filter(
    (item) =>
      item.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.resultPreview.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const favoriteItems = filteredHistory.filter((item) => item.isFavorited);
  const recentItems = filteredHistory.filter((item) => !item.isFavorited);

  const toggleFavorite = (id: string) => {
    setHistoryItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isFavorited: !item.isFavorited } : item,
      ),
    );
  };

  const deleteQuery = (id: string) => {
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - time.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getResultTypeIcon = (type: string) => {
    switch (type) {
      case "chart":
        return "📊";
      case "table":
        return "📋";
      case "summary":
        return "📄";
      case "value":
        return "💰";
      default:
        return "📋";
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "text-green-600";
      case "medium":
        return "text-softGold";
      case "low":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const groupByDate = (items: QueryHistoryItem[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups = {
      today: [] as QueryHistoryItem[],
      yesterday: [] as QueryHistoryItem[],
      thisWeek: [] as QueryHistoryItem[],
      older: [] as QueryHistoryItem[],
    };

    items.forEach((item) => {
      const itemDate = new Date(item.timestamp);
      if (itemDate >= today) {
        groups.today.push(item);
      } else if (itemDate >= yesterday) {
        groups.yesterday.push(item);
      } else if (itemDate >= thisWeek) {
        groups.thisWeek.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  };

  const renderHistoryItem = (item: QueryHistoryItem) => (
    <div
      key={item.id}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="text-lg flex-shrink-0 mt-1">
        {getResultTypeIcon(item.resultType)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.query}</p>
            <p className="text-xs text-gray-500 mt-1">{item.resultPreview}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(item.timestamp)}</span>
              <span>•</span>
              <span>{item.processingTime}</span>
              <span className={getConfidenceColor(item.confidence)}>
                • {item.confidence}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleFavorite(item.id)}
            >
              {item.isFavorited ? (
                <Star className="w-3 h-3 text-softGold fill-current" />
              ) : (
                <StarOff className="w-3 h-3 text-gray-400" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onQueryRerun(item.query)}
            >
              <Play className="w-3 h-3 text-blue-500" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => deleteQuery(item.id)}
            >
              <Trash2 className="w-3 h-3 text-red-500" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const groupedRecentItems = groupByDate(recentItems);

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Query History
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search query history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {/* Favorites Section */}
            {favoriteItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-softGold fill-current" />
                  <h3 className="font-semibold text-sm">Favorites</h3>
                  <Badge variant="secondary" className="text-xs">
                    {favoriteItems.length}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {favoriteItems.map(renderHistoryItem)}
                </div>
                <Separator className="my-4" />
              </div>
            )}

            {/* Recent Queries */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Recent Queries</h3>
                <Badge variant="secondary" className="text-xs">
                  {recentItems.length}
                </Badge>
              </div>

              {/* Today */}
              {groupedRecentItems.today.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    Today
                  </h4>
                  <div className="space-y-1">
                    {groupedRecentItems.today.map(renderHistoryItem)}
                  </div>
                </div>
              )}

              {/* Yesterday */}
              {groupedRecentItems.yesterday.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    Yesterday
                  </h4>
                  <div className="space-y-1">
                    {groupedRecentItems.yesterday.map(renderHistoryItem)}
                  </div>
                </div>
              )}

              {/* This Week */}
              {groupedRecentItems.thisWeek.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    This Week
                  </h4>
                  <div className="space-y-1">
                    {groupedRecentItems.thisWeek.map(renderHistoryItem)}
                  </div>
                </div>
              )}

              {/* Older */}
              {groupedRecentItems.older.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    Older
                  </h4>
                  <div className="space-y-1">
                    {groupedRecentItems.older.map(renderHistoryItem)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-gray-500">No queries found</p>
              {searchTerm && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 bg-transparent"
                  onClick={() => setSearchTerm("")}
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
