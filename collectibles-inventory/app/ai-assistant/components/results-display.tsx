"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Share2, Star } from "lucide-react";
import type { QueryResult, TableData, ChartData } from "../types/ai-assistant";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ResultsDisplayProps {
  result: QueryResult | null;
  isLoading?: boolean;
}

function getConfidenceBadge(confidence?: string) {
  switch (confidence) {
    case "high":
      return "bg-goldYellow/20 text-ink border border-goldYellow/40";
    case "medium":
      return "bg-vividOrange/20 text-ink border border-vividOrange/40";
    case "low":
      return "bg-red-100 text-red-800 border border-red-200";
    default:
      return "bg-gray-100 text-ink border border-gray-200";
  }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}
function fmtNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function ResultsDisplay({ result, isLoading }: ResultsDisplayProps) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-goldYellow border-t-transparent rounded-full animate-spin" />
              <p className="text-ink/70 font-urbanist">
                Processing your query…
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2 text-ink font-urbanist">
              Ready to help
            </h3>
            <p className="text-ink/70 font-urbanist">
              Ask me anything about your inventory. I'll return tables or charts
              depending on your request.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full animate-in slide-in-from-bottom-4 duration-300 border-0 shadow-none bg-transparent">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2 text-ink font-urbanist">
              {result.query}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink/70">
              {!!result.processingTime && (
                <span className="font-urbanist">
                  Processed in {result.processingTime}
                </span>
              )}
              {!!result.confidence && (
                <Badge
                  className={`${getConfidenceBadge(
                    result.confidence
                  )} font-medium px-2.5 py-0.5 rounded-full text-xs`}
                >
                  {result.confidence} confidence
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-xs border-goldYellow/30 text-ink"
              >
                {result.type === "table"
                  ? "📋"
                  : result.type === "chart"
                  ? "📊"
                  : "📄"}{" "}
                {result.type}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-goldYellow/30 text-ink hover:bg-goldYellow/10 hover:text-ink"
            >
              <Star className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-goldYellow/30 text-ink hover:bg-goldYellow/10 hover:text-ink"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-goldYellow/30 text-ink hover:bg-goldYellow/10 hover:text-ink"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Table */}
        {result.type === "table" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/30 bg-white/60 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-lightBorder/70">
                    {(result.data as TableData).columns.map((col, i) => (
                      <TableHead key={i} className="font-semibold text-ink">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result.data as TableData).data.map((row, r) => (
                    <TableRow
                      key={r}
                      className="hover:bg-goldYellow/5 border-b border-lightBorder/60"
                    >
                      {row.map((cell, c) => (
                        <TableCell key={c} className="text-ink">
                          {typeof cell === "string" &&
                          /^\$?\d[\d,]*\.?\d*$/.test(cell) ? (
                            <span className="font-medium text-vividOrange">
                              {cell}
                            </span>
                          ) : (
                            cell
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between items-center text-sm text-ink/70 font-urbanist mt-2">
              <span>
                {(result.data as TableData).data.length} of{" "}
                {(result.data as TableData).totalRows ??
                  (result.data as TableData).data.length}{" "}
                rows
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="border-goldYellow/30 text-ink hover:bg-goldYellow/10 hover:text-ink disabled:opacity-50"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="border-goldYellow/30 text-ink hover:bg-goldYellow/10 hover:text-ink disabled:opacity-50"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        {result.type === "chart" && (
          <div className="space-y-4">
            <div className="bg-white/60 rounded-xl border border-white/30 backdrop-blur-sm p-4 h-80">
              {(() => {
                const chart = result.data as ChartData & {
                  kind?: "bar" | "pie";
                };
                const labels = Array.isArray(chart?.labels) ? chart.labels : [];
                const ds =
                  Array.isArray(chart?.datasets) && chart.datasets.length > 0
                    ? chart.datasets[0]
                    : null;
                const values = Array.isArray(ds?.data) ? ds!.data : [];
                const data = labels.map((name, i) => ({
                  name,
                  value: Number(values[i] ?? 0),
                }));
                const COLORS = [
                  "#0ea5e9",
                  "#22c55e",
                  "#eab308",
                  "#ef4444",
                  "#a78bfa",
                  "#f97316",
                  "#38bdf8",
                  "#84cc16",
                  "#f59e0b",
                  "#fb7185",
                ];

                if (!labels.length || !ds) {
                  return (
                    <div className="h-full w-full flex items-center justify-center text-ink/70 font-urbanist">
                      No chart data
                    </div>
                  );
                }

                if (chart.kind === "pie") {
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie
                          data={data}
                          dataKey="value"
                          nameKey="name"
                          label
                          outerRadius={100}
                        >
                          {data.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  );
                }

                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="value"
                        name={ds.label ?? "Value"}
                        fill="#0ea5e9"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        )}

        {/* “Rich” summary cards (keep for future analytics) */}
        {result.type === "summary" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 rounded-xl border border-white/30 bg-white/60 backdrop-blur-sm hover:shadow-md transition-all duration-200">
              <div>
                <p className="text-sm text-ink/70 font-urbanist">Total Items</p>
                <p className="text-2xl font-bold text-ink">
                  {fmtNumber((result.data?.totalItems as number) ?? 0)}
                </p>
              </div>
            </Card>
            <Card className="p-4 rounded-xl border border-white/30 bg-white/60 backdrop-blur-sm hover:shadow-md transition-all duration-200">
              <div>
                <p className="text-sm text-ink/70 font-urbanist">Total Value</p>
                <p className="text-2xl font-bold text-vividOrange">
                  {fmtCurrency((result.data?.totalValue as number) ?? 0)}
                </p>
              </div>
            </Card>
            <Card className="p-4 rounded-xl border border-white/30 bg-white/60 backdrop-blur-sm hover:shadow-md transition-all duration-200">
              <div>
                <p className="text-sm text-ink/70 font-urbanist">Categories</p>
                <p className="text-2xl font-bold text-ink">
                  {result.data?.categories ?? 0}
                </p>
              </div>
            </Card>
            <Card className="p-4 rounded-xl border border-white/30 bg-white/60 backdrop-blur-sm hover:shadow-md transition-all duration-200">
              <div>
                <p className="text-sm text-ink/70 font-urbanist">Locations</p>
                <p className="text-2xl font-bold text-ink">
                  {result.data?.locations ?? 0}
                </p>
              </div>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
