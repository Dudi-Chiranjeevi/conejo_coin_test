"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, Download } from "lucide-react";
import {
  ParentTreeSelect,
  ParentTreeNode,
  LocationType,
} from "@/app/location-tracking/components/ParentTreeSelect";
import { inventoryApi } from "../services/api";
import axios from "axios";
import { useAuth } from "@/app/auth/context/auth-context";
import { toast } from "sonner";

interface Props {
  clientId?: string;
}

export default function ShelfBulkUpload({ clientId }: Props) {
  const { user } = useAuth();
  const [roots, setRoots] = useState<ParentTreeNode[]>([]);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    ok: boolean;
    accepted: any[];
    errors?: string[];
    summary?: any;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState({
    success: 0,
    duplicates: 0,
    errors: 0,
  });
  const [processedLogs, setProcessedLogs] = useState<
    Array<{
      cert: string;
      status: "success" | "duplicate" | "error";
      message?: string;
    }>
  >([]);
  const [search, setSearch] = useState("");
  const [shelfSuggestOpen, setShelfSuggestOpen] = useState(false);
  const [shelfSuggestions, setShelfSuggestions] = useState<
    Array<{ key: string; label: string; sub?: string }>
  >([]);
  const [shelfHighlight, setShelfHighlight] = useState(0);
  const shelfSuggestRef = useRef<HTMLDivElement | null>(null);

  const validationOutcomes = useMemo(() => {
    if (!uploadResult)
      return [] as Array<{
        key: string;
        status: "ready" | "duplicate" | "error";
        label: string;
        sub?: string;
      }>;
    const out: Array<{
      key: string;
      status: "ready" | "duplicate" | "error";
      label: string;
      sub?: string;
    }> = [];
    const accepted = uploadResult.accepted || [];
    for (const a of accepted) {
      const label = a.cert_num || "(no cert)";
      const sub = [a.box, a.row, a.slot].filter(Boolean).join(" • ");
      out.push({
        key: `ok-${a.slot_id || label}`,
        status: "ready",
        label,
        sub,
      });
    }
    const errs = uploadResult.errors || [];
    for (const e of errs) {
      const rowMatch = /Row\s+(\d+)/i.exec(e);
      const rowLabel = rowMatch ? `Row ${rowMatch[1]}` : "Row ?";
      const isDup = /duplicate|exists/i.test(e);
      out.push({
        key: `err-${rowMatch ? rowMatch[1] : e}`,
        status: isDup ? "duplicate" : "error",
        label: rowLabel,
        sub: e,
      });
    }
    return out;
  }, [uploadResult]);

  const effectiveClientId =
    clientId ||
    (process.env.CLIENT_ID as string) ||
    "e9f3a0d4-0b71-4728-b131-ec7bc71e902d";

  const allowedParents: Record<LocationType, LocationType[] | null> = {
    site: null,
    room: ["site"],
    shelf: ["room"],
    box: ["shelf"],
    row: ["box"],
    slot: ["row"],
  };

  const handleUpload = async (file: File) => {
    if (!selectedShelfId) return;
    try {
      setUploading(true);
      setUploadResult(null);
      const res = await inventoryApi.uploadShelfTemplate(selectedShelfId, file);
      setUploadResult(res);
      if (res.ok) {
        toast.success(`Validated ${res.accepted?.length || 0} rows`);
      } else {
        const first =
          res.errors && res.errors.length > 0 ? ` — ${res.errors[0]}` : "";
        toast.error(`Validation errors found${first}`);
      }
    } catch (e) {
      toast.error("Failed to upload template");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    inventoryApi
      .getLocationTree(effectiveClientId)
      .then((nodes) => {
        if (!mounted) return;
        const toTree = (n: any): ParentTreeNode => ({
          id: n.id,
          name: n.name,
          type: n.type,
          children: (n.children || []).map(toTree),
        });
        setRoots((nodes || []).map(toTree));
      })
      .catch((e) => {
        toast.error("Failed to load locations");
        console.error(e);
      });
    return () => {
      mounted = false;
    };
  }, [effectiveClientId]);

  useEffect(() => {
    if (!selectedShelfId) {
      setPreview(null);
      return;
    }
    setLoading(true);
    inventoryApi
      .getShelfSlots(selectedShelfId)
      .then((data) => setPreview(data))
      .catch((e) => {
        toast.error("Failed to load shelf slots");
        console.error(e);
      })
      .finally(() => setLoading(false));
  }, [selectedShelfId]);

  const dynamicFilename = useMemo(() => {
    if (!preview) return null;
    const site = (preview.site || "").replace(/\s+/g, "");
    const room = (preview.room || "").replace(/\s+/g, "");
    const shelf = (preview.shelf || "").replace(/\s+/g, "");
    return `${site}-${room}-${shelf}.${format}`;
  }, [preview, format]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!preview?.rows) return [] as any[];
    if (!q) return preview.rows;
    return preview.rows.filter((r: any) => {
      const hay = `${r.status} ${r.cert_num || ""} ${r.price || ""} ${r.box} ${
        r.row
      } ${r.slot}`.toLowerCase();
      return hay.includes(q);
    });
  }, [preview, search]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q || !preview?.rows) {
      setShelfSuggestions([]);
      setShelfSuggestOpen(false);
      setShelfHighlight(0);
      return;
    }
    const matches: Array<{ key: string; label: string; sub?: string }> = [];
    for (const r of preview.rows) {
      const label =
        `${r.box || ""} ${r.row || ""} ${r.slot || ""}`.trim() || r.slot || "";
      const sub = `${r.status}${r.cert_num ? ` • ${r.cert_num}` : ""}`;
      const text = `${label} ${sub}`.toLowerCase();
      if (text.includes(q)) {
        matches.push({
          key: `${r.box_id || ""}-${r.row_id || ""}-${r.slot_id || ""}`,
          label,
          sub,
        });
        if (matches.length >= 10) break;
      }
    }
    setShelfSuggestions(matches);
    setShelfSuggestOpen(matches.length > 0);
    setShelfHighlight(0);
  }, [search, preview]);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!shelfSuggestRef.current) return;
      const target = e.target as Node;
      if (!shelfSuggestRef.current.contains(target)) {
        setShelfSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler as any);
    };
  }, []);

  const handleDownload = async () => {
    if (!selectedShelfId) return;
    if (!preview) return;
    if (preview.empty === 0) return;
    try {
      setDownloading(true);
      const blob = await inventoryApi.downloadShelfTemplate(
        selectedShelfId,
        format,
      );
      const url = URL.createObjectURL(new Blob([blob]));
      const a = document.createElement("a");
      a.href = url;
      a.download = dynamicFilename || `shelf-template.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to download template");
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const isShelfFull = !!preview && preview.empty === 0;

  return (
    <Card>
      <CardContent className="pt-2 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Select Shelf (Site → Room → Shelf)
            </div>
            <ParentTreeSelect
              value={selectedShelfId}
              onChange={setSelectedShelfId}
              roots={roots}
              allowedParents={allowedParents}
              currentType={"box" as LocationType}
              placeholder="Select a shelf"
            />
          </div>
          <div className="flex items-end gap-3 md:col-span-2">
            <Button
              onClick={handleDownload}
              disabled={!preview || loading || downloading || isShelfFull}
              className={`bg-sky-600 text-white hover:bg-sky-700 ${
                isShelfFull ? "opacity-50 blur-[0.5px] cursor-not-allowed" : ""
              }`}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading
                ? "Preparing..."
                : `Download Shelf Template (.${format.toUpperCase()})`}
            </Button>
            <Button
              variant="outline"
              onClick={() => setFormat(format === "xlsx" ? "csv" : "xlsx")}
            >
              {format.toUpperCase()}
            </Button>
            {preview && preview.empty === 0 && (
              <div className="text-sm text-red-600">
                This shelf is full. No bulk upload available.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-gray-50 border border-gray-200">
          <Info className="h-4 w-4 text-gray-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            <div>FILLED = cannot edit</div>
            <div>EMPTY = you can insert</div>
            <div>Each row corresponds to one slot</div>
            <div>Do not reorder or modify rows</div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 text-sm text-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              {preview ? (
                <div className="whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  {preview.site} / {preview.room} / {preview.shelf} — Filled:{" "}
                  {preview.filled}, Empty: {preview.empty}, Total:{" "}
                  {preview.total}
                </div>
              ) : (
                <span>Select a shelf to preview slots</span>
              )}
            </div>
            <div className="flex w-full md:w-auto items-center gap-3">
              {dynamicFilename && (
                <div
                  className="text-gray-500 truncate max-w-xs"
                  title={dynamicFilename}
                >
                  Filename: {dynamicFilename}
                </div>
              )}
              <div className="relative w-full md:w-56" ref={shelfSuggestRef}>
                <input
                  placeholder="Search rows..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (!shelfSuggestOpen || shelfSuggestions.length === 0)
                      return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setShelfHighlight(
                        (h) => (h + 1) % shelfSuggestions.length,
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setShelfHighlight(
                        (h) =>
                          (h - 1 + shelfSuggestions.length) %
                          shelfSuggestions.length,
                      );
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const s = shelfSuggestions[shelfHighlight];
                      if (s) {
                        setSearch(s.label);
                        setShelfSuggestOpen(false);
                      }
                    } else if (e.key === "Escape") {
                      setShelfSuggestOpen(false);
                    }
                  }}
                  className="h-8 w-full border border-gray-200 rounded px-2 text-sm"
                />
                {shelfSuggestOpen && shelfSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-sm max-h-64 overflow-auto">
                    {shelfSuggestions.map((s, idx) => (
                      <button
                        key={s.key + idx}
                        type="button"
                        onMouseEnter={() => setShelfHighlight(idx)}
                        onClick={() => {
                          setSearch(s.label);
                          setShelfSuggestOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs ${
                          idx === shelfHighlight ? "bg-gray-50" : "bg-white"
                        }`}
                      >
                        <div className="font-medium text-gray-900 truncate">
                          {s.label}
                        </div>
                        {s.sub ? (
                          <div className="text-[11px] text-gray-500 truncate">
                            {s.sub}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {preview && (
            <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-100">
              Note: FILLED rows are placeholders ('-') and read-only. Only fill
              EMPTY rows. Do not modify STATUS, box, row, or slot.
            </div>
          )}
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead>STATUS</TableHead>
                  <TableHead>cert_num</TableHead>
                  <TableHead>price</TableHead>
                  <TableHead>box</TableHead>
                  <TableHead>row</TableHead>
                  <TableHead>slot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>Loading...</TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filteredRows?.length > 0 &&
                  filteredRows.map((r: any, idx: number) => (
                    <TableRow
                      key={idx}
                      className={
                        r.status === "FILLED" ? "bg-green-50" : "bg-red-50"
                      }
                    >
                      <TableCell className="font-medium">{r.status}</TableCell>
                      <TableCell>
                        {r.cert_num || (r.status === "FILLED" ? "-" : "")}
                      </TableCell>
                      <TableCell>
                        {r.price || (r.status === "FILLED" ? "-" : "")}
                      </TableCell>
                      <TableCell>{r.box}</TableCell>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.slot}</TableCell>
                    </TableRow>
                  ))}
                {!loading && preview && filteredRows?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-gray-500">
                      No slots found for this shelf
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-800 mb-2">
              Upload Shelf Template
            </div>
            <div className="flex items-center gap-3 max-w-full">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                disabled={!selectedShelfId || uploading}
              />
              {uploading && (
                <span className="text-xs text-gray-500">Uploading...</span>
              )}
            </div>
            {!selectedShelfId && (
              <div className="text-xs text-gray-500 mt-1">
                Select a shelf first
              </div>
            )}
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-800 mb-2">
              Validation Result
            </div>
            {!uploadResult && (
              <div className="text-sm text-gray-500">No file uploaded yet</div>
            )}
            {uploadResult && (
              <div className="text-sm">
                <div
                  className={
                    uploadResult.ok ? "text-green-700" : "text-red-700"
                  }
                >
                  {uploadResult.ok ? "OK" : "Errors"}
                </div>
                {!uploadResult.ok &&
                  uploadResult.errors &&
                  uploadResult.errors.length > 0 && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 text-red-800 p-3">
                      <div className="font-medium mb-1">
                        We found {uploadResult.errors.length} issue(s) in your
                        file:
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {uploadResult.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                      <div className="mt-2 text-xs text-red-700">
                        Tip: Do not edit FILLED rows (placeholders). Only add
                        values to EMPTY rows, and keep all columns and order
                        intact.
                      </div>
                    </div>
                  )}
                {uploadResult.summary && (
                  <div className="text-gray-700">
                    To create:{" "}
                    {uploadResult.summary.to_create ??
                      uploadResult.accepted?.length ??
                      0}
                  </div>
                )}
                {validationOutcomes.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600 mb-1">
                      Per-row validation:
                    </div>
                    <div className="max-h-40 overflow-auto border border-gray-100 rounded-md">
                      <ul className="text-xs divide-y">
                        {validationOutcomes.map((v) => (
                          <li
                            key={v.key}
                            className="px-2 py-1 flex items-center gap-2"
                          >
                            <span
                              className={
                                v.status === "ready"
                                  ? "text-emerald-700"
                                  : v.status === "duplicate"
                                    ? "text-sky-700"
                                    : "text-red-700"
                              }
                            >
                              {v.status.toUpperCase()}
                            </span>
                            <span
                              className="text-gray-800 truncate"
                              title={v.label}
                            >
                              {v.label}
                            </span>
                            {v.sub && (
                              <span
                                className="text-gray-500 truncate"
                                title={v.sub}
                              >
                                — {v.sub}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {uploadResult.ok && uploadResult.accepted?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={processing}
                      onClick={async () => {
                        if (!uploadResult?.accepted) return;
                        setProcessing(true);
                        setProcessed({ success: 0, duplicates: 0, errors: 0 });
                        setProcessedLogs([]);
                        const DEFAULT_CLIENT_ID =
                          (process.env.CLIENT_ID as string) ||
                          "e9f3a0d4-0b71-4728-b131-ec7bc71e902d";
                        const COINS_CATEGORY_ID =
                          (process.env.COINS_CATEGORY_ID as string) ||
                          "2e92c5be-7251-44a6-b9a2-c64d5f09855a";
                        for (const row of uploadResult.accepted) {
                          const certRaw = String(row.cert_num || "");
                          const price = Number(row.price || 0) || 0;
                          const slotId = row.slot_id as string | undefined;
                          if (!certRaw) continue;
                          try {
                            // Check existence first
                            const check =
                              await inventoryApi.checkCertificateExists(
                                certRaw,
                              );
                            if (check.exists) {
                              setProcessed((p) => ({
                                ...p,
                                duplicates: p.duplicates + 1,
                              }));
                              setProcessedLogs((arr) => [
                                ...arr,
                                {
                                  cert: certRaw,
                                  status: "duplicate",
                                  message: "Already exists",
                                },
                              ]);
                              continue;
                            }
                            // Create via lookup-and-save-cert
                            const apiBase = (process.env.API_BASE_URL ??
                              "https://www.conejocoin.net/") as string;
                            const res = await axios.post(
                              `${apiBase}api/v1/ngc-integration/lookup-and-save-cert/`,
                              {
                                cert_number: certRaw,
                                client_id: DEFAULT_CLIENT_ID,
                                category_id: COINS_CATEGORY_ID,
                                status: "in_store",
                                price,
                                created_by: user?.id || null,
                              },
                              { withCredentials: true },
                            );
                            const saved = res?.data?.saved_item;
                            if (saved?.id && slotId) {
                              // Assign location to the slot
                              try {
                                await inventoryApi.updateItem(saved.id, {
                                  location: slotId,
                                });
                              } catch (locErr) {
                                console.warn(
                                  "Failed to set item location",
                                  locErr,
                                );
                              }
                            }
                            setProcessed((p) => ({
                              ...p,
                              success: p.success + 1,
                            }));
                            setProcessedLogs((arr) => [
                              ...arr,
                              {
                                cert: certRaw,
                                status: "success",
                                message: "Created and assigned",
                              },
                            ]);
                          } catch (err: any) {
                            const msg =
                              err?.response?.data?.error ||
                              err?.message ||
                              "error";
                            // Count duplicate if backend indicates duplicate
                            if (
                              typeof msg === "string" &&
                              (msg.includes("duplicate") ||
                                msg.toLowerCase().includes("exists"))
                            ) {
                              setProcessed((p) => ({
                                ...p,
                                duplicates: p.duplicates + 1,
                              }));
                              setProcessedLogs((arr) => [
                                ...arr,
                                {
                                  cert: certRaw,
                                  status: "duplicate",
                                  message: "Already exists",
                                },
                              ]);
                            } else {
                              setProcessed((p) => ({
                                ...p,
                                errors: p.errors + 1,
                              }));
                              setProcessedLogs((arr) => [
                                ...arr,
                                {
                                  cert: certRaw,
                                  status: "error",
                                  message: msg,
                                },
                              ]);
                            }
                          }
                        }
                        setProcessing(false);
                        toast.success("Processing complete");
                      }}
                    >
                      {processing ? "Processing..." : "Process Accepted Rows"}
                    </Button>
                    <div className="text-xs text-gray-600">
                      Success: {processed.success} • Duplicates:{" "}
                      {processed.duplicates} • Errors: {processed.errors}
                    </div>
                    {processedLogs.length > 0 && (
                      <div className="max-h-40 overflow-auto border border-gray-100 rounded-md">
                        <ul className="text-xs divide-y">
                          {processedLogs.map((l, i) => (
                            <li
                              key={i}
                              className="px-2 py-1 flex items-center gap-2"
                            >
                              <span
                                className={
                                  l.status === "success"
                                    ? "text-emerald-700"
                                    : l.status === "duplicate"
                                      ? "text-sky-700"
                                      : "text-red-700"
                                }
                              >
                                {l.status.toUpperCase()}
                              </span>
                              <span
                                className="text-gray-700 truncate"
                                title={l.cert}
                              >
                                {l.cert}
                              </span>
                              {l.message && (
                                <span
                                  className="text-gray-500 truncate"
                                  title={l.message}
                                >
                                  — {l.message}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
