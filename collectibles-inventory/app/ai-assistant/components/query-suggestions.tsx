"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuerySuggestion } from "../types/ai-assistant";

interface QuerySuggestionsProps {
  onQuerySelect: (query: string) => void;
}

const suggestedQueries: QuerySuggestion[] = [
  {
    id: "1",
    text: "What's my total inventory value by category?",
    resultType: "chart",
    category: "Overview",
    description:
      "View breakdown of inventory value across different categories",
  },
  {
    id: "2",
    text: "How many platinum coins are in Box 2B?",
    resultType: "table",
    category: "Location",
    description: "Get specific location inventory counts",
  },
  {
    id: "3",
    text: "What's the average price of 1880-S Morgan Dollars?",
    resultType: "value",
    category: "Pricing",
    description: "Calculate average pricing for specific items",
  },
  {
    id: "4",
    text: "Show me all items added this week",
    resultType: "table",
    category: "Recent",
    description: "View recently added inventory items",
  },
  {
    id: "5",
    text: "Which locations have the most valuable items?",
    resultType: "chart",
    category: "Analysis",
    description: "Analyze value distribution across locations",
  },
  {
    id: "6",
    text: "List all NGC graded coins above MS-65",
    resultType: "table",
    category: "Grading",
    description: "Filter items by grading criteria",
  },
  {
    id: "7",
    text: "What's my inventory growth this month?",
    resultType: "chart",
    category: "Overview",
    description: "Track inventory growth trends",
  },
  {
    id: "8",
    text: "Find items with missing location data",
    resultType: "table",
    category: "Location",
    description: "Identify data quality issues",
  },
  // {
  //   id: "9",
  //   text: "Compare prices with recent eBay sales",
  //   icon: "💲",
  //   resultType: "table",
  //   category: "Pricing",
  //   description: "Market comparison analysis",
  // },
];

export function QuerySuggestions({ onQuerySelect }: QuerySuggestionsProps) {
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = [
    "All",
    "Overview",
    "Location",
    "Pricing",
    "Analysis",
    "Recent",
    "Grading",
  ];

  const filteredQueries =
    activeCategory === "All"
      ? suggestedQueries
      : suggestedQueries.filter((q) => q.category === activeCategory);

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="p-0 space-y-4">
        <div className="text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
            Try asking
          </p>
          <h2 className="font-semibold text-lg text-ink">Smart suggestions</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                activeCategory === category
                  ? "bg-[#5849ff] text-white shadow"
                  : "bg-white text-ink/60 border border-ink/10 hover:border-[#5849ff]/40 hover:text-ink"
              )}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {filteredQueries.map((query) => (
            <button
              key={query.id}
              onClick={() => onQuerySelect(query.text)}
              className="group w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left text-sm text-ink/80 hover:-translate-y-0.5 hover:border-[#5849ff]/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5849ff]/40 md:w-[calc(50%-0.75rem)]"
            >
              <p className="font-medium text-ink/90">{query.text}</p>
              {query.description && (
                <p className="text-xs text-ink/60 mt-1">{query.description}</p>
              )}
            </button>
          ))}
        </div>

        {filteredQueries.length === 0 && (
          <div className="text-center py-8 text-ink/60">
            <div className="text-4xl mb-2">🔍</div>
            <p className="font-medium">No prompts for this filter yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
