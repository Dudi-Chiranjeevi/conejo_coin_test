"use client";

import { useState, useRef, useEffect } from "react";
import ExcelJS from "exceljs";
import {
  X,
  Download,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/app/auth/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventoryItem } from "../types/inventory";
import axios, { AxiosResponse } from "axios";
import { inventoryApi } from "../services/api";
import ShelfBulkUpload from "./shelf-bulk-upload";

interface BulkUploadInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (items: Omit<InventoryItem, "id">[]) => void;
  onRefresh?: () => void;
}

interface CertificateProcessing {
  certNumber: string;
  price?: string | number;
  status: "pending" | "processing" | "success" | "error" | "duplicate";
  data?: any;
  error?: string;
  message?: string;
  savedItem?: any;
}

interface SaveResponseData {
  success: boolean;
  is_duplicate?: boolean;
  ngc?: any;
  saved_item?: any;
  existing_inventory?: any;
  warning?: string;
  error?: string;
}

const templates = [
  { category: "NGC Coins", filename: "ngc_coins_template.xlsx", icon: "🪙" },
  { category: "Stamps", filename: "stamps_template.xlsx", icon: "🏷️" },
  { category: "Cards", filename: "cards_template.xlsx", icon: "🃏" },
  { category: "Metals", filename: "metals_template.xlsx", icon: "⚒️" },
  { category: "Bullion", filename: "bullion_template.xlsx", icon: "🥇" },
  { category: "Other", filename: "other_template.xlsx", icon: "📦" },
];

export function BulkUploadInterface({
  isOpen,
  onClose,
  onUpload,
  onRefresh,
}: BulkUploadInterfaceProps) {
  const { user } = useAuth(); // Get user from auth context
  const [activeTab, setActiveTab] = useState<"shelf" | "cert">("shelf");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [certificateNumbers, setCertificateNumbers] = useState<string[]>([]);
  const [processingQueue, setProcessingQueue] = useState<
    CertificateProcessing[]
  >([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    successful: number;
    errors: number;
    warnings: number;
    duplicates: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_CLIENT_ID =
    process.env.CLIENT_ID || "e9f3a0d4-0b71-4728-b131-ec7bc71e902d";
  const COINS_CATEGORY_ID =
    process.env.COINS_CATEGORY_ID || "2e92c5be-7251-44a6-b9a2-c64d5f09855a";

  const syncNGCImagesToGCS = async (params: {
    certNumber: string;
    frontUrl?: string;
    rearUrl?: string;
  }) => {
    const { certNumber, frontUrl, rearUrl } = params;
    if (!certNumber) return;
    if (!frontUrl && !rearUrl) return;

    await fetch("/api/v1/ngc-images/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certNumber,
        frontUrl,
        rearUrl,
      }),
    });
  };

  // Add useEffect to track completion
  useEffect(() => {
    if (isProcessing && processingQueue.length > 0) {
      const allProcessed = processingQueue.every(
        (item) => item.status !== "pending" && item.status !== "processing",
      );

      if (allProcessed) {
        setIsProcessing(false);
        const successful = processingQueue.filter(
          (item) => item.status === "success",
        ).length;
        const errors = processingQueue.filter(
          (item) => item.status === "error",
        ).length;
        const duplicates = processingQueue.filter(
          (item) => item.status === "duplicate",
        ).length;

        setUploadResults({
          total: processingQueue.length,
          successful,
          errors,
          warnings: duplicates,
          duplicates,
        });

        console.log("Processing complete:", {
          total: processingQueue.length,
          successful,
          errors,
          duplicates,
        });
      }
    }
  }, [processingQueue, isProcessing]);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setUploadResults(null);

    try {
      const certRows = await parseExcelFile(file);
      setCertificateNumbers(certRows.map((row) => row.certNumber));

      const queue = certRows.map((row) => ({
        certNumber: row.certNumber,
        price: row.price,
        status: "pending" as const,
      }));

      setProcessingQueue(queue);
    } catch (error) {
      console.error("Error parsing file:", error);
      setUploadResults({
        total: 0,
        successful: 0,
        errors: 1,
        warnings: 0,
        duplicates: 0,
      });
    }
  };

  // Now returns array of { certNumber, price }
  const parseExcelFile = async (
    file: File,
  ): Promise<{ certNumber: string; price: string | number }[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("Failed to read file"));
            return;
          }

          if (file.name.endsWith(".csv")) {
            const text = data as string;
            const lines = text.split("\n");
            const certRows: { certNumber: string; price: string | number }[] =
              [];

            const headers = lines[0]
              ?.split(",")
              .map((h) => h.trim().toLowerCase());
            const certColumnIndex = headers?.indexOf("certificate_numbers");
            const priceColumnIndex = headers?.indexOf("price");

            if (certColumnIndex === -1 || certColumnIndex === undefined) {
              reject(
                new Error('Column "certificate_numbers" not found in the file'),
              );
              return;
            }

            for (let i = 1; i < lines.length; i++) {
              const columns = lines[i].split(",");
              if (columns[certColumnIndex]) {
                const certNumber = columns[certColumnIndex].trim();
                let priceRaw =
                  priceColumnIndex !== -1 && columns[priceColumnIndex]
                    ? columns[priceColumnIndex].trim()
                    : "";
                let price: string | number =
                  priceRaw === ""
                    ? 0.0
                    : isNaN(Number(priceRaw))
                      ? 0.0
                      : Number(priceRaw);
                if (certNumber) {
                  certRows.push({ certNumber, price });
                }
              }
            }

            resolve(certRows);
          } else if (
            file.name.endsWith(".xlsx") ||
            file.name.endsWith(".xls")
          ) {
            try {
              const buffer = data as ArrayBuffer;
              const workbook = new ExcelJS.Workbook();
              await workbook.xlsx.load(buffer);

              const worksheet = workbook.worksheets[0];
              if (!worksheet) {
                reject(new Error("Excel file is empty or has no worksheets"));
                return;
              }

              const rows = worksheet.getRows(1, worksheet.rowCount) || [];
              if (rows.length === 0) {
                reject(new Error("Excel file is empty"));
                return;
              }

              // Get headers from the first row
              const headerRow = rows[0];
              if (!headerRow) {
                reject(new Error("Excel file has no headers"));
                return;
              }

              const headers: string[] = [];
              headerRow.eachCell((cell, colNumber) => {
                headers[colNumber - 1] = (cell.value as string)
                  .trim()
                  .toLowerCase();
              });

              const certColumnIndex = headers.indexOf("certificate_numbers");
              const priceColumnIndex = headers.indexOf("price");
              if (certColumnIndex === -1) {
                reject(
                  new Error(
                    'Column "certificate_numbers" not found in the Excel file',
                  ),
                );
                return;
              }

              const certRows: { certNumber: string; price: string | number }[] =
                [];
              for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row) {
                  const certCell = row.getCell(certColumnIndex + 1);
                  const priceCell =
                    priceColumnIndex !== -1
                      ? row.getCell(priceColumnIndex + 1)
                      : null;
                  if (certCell && certCell.value) {
                    const certNumber = String(certCell.value).trim();
                    let priceRaw =
                      priceCell && priceCell.value ? priceCell.value : "";
                    let price: string | number =
                      priceRaw === ""
                        ? 0.0
                        : isNaN(Number(priceRaw))
                          ? 0.0
                          : Number(priceRaw);
                    if (certNumber) {
                      certRows.push({ certNumber, price });
                    }
                  }
                }
              }

              resolve(certRows);
            } catch (excelError) {
              reject(excelError);
            }
          } else {
            reject(
              new Error(
                "Unsupported file format. Please upload CSV or Excel files.",
              ),
            );
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      // Choose the correct read method based on file type

      if (file.name.endsWith(".csv")) {
        reader.readAsText(file); // Use readAsText for CSV files
      } else {
        reader.readAsArrayBuffer(file); // Use readAsArrayBuffer for Excel files
      }
    });
  };

  const processNextCertificate = async (index: number = 0) => {
    if (index >= processingQueue.length) return;

    const currentCert = processingQueue[index];

    try {
      setProcessingQueue((prevQueue) => {
        const newQueue = [...prevQueue];
        newQueue[index] = { ...currentCert, status: "processing" };
        return newQueue;
      });

      const formatCertNumber = (certNumber: string): string => {
        // Remove all non-alphanumeric characters to handle various input formats
        const cleaned = certNumber.replace(/[^a-zA-Z0-9]/g, "");

        // Remove 'C' prefix if present
        const withoutCPrefix = cleaned.startsWith("C")
          ? cleaned.substring(1)
          : cleaned;

        // Handle NGC format (typically 10+ digits)
        if (/^\d+$/.test(withoutCPrefix) && withoutCPrefix.length >= 10) {
          // Return the cleaned number without any formatting
          return withoutCPrefix;
        }

        // Handle PCGS format (may include letters)
        if (/^\d*[a-zA-Z]+\d+$/.test(withoutCPrefix)) {
          return withoutCPrefix;
        }

        // Default case - return as is if it doesn't match known patterns
        return withoutCPrefix;
      };

      const formattedCertNumber = formatCertNumber(currentCert.certNumber);
      console.log(
        `Processing cert number: ${currentCert.certNumber}, formatted as: ${formattedCertNumber}`,
      );

      // First check if the certificate already exists
      const checkResult =
        await inventoryApi.checkCertificateExists(formattedCertNumber);

      if (checkResult.exists) {
        // Certificate already exists, mark as duplicate
        console.log(
          `Certificate ${formattedCertNumber} already exists - skipping`,
        );
        setProcessingQueue((prevQueue) => {
          const newQueue = [...prevQueue];
          newQueue[index] = {
            ...currentCert,
            status: "duplicate",
            message: "Certificate already exists in inventory", // Changed from error to message
            data: checkResult.item || {},
            savedItem: checkResult.item,
          };
          return newQueue;
        });

        // Process next certificate
        setTimeout(() => processNextCertificate(index + 1), 1000);
        return;
      }

      // Implement retry logic for API calls
      let retryCount = 0;
      const maxRetries = 2;
      let saveResponse: AxiosResponse<SaveResponseData> | undefined;

      while (retryCount <= maxRetries) {
        try {
          // Call the lookup-and-save-cert endpoint
          saveResponse = await axios.post<SaveResponseData>(
            `${
              process.env.API_BASE_URL ?? "https://www.conejocoin.net/"
            }api/v1/ngc-integration/lookup-and-save-cert/`,
            {
              cert_number: formattedCertNumber,
              client_id: DEFAULT_CLIENT_ID,
              category_id: COINS_CATEGORY_ID,
              status: "in_store",
              price: currentCert.price || 0,
              created_by: user?.id || null, // Add the user ID as created_by
            },
            { withCredentials: true },
          );

          // If successful, break out of retry loop
          break;
        } catch (apiError: any) {
          console.error(`Error details for ${formattedCertNumber}:`, apiError);

          // Check for duplicate error from database constraint
          const errorMessage =
            apiError?.response?.data?.error ||
            apiError?.message ||
            "Unknown error";
          const isDuplicateError =
            errorMessage.includes(
              "una_client_identification_number_per_client",
            ) ||
            errorMessage.includes(
              "uniq_client_identification_number_per_client",
            ) ||
            errorMessage.includes(
              "duplicate key value violates unique constraint",
            ) ||
            apiError?.response?.data?.is_duplicate === true;

          // If it's a duplicate error, don't retry
          if (isDuplicateError) {
            console.log(
              `Certificate ${formattedCertNumber} is a duplicate - not retrying`,
            );
            // Create a synthetic duplicate response if needed
            if (apiError?.response?.data?.existing_inventory) {
              throw apiError; // Use the existing error with duplicate info
            } else {
              // Create a synthetic duplicate message (not an error)
              const syntheticError = new Error(
                "Certificate already exists in inventory",
              );
              (syntheticError as any).response = {
                data: {
                  is_duplicate: true,
                  warning: "Certificate already exists in inventory",
                  message: "Certificate already exists in inventory", // Changed from error to message
                },
                status: 409,
              };
              throw syntheticError;
            }
          }

          // Only retry on 500 errors
          if (apiError?.response?.status === 500 && retryCount < maxRetries) {
            console.log(
              `Retry ${
                retryCount + 1
              } for cert ${formattedCertNumber} after 500 error`,
            );
            retryCount++;
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount),
            );
          } else {
            // For other errors or if max retries reached, rethrow
            throw apiError;
          }
        }
      }

      console.log("Save Response:", saveResponse?.data);

      if (!saveResponse) {
        throw new Error("No response received from server");
      }

      if (saveResponse?.data.success) {
        const respNgc: any = saveResponse?.data?.ngc;
        const respCert =
          respNgc?.certNumber || formattedCertNumber || currentCert.certNumber;

        syncNGCImagesToGCS({
          certNumber: respCert,
          frontUrl: respNgc?.images?.frontUrl,
          rearUrl: respNgc?.images?.rearUrl,
        }).catch((err) =>
          console.error(`Failed to sync NGC images for ${respCert}:`, err),
        );

        setProcessingQueue((prevQueue) => {
          const newQueue = [...prevQueue];
          newQueue[index] = {
            ...currentCert,
            status: "success",
            data: saveResponse!.data.ngc || {},
            savedItem: saveResponse!.data.saved_item,
          };
          return newQueue;
        });
      } else if (saveResponse?.data.is_duplicate) {
        setProcessingQueue((prevQueue) => {
          const newQueue = [...prevQueue];
          newQueue[index] = {
            ...currentCert,
            status: "duplicate",
            data: saveResponse!.data.existing_inventory,
            error: saveResponse!.data.warning || "Duplicate item",
            savedItem: saveResponse!.data.existing_inventory, // Store the existing item for reference
          };
          return newQueue;
        });
      } else {
        throw new Error(
          saveResponse?.data.error || "Unknown error saving item",
        );
      }
    } catch (error: any) {
      console.error(`Error processing cert ${currentCert.certNumber}:`, error);

      // Check for duplicate error from database constraint
      const errorMessage =
        error?.response?.data?.error || error?.message || "Unknown error";
      const isDuplicateError =
        errorMessage.includes("una_client_identification_number_per_client") ||
        errorMessage.includes("uniq_client_identification_number_per_client") ||
        errorMessage.includes(
          "duplicate key value violates unique constraint",
        ) ||
        errorMessage
          .toLowerCase()
          .includes("certificate already exists in inventory");

      if (isDuplicateError) {
        // Handle as duplicate
        setProcessingQueue((prevQueue) => {
          const newQueue = [...prevQueue];
          newQueue[index] = {
            ...currentCert,
            status: "duplicate",
            message: "Certificate already exists in inventory",
          };
          return newQueue;
        });
      } else {
        // Handle as regular error
        setProcessingQueue((prevQueue) => {
          const newQueue = [...prevQueue];
          newQueue[index] = {
            ...currentCert,
            status: "error",
            error: errorMessage,
          };
          return newQueue;
        });
      }
    } finally {
      setTimeout(() => processNextCertificate(index + 1), 1000);
    }
  };

  const startProcessing = () => {
    setIsProcessing(true);
    processNextCertificate(0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleBrowseFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800 border border-green-200 hover:bg-green-100 font-urbanist">
            <CheckCircle className="h-3 w-3 mr-1" /> Success
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-800 border border-red-200 hover:bg-red-100 font-urbanist">
            <AlertCircle className="h-3 w-3 mr-1" /> Error
          </Badge>
        );
      case "duplicate":
        return (
          <Badge className="bg-skyBlue/20 text-ink border border-skyBlue/40 hover:bg-skyBlue/20 font-urbanist">
            <AlertTriangle className="h-3 w-3 mr-1" /> Duplicate
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-100 font-urbanist">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-100 font-urbanist">
            Pending
          </Badge>
        );
    }
  };

  const completeUpload = () => {
    const successfulItems = processingQueue
      .filter((item) => item.status === "success" && item.savedItem)
      .map((item) => {
        // Add created_by to each item if not already present
        if (user?.id && !item.savedItem.created_by) {
          return {
            ...item.savedItem,
            created_by: user.id,
          };
        }
        return item.savedItem;
      });

    onUpload(successfulItems);
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent className="p-0 overflow-hidden max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b bg-skyBlue/20 border-skyBlue/30">
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-2xl font-urbanist font-medium text-black">
              Bulk Upload NGC Items
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full h-8 w-8 text-black hover:bg-black/10 hover:text-black"
            >
              {/* <X className="h-4 w-4" /> */}
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <p className="text-black font-urbanist text-sm">
            Upload a spreadsheet with NGC certificate numbers to add multiple
            items at once.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tabs Header */}
          <div className="mb-2 border-b border-gray-200">
            <nav className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("shelf")}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === "shelf"
                    ? "border-b-2 border-skyBlue text-skyBlue"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Shelf-Based Bulk Load
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cert")}
                className={`px-3 py-2 text-sm font-medium ${
                  activeTab === "cert"
                    ? "border-b-2 border-skyBlue text-skyBlue"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Full Bulk Load
              </button>
            </nav>
          </div>

          {/* Shelf Tab */}
          <div className={activeTab === "shelf" ? "" : "hidden"}>
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-urbanist font-medium text-black flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-skyBlue" />
                  Shelf Template & Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ShelfBulkUpload />
              </CardContent>
            </Card>
          </div>
          {/* Certificate Tab */}
          <div className={activeTab === "cert" ? "" : "hidden"}>
            {/* Template Download Section */}
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-urbanist font-medium text-black flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-skyBlue" />
                  Download Template
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4">
                  <Button
                    variant="outline"
                    className="flex items-center gap-3 h-auto p-4 hover:bg-skyBlue/10 hover:border-skyBlue/40 transition-all group font-urbanist"
                    onClick={async () => {
                      const ExcelJS = (await import("exceljs")).default;
                      const workbook = new ExcelJS.Workbook();
                      const worksheet = workbook.addWorksheet("Template");
                      worksheet.addRow(["certificate_numbers", "price"]);
                      const buffer = await workbook.xlsx.writeBuffer();
                      const blob = new Blob([buffer], {
                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "bulk_upload_template.xlsx";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <span className="text-2xl">🪙</span>
                    <div className="text-left">
                      <div className="font-medium text-black group-hover:text-skyBlue transition-colors">
                        Bulk Upload Template (.xlsx)
                      </div>
                      <div className="text-xs text-gray-600 group-hover:text-skyBlue/80 transition-colors">
                        Download Excel Template (certificate_numbers, price)
                      </div>
                    </div>
                    <Download className="h-4 w-4 ml-auto text-gray-400 group-hover:text-skyBlue transition-colors" />
                  </Button>
                </div>
                <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-medium font-urbanist text-black mb-2 flex items-center gap-2">
                    <span className="h-4 w-4 text-skyBlue" />
                    Upload Guidelines
                  </h4>
                  <div className="text-sm font-urbanist text-gray-700 space-y-1">
                    <p>
                      • Create an Excel/CSV file with a column named
                      "certificate_numbers"
                    </p>
                    <p>• Each row should contain one NGC certificate number</p>
                    <p>• Maximum file size: 10MB</p>
                    <p>• Supported formats: .xlsx, .xls, .csv</p>
                  </div>
                </div>
                {/* Shelf upload moved to its own card below to preserve original flow */}
              </CardContent>
            </Card>

            {/* Upload Area */}
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-urbanist font-semibold text-black flex items-center gap-2">
                  <Upload className="h-5 w-5 text-skyBlue" />
                  Upload File
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {certificateNumbers.length === 0 ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                      isDragOver
                        ? "border-skyBlue bg-skyBlue/10"
                        : "border-gray-200 hover:border-skyBlue/40"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="max-w-md mx-auto">
                      <div className="p-4 bg-skyBlue/20 rounded-full inline-flex items-center justify-center mb-4">
                        <Upload className="h-8 w-8 text-skyBlue" />
                      </div>
                      <h3 className="text-lg font-medium font-urbanist text-black mb-1">
                        {uploadedFile
                          ? "File Ready"
                          : "Drag & drop your file here"}
                      </h3>
                      <p className="text-sm font-urbanist text-gray-600 mb-4">
                        {uploadedFile
                          ? uploadedFile.name
                          : "or click to browse files (supports .xlsx, .csv up to 10MB)"}
                      </p>

                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                        ref={fileInputRef}
                      />
                      <Button
                        onClick={handleBrowseFiles}
                        variant="outline"
                        className="bg-skyBlue text-white hover:bg-skyBlue/90 focus:ring-2 focus:ring-skyBlue/50 group font-urbanist"
                      >
                        <FileText className="h-4 w-4 mr-2 group-hover:translate-y-[-1px] transition-transform" />
                        Browse Files
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium font-urbanist text-black">
                        Certificate Processing ({certificateNumbers.length}{" "}
                        items)
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 border-green-200 font-urbanist"
                        >
                          {
                            processingQueue.filter(
                              (item) => item.status === "success",
                            ).length
                          }{" "}
                          Success
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-skyBlue/20 text-ink border-skyBlue/40 font-urbanist"
                        >
                          {
                            processingQueue.filter(
                              (item) => item.status === "duplicate",
                            ).length
                          }{" "}
                          Duplicates
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-red-100 text-red-800 border-red-200 font-urbanist"
                        >
                          {
                            processingQueue.filter(
                              (item) => item.status === "error",
                            ).length
                          }{" "}
                          Errors
                        </Badge>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-64">
                        <Table>
                          <TableHeader className="bg-gray-50 sticky top-0">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[40px]">Status</TableHead>
                              <TableHead>Certificate Number</TableHead>
                              <TableHead>Details</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {processingQueue.map((item, index) => (
                              <TableRow
                                key={index}
                                className={`hover:bg-white/5 ${
                                  item.status === "error"
                                    ? "bg-red-50/30"
                                    : item.status === "duplicate"
                                      ? "bg-skyBlue/10"
                                      : item.status === "processing"
                                        ? "bg-blue-50/30"
                                        : ""
                                }`}
                              >
                                <TableCell>
                                  {getStatusBadge(item.status)}
                                </TableCell>
                                <TableCell className="font-medium font-urbanist text-black">
                                  {item.certNumber}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                  {item.status === "duplicate"
                                    ? item.message ||
                                      "Certificate already exists in inventory"
                                    : item.error
                                      ? typeof item.error === "string"
                                        ? item.error
                                        : (item.error as Error)?.message ||
                                          JSON.stringify(item.error)
                                      : item.status === "success"
                                        ? "Saved to inventory"
                                        : ""}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      {!isProcessing && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUploadedFile(null);
                            setCertificateNumbers([]);
                            setProcessingQueue([]);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                          className="text-moss-600 hover:bg-white/10 hover:border-white/20"
                        >
                          Cancel
                        </Button>
                      )}

                      {!isProcessing ? (
                        <Button
                          onClick={startProcessing}
                          className="bg-skyBlue text-white hover:bg-skyBlue/90 focus:ring-2 focus:ring-skyBlue/50 group font-urbanist"
                        >
                          Start Processing
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing {currentProcessingIndex + 1} of{" "}
                          {processingQueue.length}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {uploadResults && (
                  <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 border-2 border-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-medium font-urbanist text-black mb-2">
                        Processing Complete
                      </h3>
                      <p className="text-gray-600 font-urbanist mb-6">
                        Successfully processed {uploadResults.successful} out of{" "}
                        {uploadResults.total} certificates
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-6">
                        <div className="bg-white p-4 rounded-lg text-center border">
                          <div className="text-2xl font-bold font-urbanist text-black">
                            {uploadResults.total}
                          </div>
                          <div className="text-sm text-gray-600">Total</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg text-center border">
                          <div className="text-2xl font-bold font-urbanist text-green-600">
                            {uploadResults.successful}
                          </div>
                          <div className="text-sm text-gray-600">Success</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg text-center border">
                          <div className="text-2xl font-bold font-urbanist text-skyBlue">
                            {uploadResults.duplicates}
                          </div>
                          <div className="text-sm text-gray-600">
                            Duplicates
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg text-center border">
                          <div className="text-2xl font-bold font-urbanist text-red-600">
                            {uploadResults.errors}
                          </div>
                          <div className="text-sm text-gray-600">Errors</div>
                        </div>
                      </div>

                      <div className="flex justify-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUploadedFile(null);
                            setCertificateNumbers([]);
                            setProcessingQueue([]);
                            setUploadResults(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                          className="text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-urbanist"
                        >
                          Upload Another File
                        </Button>
                        <Button
                          onClick={completeUpload}
                          className="bg-skyBlue text-white hover:bg-skyBlue/90 focus:ring-2 focus:ring-skyBlue/50 font-urbanist"
                        >
                          Complete Upload
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
