"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ResultsDisplay } from "./results-display";
import { QuerySuggestions } from "./query-suggestions";
import { FAQManager } from "./faq-manager";
// import { QueryHistory } from "./query-history";
import type { QueryResult } from "../types/ai-assistant";
import { askSQL } from "@/lib/ai";

const placeholders = [
  "Ask about low stock items…",
  "Which room hides the highest value?",
  "Show coins added this week…",
  "How many slots are empty on Shelf 1?",
];

export function AIAssistantInterface() {
  const router = useRouter();
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [faqs, setFaqs] = useState<
    Array<{
      id: number;
      question: string;
      category?: string;
      usepie?: boolean;
      usebar?: boolean;
    }>
  >([]);
  const [viewMode, setViewMode] = useState<"summary" | "table" | "bar" | "pie">(
    "summary",
  );
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false); // In a real app, determined by auth
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>(
    [],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Load recent FAQs (questions only) for the left rail catalog
  useEffect(() => {
    const loadFaqs = async () => {
      try {
        const base = process.env.BACKEND_URL || "https://www.conejocoin.net";
        const res = await fetch(`${base}/api/v1/ai/faqs/latest`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const list = await res.json();
        setFaqs(Array.isArray(list) ? list.slice(0, 10) : []);
      } catch {
        // silently ignore
      }
    };
    loadFaqs();
  }, []);

  const handleQuerySubmit = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setIsLoading(true);

    try {
      // Get the SQL query from the FAQ cache or generate a new one
      const sql = await askSQL(q, { forceRefresh: true });

      // Execute the SQL query against the real database
      let resultData;
      let resultType: "table" | "summary" | "chart" = "table";

      try {
        // Call the backend to execute the SQL query
        const response = await fetch(
          `${
            process.env.BACKEND_URL || "https://www.conejocoin.net"
          }/api/v1/ai/execute-sql`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql }),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Error executing SQL: ${response.statusText}`);
        }

        const result = await response.json();

        // Determine the result type based on the response
        if (result.columns && result.data) {
          // This is a table result
          resultType = "table";
          resultData = {
            columns: result.columns,
            data: result.data,
            totalRows: result.totalRows || result.data.length,
          };
        } else if (result.labels && result.datasets) {
          // This is a chart result
          resultType = "chart";
          resultData = result;
        } else {
          // Default to showing a summary with the SQL for advanced users
          resultType = "summary";
          resultData = {
            text: sql,
            ...result.summary,
          };
        }
      } catch (sqlError: any) {
        console.error("Error executing SQL:", sqlError);
        // If SQL execution fails, show the SQL as a summary
        resultType = "summary";
        resultData = {
          text: sql,
          error: sqlError?.message || "Error executing SQL query",
        };
      }

      const result: QueryResult = {
        id: Date.now().toString(),
        query: q,
        type: resultType,
        data: resultData,
        processingTime: "0.8s",
        confidence: "high",
        timestamp: new Date().toISOString(),
      };
      setCurrentResult(result);

      // light local history (optional)
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: q },
        { role: "assistant", content: JSON.stringify(resultData) || "" },
      ];
    } catch (e: any) {
      setCurrentResult({
        id: Date.now().toString(),
        query: q,
        type: "summary",
        data: { text: `Error: ${e?.message || "failed generating results"}` },
        processingTime: "",
        confidence: "low",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryRerun = (query: string) => handleQuerySubmit(query);

  const handleSubmit = () => handleQuerySubmit(input);

  // Persist inferred/view-chosen chart hints to FAQ cache
  const persistChartHint = async (
    question: string,
    opts: { usebar?: boolean; usepie?: boolean },
  ) => {
    try {
      const base = process.env.BACKEND_URL || "https://www.conejocoin.net";
      await fetch(`${base}/api/v1/ai/faqs/flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question, ...opts }),
      });
    } catch {
      // ignore failures silently
    }
  };

  // Decide if the current result supports bar/pie viz
  const canChart = (r: QueryResult | null) => {
    if (!r) return { bar: false, pie: false };
    if (r.type === "chart") {
      const ds = Array.isArray((r.data as any)?.datasets)
        ? (r.data as any).datasets[0]
        : null;
      const vals = Array.isArray(ds?.data) ? ds.data : [];
      const sum = vals.reduce(
        (a: number, b: number) => a + (Number(b) || 0),
        0,
      );
      const pie = sum > 0 && Math.abs(sum - 100) < 0.5;
      return { bar: vals.length > 0, pie };
    }
    if (r.type === "table") {
      const cols = (r.data as any)?.columns;
      const rows = (r.data as any)?.data;
      if (
        Array.isArray(cols) &&
        Array.isArray(rows) &&
        cols.length === 2 &&
        rows.length > 0
      ) {
        const numeric = rows.every(
          (row: any[]) =>
            typeof row?.[1] === "number" || !isNaN(Number(row?.[1])),
        );
        if (numeric) {
          const vals = rows.map((row: any[]) => Number(row?.[1]));
          const sum = vals.reduce((a, b) => a + b, 0);
          const pie = sum > 0 && Math.abs(sum - 100) < 0.5;
          return { bar: true, pie };
        }
      }
    }
    return { bar: false, pie: false };
  };

  // Auto-pick initial view when results change
  useEffect(() => {
    const { bar, pie } = canChart(currentResult);
    if (pie) {
      setViewMode("pie");
      if (currentResult?.query)
        persistChartHint(currentResult.query, { usepie: true });
    } else if (bar) {
      setViewMode("bar");
      if (currentResult?.query)
        persistChartHint(currentResult.query, { usebar: true });
    } else if (currentResult?.type === "table") setViewMode("table");
    else setViewMode("summary");
  }, [currentResult?.id]);

  // Build simple chart data from a 2-column table result
  const deriveChart = () => {
    if (!currentResult) return null;
    if (currentResult.type === "chart") return currentResult.data;
    const cols = (currentResult.data as any)?.columns;
    const rows = (currentResult.data as any)?.data;
    if (Array.isArray(cols) && Array.isArray(rows) && cols.length === 2) {
      const labels = rows.map((r: any[]) => String(r?.[0]));
      const values = rows.map((r: any[]) => Number(r?.[1] ?? 0));
      return { labels, datasets: [{ label: cols[1], data: values }] };
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-white text-neutral-800">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-24 pt-8">
        <section className="text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="ghost"
                className="text-sky-600 hover:text-sky-700 hover:bg-transparent"
                size="icon"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-semibold tracking-tight">
                AI Inventory Assistant
              </h1>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                onClick={() => router.push("/settings")}
              >
                Admin
              </Button>
            )}
          </div>
          <p className="text-sm font-medium text-neutral-600 mt-2">
            Clarity, On Demand.
          </p>
        </section>

        <div className="grid grid-cols-12 gap-6">
          {/* Left rail (collapsible) */}
          <aside
            className={
              leftOpen
                ? "col-span-12 md:col-span-4 transition-all"
                : "col-span-12 md:col-span-1 transition-all"
            }
          >
            <Card className="rounded-xl border border-neutral-200 bg-white">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-700">
                    Tools
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLeftOpen((v) => !v)}
                  >
                    {leftOpen ? (
                      <ChevronLeft className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {leftOpen && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        placeholder={placeholders[placeholderIndex]}
                        className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                      />
                      <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800"
                      >
                        Ask
                      </Button>
                    </div>

                    <details className="group" open>
                      <summary className="cursor-pointer text-sm font-medium text-neutral-700">
                        Quick Suggestions
                      </summary>
                      <div className="mt-3">
                        <QuerySuggestions onQuerySelect={handleQuerySubmit} />
                      </div>
                    </details>

                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-neutral-700">
                        FAQ Catalog
                      </summary>
                      <div className="mt-3 rounded-xl border border-neutral-200 bg-white overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Question</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {faqs.map((f) => (
                              <TableRow
                                key={f.id}
                                className="cursor-pointer hover:bg-neutral-50"
                                onClick={() => {
                                  if (f.usepie) setViewMode("pie");
                                  else if (f.usebar) setViewMode("bar");
                                  handleQuerySubmit(f.question);
                                }}
                              >
                                <TableCell className="text-sm text-neutral-800">
                                  {f.question}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Right canvas */}
          <main
            className={
              leftOpen
                ? "col-span-12 md:col-span-8 transition-all"
                : "col-span-12 md:col-span-11 transition-all"
            }
          >
            <Card className="rounded-xl border border-neutral-200 bg-white">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {currentResult ? "Story" : "Awaiting query"}
                  </div>
                  {currentResult && (
                    <Badge className="rounded-full bg-neutral-100 text-neutral-700">
                      Updated
                    </Badge>
                  )}
                </div>

                {currentResult && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={viewMode === "summary" ? "default" : "outline"}
                      onClick={() => setViewMode("summary")}
                    >
                      Summary
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === "table" ? "default" : "outline"}
                      onClick={() => setViewMode("table")}
                    >
                      Table
                    </Button>
                    {canChart(currentResult).bar && (
                      <Button
                        size="sm"
                        variant={viewMode === "bar" ? "default" : "outline"}
                        onClick={() => {
                          setViewMode("bar");
                          persistChartHint(currentResult!.query, {
                            usebar: true,
                          });
                        }}
                      >
                        Bar
                      </Button>
                    )}
                    {canChart(currentResult).pie && (
                      <Button
                        size="sm"
                        variant={viewMode === "pie" ? "default" : "outline"}
                        onClick={() => {
                          setViewMode("pie");
                          persistChartHint(currentResult!.query, {
                            usepie: true,
                          });
                        }}
                      >
                        Pie
                      </Button>
                    )}
                  </div>
                )}

                <div>
                  {(!currentResult || viewMode === "summary") && (
                    <ResultsDisplay
                      result={
                        currentResult && { ...currentResult, type: "summary" }
                      }
                      isLoading={isLoading}
                    />
                  )}
                  {currentResult && viewMode === "table" && (
                    <ResultsDisplay
                      result={{ ...currentResult, type: "table" }}
                      isLoading={isLoading}
                    />
                  )}
                  {currentResult &&
                    (viewMode === "bar" || viewMode === "pie") && (
                      <ResultsDisplay
                        result={{
                          ...currentResult,
                          type: "chart",
                          data: {
                            ...(deriveChart() ?? currentResult.data),
                            kind: viewMode === "pie" ? "pie" : "bar",
                          },
                        }}
                        isLoading={isLoading}
                      />
                    )}
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
