"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  BarChart2,
  PieChart,
  MapPin,
  FileText,
  Download,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type InventoryItem,
  statusMapping,
} from "../../inventory-management/types/inventory";
import { inventoryApi } from "../../inventory-management/services/api";

// Define report types
type ReportMetric = {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
};

type LocationBreakdown = {
  location: string;
  count: number;
  value: number;
};

type TypeBreakdown = {
  type: string;
  count: number;
  value: number;
};

export function ReportsDashboard() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [certificateFilter, setCertificateFilter] = useState("");
  const [coinTypeFilter, setCoinTypeFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ReportMetric[]>([]);
  const [locationBreakdown, setLocationBreakdown] = useState<
    LocationBreakdown[]
  >([]);
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      filterItems();
      calculateMetrics(items);
      calculateLocationBreakdown(items);
      calculateTypeBreakdown(items);
    }
  }, [
    items,
    searchTerm,
    certificateFilter,
    coinTypeFilter,
    gradeFilter,
    locationFilter,
  ]);

  const fetchInventoryItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await inventoryApi.getItems();
      // Helper function to normalize inventory items with display fields
      const normalizeItems = (items: InventoryItem[]): InventoryItem[] => {
        return items.map((item) => {
          // Extract certificate number from various possible locations
          const certNumber =
            item.identification_number || // Direct field from DB
            item.attributes?.cert_number ||
            item.attributes?.certNumber ||
            item.attributes?.coin?.cert_number ||
            item.attributes?.coin?.certNumber ||
            item.attributes?.metadata?.cert_number ||
            item.attributes?.metadata?.certNumber ||
            item.categorySpecifics?.certNumber ||
            "";

          // Extract grade from various possible locations
          const grade =
            item.attributes?.grade?.display ||
            item.attributes?.grade?.label ||
            item.categorySpecifics?.grade ||
            "";

          return {
            ...item,
            displayStatus: item.status
              ? statusMapping[item.status] || item.status
              : "Unknown",
            displayCategory: item.category_name || item.category,
            displayLocation: item.location_name || item.location || "Unknown",
            identification_number: certNumber,
            grade: grade,
            is_consigned: item.is_consigned || false,
            lookup_url: item.attributes?.lookup_url || "",
          };
        });
      };

      const itemsWithDisplay = normalizeItems(response.results);
      setItems(itemsWithDisplay);
      setFilteredItems(itemsWithDisplay);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to fetch inventory items:", err);
      setError("Failed to fetch inventory items. Please try again.");
      setIsLoading(false);
    }
  };

  // Helper function to get certificate number from an item
  const getCertificateNumber = (item: InventoryItem): string => {
    return (
      item.categorySpecifics?.certNumber ||
      item.attributes?.coin?.cert_number ||
      ""
    );
  };

  const filterItems = () => {
    let filtered = [...items];

    // Apply search term filter (across multiple fields)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.displayCategory?.toLowerCase().includes(term) ||
          item.displayLocation?.toLowerCase().includes(term) ||
          item.identification_number?.toLowerCase().includes(term) ||
          item.attributes?.coin?.cert_number?.toLowerCase().includes(term),
      );
    }

    // Apply specific filters
    if (certificateFilter) {
      const certFilter = certificateFilter.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.identification_number?.toLowerCase().includes(certFilter) ||
          item.attributes?.coin?.cert_number
            ?.toLowerCase()
            .includes(certFilter),
      );
    }

    if (coinTypeFilter) {
      const typeFilter = coinTypeFilter.toLowerCase();
      filtered = filtered.filter((item) => {
        // Check various coin type related fields
        const coinInfo = item.attributes?.coin || {};
        return (
          (coinInfo.denomination || "").toLowerCase().includes(typeFilter) ||
          (coinInfo.year || "").toLowerCase().includes(typeFilter) ||
          (coinInfo.variety || "").toLowerCase().includes(typeFilter) ||
          (coinInfo.mint_mark || "").toLowerCase().includes(typeFilter) ||
          (coinInfo.metal_type || "").toLowerCase().includes(typeFilter) ||
          (coinInfo.type || "").toLowerCase().includes(typeFilter)
        );
      });
    }

    if (gradeFilter) {
      const gFilter = gradeFilter.toLowerCase();
      filtered = filtered.filter((item) => {
        // Check various grade related fields
        const gradeInfo = item.attributes?.grade || {};
        return (
          (gradeInfo.display || "").toLowerCase().includes(gFilter) ||
          (gradeInfo.label || "").toLowerCase().includes(gFilter) ||
          (gradeInfo.service || "").toLowerCase().includes(gFilter) ||
          (gradeInfo.comment || "").toLowerCase().includes(gFilter) ||
          (item.categorySpecifics?.grade || "").toLowerCase().includes(gFilter)
        );
      });
    }

    if (locationFilter) {
      filtered = filtered.filter((item) =>
        item.displayLocation
          ?.toLowerCase()
          .includes(locationFilter.toLowerCase()),
      );
    }

    setFilteredItems(filtered);
  };

  const calculateMetrics = (itemsToAnalyze: InventoryItem[]) => {
    // Total items count
    const totalItems = itemsToAnalyze.length;

    // Total inventory value
    const totalValue = itemsToAnalyze.reduce((sum, item) => {
      const itemValue = parseFloat(item.price || "0");
      return sum + (isNaN(itemValue) ? 0 : itemValue);
    }, 0);

    // Average item value
    const avgValue = totalItems > 0 ? totalValue / totalItems : 0;

    // Value by status
    const valueByStatus = new Map<string, number>();
    itemsToAnalyze.forEach((item) => {
      const status = item.displayStatus || "Unknown";
      const itemValue = parseFloat(item.price || "0");
      const value = isNaN(itemValue) ? 0 : itemValue;

      valueByStatus.set(status, (valueByStatus.get(status) || 0) + value);
    });

    // Get in-store value
    const inStoreValue = valueByStatus.get("In Store") || 0;

    // Calculate inventory turnover (using sold items vs. total)
    const soldItems = itemsToAnalyze.filter(
      (item) => item.status === "sold",
    ).length;
    const inventoryTurnover =
      totalItems > 0 ? (soldItems / totalItems) * 100 : 0;

    // Calculate average value by category
    const categoryValues = new Map<string, { total: number; count: number }>();
    itemsToAnalyze.forEach((item) => {
      const category = item.displayCategory || "Unknown";
      const itemValue = parseFloat(item.price || "0");
      const value = isNaN(itemValue) ? 0 : itemValue;

      if (!categoryValues.has(category)) {
        categoryValues.set(category, { total: 0, count: 0 });
      }

      const current = categoryValues.get(category)!;
      categoryValues.set(category, {
        total: current.total + value,
        count: current.count + 1,
      });
    });

    // Find highest average value category
    let highestAvgCategory = "";
    let highestAvgValue = 0;

    categoryValues.forEach((data, category) => {
      const avg = data.count > 0 ? data.total / data.count : 0;
      if (avg > highestAvgValue) {
        highestAvgValue = avg;
        highestAvgCategory = category;
      }
    });

    const newMetrics: ReportMetric[] = [
      {
        label: "Total Inventory Value",
        value: formatCurrency(totalValue),
      },
      {
        label: "In-Store Value",
        value: formatCurrency(inStoreValue),
      },
      {
        label: "Inventory Turnover",
        value: `${inventoryTurnover.toFixed(1)}%`,
      },
      {
        label: "Average Item Value",
        value: formatCurrency(avgValue),
      },
    ];

    setMetrics(newMetrics);
  };

  const calculateLocationBreakdown = (itemsToAnalyze: InventoryItem[]) => {
    const locationMap = new Map<string, { count: number; value: number }>();

    itemsToAnalyze.forEach((item) => {
      const location = item.displayLocation || "Unknown";
      const itemValue = parseFloat(item.price || "0");
      const value = isNaN(itemValue) ? 0 : itemValue;

      if (locationMap.has(location)) {
        const current = locationMap.get(location)!;
        locationMap.set(location, {
          count: current.count + 1,
          value: current.value + value,
        });
      } else {
        locationMap.set(location, { count: 1, value });
      }
    });

    const breakdown: LocationBreakdown[] = Array.from(locationMap.entries())
      .map(([location, data]) => ({
        location,
        count: data.count,
        value: data.value,
      }))
      .sort((a, b) => b.count - a.count);

    setLocationBreakdown(breakdown);
  };

  const calculateTypeBreakdown = (itemsToAnalyze: InventoryItem[]) => {
    const typeMap = new Map<string, { count: number; value: number }>();

    itemsToAnalyze.forEach((item) => {
      const type = item.displayCategory || "Unknown";
      const itemValue = parseFloat(item.price || "0");
      const value = isNaN(itemValue) ? 0 : itemValue;

      if (typeMap.has(type)) {
        const current = typeMap.get(type)!;
        typeMap.set(type, {
          count: current.count + 1,
          value: current.value + value,
        });
      } else {
        typeMap.set(type, { count: 1, value });
      }
    });

    const breakdown: TypeBreakdown[] = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        value: data.value,
      }))
      .sort((a, b) => b.count - a.count);

    setTypeBreakdown(breakdown);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleExportCSV = () => {
    // Generate CSV content
    const headers = [
      "Name",
      "Category",
      "Location",
      "Value",
      "Certificate Number",
      "Grade",
      "Year",
      "Denomination",
      "Variety",
      "Status",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredItems.map((item) =>
        [
          `"${item.name || ""}"`,
          `"${item.displayCategory || ""}"`,
          `"${item.displayLocation || ""}"`,
          item.price || "0",
          `"${item.identification_number || ""}"`,
          `"${
            item.categorySpecifics?.grade ||
            item.attributes?.grade?.display ||
            item.attributes?.grade?.label ||
            ""
          }"`,
          `"${
            item.categorySpecifics?.year || item.attributes?.coin?.year || ""
          }"`,
          `"${
            item.categorySpecifics?.denomination ||
            item.attributes?.coin?.denomination ||
            ""
          }"`,
          `"${item.attributes?.coin?.variety || ""}"`,
          `"${item.displayStatus || ""}"`,
        ].join(","),
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `inventory_report_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="relative flex flex-col items-center text-center gap-3 py-6">
            <button
              onClick={() => router.push("/dashboard")}
              className="absolute left-0 top-1/2 -translate-y-1/2 text-sky-600 hover:text-sky-700 transition-colors"
              aria-label="Back"
              type="button"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
                <BarChart2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Inventory Reports
                </h1>
                <p className="text-gray-600">
                  Analyze and export your inventory data
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <Button
              variant="outline"
              className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 shadow-sm"
              onClick={handleExportCSV}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Key metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {metrics.map((metric, index) => {
            // Assign different colors to each card
            const cardColors = [
              "bg-white border border-gray-200",
              "bg-white border border-gray-200",
              "bg-white border border-gray-200",
              "bg-white border border-gray-200",
            ];

            const iconColors = [
              "text-sky-600",
              "text-blue-600",
              "text-indigo-600",
              "text-emerald-600",
            ];

            const icons = [
              <BarChart2 key="chart" className={`h-5 w-5 ${iconColors[0]}`} />,
              <PieChart key="pie" className={`h-5 w-5 ${iconColors[1]}`} />,
              <FileText key="file" className={`h-5 w-5 ${iconColors[2]}`} />,
              <MapPin key="pin" className={`h-5 w-5 ${iconColors[3]}`} />,
            ];

            return (
              <Card
                key={index}
                className={`shadow-sm ${cardColors[index % cardColors.length]}`}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-medium text-gray-700">
                    {metric.label}
                  </CardTitle>
                  {icons[index % icons.length]}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-ink">
                    {metric.value}
                  </div>
                  {metric.change && (
                    <p
                      className={`text-sm ${
                        metric.trend === "up"
                          ? "text-green-600"
                          : metric.trend === "down"
                            ? "text-red-600"
                            : "text-gray-500"
                      }`}
                    >
                      {metric.change}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search and filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Search & Filter
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search All Fields
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certificate Number
              </label>
              <Input
                placeholder="Certificate #"
                value={certificateFilter}
                onChange={(e) => setCertificateFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade
              </label>
              <Input
                placeholder="Grade"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <Input
                placeholder="Location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {filteredItems.length} items found
          </div>
        </div>

        {/* Type and Location breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Type breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-goldYellow/20 rounded-md flex items-center justify-center mr-3">
                <PieChart className="h-5 w-5 text-goldYellow" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Item Counts by Type
              </h2>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeBreakdown.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.type}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Location breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-vividOrange/20 rounded-md flex items-center justify-center mr-3">
                <MapPin className="h-5 w-5 text-vividOrange" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Location-Based Breakdown
              </h2>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationBreakdown.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.location}
                      </TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Filtered items table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-sky-100 rounded-md flex items-center justify-center mr-3">
              <FileText className="h-5 w-5 text-sky-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Filtered Items
            </h2>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Certificate #</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length > 0 ? (
                  filteredItems.slice(0, 10).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.displayCategory}</TableCell>
                      <TableCell>{item.displayLocation}</TableCell>
                      <TableCell className="text-right">
                        {item.price
                          ? formatCurrency(parseFloat(item.price))
                          : "-"}
                      </TableCell>
                      <TableCell>{item.identification_number || "-"}</TableCell>
                      <TableCell>
                        {item.categorySpecifics?.grade ||
                          item.attributes?.grade?.display ||
                          item.attributes?.grade?.label ||
                          "-"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-gray-500 italic"
                    >
                      No items found. Try adjusting your search filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {filteredItems.length > 10 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">
                  Showing 10 of {filteredItems.length} items. Export to CSV to
                  see all results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
