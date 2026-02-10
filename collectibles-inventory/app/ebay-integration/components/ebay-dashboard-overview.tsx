"use client";

import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  FileText,
  Tag,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StatusCard, SyncStatus } from "../types/ebay";
import { useEbaySettings } from "../hooks/useEbaySettings";
import { inventoryApi } from "../../inventory-management/services/api";

interface EbayListing {
  sku: string;
  listing_id: string; // ADD THIS
  inventory_details: {
    title: string;
    description: string;
    condition: string;
    //image_urls: string[]
    aspects: Record<string, string[]>;
  };
  listing_status: string;
  offer_status: string;
  available_quantity: number;
  sold_quantity: number;
  estimated_availability_status: string;
  price: string;
  currency: string;
  category_id: string;
  has_offer: boolean;
}

interface EbayDashboardOverviewProps {
  onTabChange?: (tab: string) => void;
}

export function EbayDashboardOverview({
  onTabChange,
}: EbayDashboardOverviewProps) {
  const { settings } = useEbaySettings();
  const [stats, setStats] = useState<StatusCard[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: "2 minutes ago",
    status: "success",
    nextSync: "in 8 minutes",
    syncDuration: "1.2s",
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeListings, setActiveListings] = useState<EbayListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActiveListings, setShowActiveListings] = useState(false);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add refs to track API call state
  const dataFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Calculate real stats from active listings
  const calculateStats = (
    listings: EbayListing[],
    pendingCount: number,
  ): StatusCard[] => {
    const activeListingsCount = listings.length;
    const totalSoldItems = listings.reduce(
      (sum, listing) => sum + listing.sold_quantity,
      0,
    );

    return [
      {
        title: "Active Listings",
        count: activeListingsCount,
        change: `${activeListingsCount} currently active`,
        icon: "bar-chart",
        color: "blue",
        trend: "up",
      },
      {
        title: "Sold Items",
        count: totalSoldItems,
        change: `${totalSoldItems} total sold`,
        icon: "dollar-sign",
        color: "green",
        trend: "up",
      },
      {
        title: "Pending Listings",
        count: pendingCount,
        change: `${pendingCount} ready to list`,
        icon: "clock",
        color: "yellow",
        trend: pendingCount > 0 ? "up" : "neutral",
      },
      // {
      //   title: "Sync Errors",
      //   count: 0, // You can add this data if available
      //   change: "No sync errors",
      //   icon: "",
      //   color: "red" as const,
      //   trend: "down" as const,
      // },
    ];
  };

  const fetchPendingListingsCount = async (): Promise<number> => {
    try {
      // Use the EXACT same API call as CreateEbayListing
      const response = await inventoryApi.getItems({
        page: 1,
        page_size: 100,
        is_listed: false, // This gets unlisted items (pending listings)
      });

      console.log(" PENDING LISTINGS COUNT:", response.results?.length || 0);
      return response.results?.length || 0;
    } catch (error) {
      console.error("Error fetching pending listings count:", error);
      return 0;
    }
  };

  // Fetch active eBay listings - SINGLE SOURCE OF TRUTH
  const fetchActiveListings = async (forceRefresh = false) => {
    // Prevent multiple simultaneous calls
    if (isFetchingRef.current && !forceRefresh) {
      console.log(" API call already in progress, skipping...");
      return;
    }

    // Use cached data if available and not forcing refresh
    if (dataFetchedRef.current && !forceRefresh) {
      console.log(" Using cached data, no API call needed");
      return;
    }

    setLoading(true);
    isFetchingRef.current = true;

    try {
      console.log(" Making API calls for both active and pending listings...");

      // Fetch BOTH in parallel using the same approach
      const [listingsResponse, pendingCount] = await Promise.all([
        fetch(
          `${
            process.env.BACKEND_URL ||
            "https://www.conejocoin.net" ||
            "https://conejo-backend-146447649143.us-central1.run.app"
          }/api/v1/ebay/get-all-listings-with-availability/`,
          {
            credentials: "include",
          },
        ),
        fetchPendingListingsCount(),
      ]);

      if (!listingsResponse.ok) throw new Error("Failed to fetch listings");

      const result = await listingsResponse.json();

      if (result.success && result.data.listings) {
        const active = result.data.listings.filter(
          (listing: EbayListing) =>
            listing.listing_status === "ACTIVE" ||
            listing.listing_status === "OUT_OF_STOCK" ||
            listing.listing_status === "ENDED",
        );
        setActiveListings(active);

        // Update stats with real pending count
        const realStats = calculateStats(active, pendingCount);
        setStats(realStats);

        dataFetchedRef.current = true;
        console.log(
          " Data fetched successfully - Active:",
          active.length,
          "Pending:",
          pendingCount,
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      dataFetchedRef.current = false;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Handle refresh - forces new API call
  const handleRefresh = () => {
    console.log(" Manual refresh requested");
    setLastRefresh(new Date());
    fetchActiveListings(true); // Force refresh
    setCurrentPage(1);
  };

  // Handle create listing navigation - SWITCHES TO CREATE TAB
  const handleCreateListing = () => {
    if (onTabChange) {
      onTabChange("create");
    }
  };

  // Toggle active listings view - NO API CALL
  const toggleActiveListings = () => {
    console.log(" Toggling active listings view");
    // Just toggle the view, don't fetch data again
    setShowActiveListings(!showActiveListings);
    setShowCreateListing(false);
    setCurrentPage(1);
  };

  // Toggle create listing view
  const toggleCreateListing = () => {
    console.log(" Toggling create listing view");
    setShowCreateListing(!showCreateListing);
    setShowActiveListings(false);
  };

  // Download Excel function
  const downloadExcel = () => {
    // Create CSV content
    const headers = [
      "SKU",
      "Title",
      "Listing Status",
      "Price",
      "Currency",
      "Available Quantity",
      "Sold Quantity",
      "Stock Status",
      "eBay URL",
    ];

    const csvContent = [
      headers.join(","),
      ...activeListings.map((listing) =>
        [
          listing.sku,
          `"${listing.inventory_details.title.replace(/"/g, '""')}"`,
          //listing.inventory_details.aspects?.Grade?.[0] || '',
          listing.listing_status,
          // listing.offer_status,
          listing.price,
          listing.currency,
          listing.available_quantity,
          listing.sold_quantity,
          listing.estimated_availability_status,
          listing.listing_id
            ? `https://www.sandbox.ebay.com/itm/${listing.listing_id}`
            : "",
          //listing.category_id
        ].join(","),
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `ebay-active-listings-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination calculations
  const totalPages = Math.ceil(activeListings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = activeListings.slice(startIndex, endIndex);

  // Single API call on component mount
  useEffect(() => {
    console.log(" Component mounted - making initial API call");
    fetchActiveListings();
  }, []); // Empty dependency array - runs only once

  // AUTO-REFRESH EFFECT - UPDATED TO USE SETTINGS
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Only set up auto-refresh if enabled in settings
    if (settings.dashboard.refresh_enabled) {
      const refreshInterval = settings.dashboard.refresh_interval * 1000; // Convert to milliseconds

      console.log(
        ` Setting up auto-refresh every ${settings.dashboard.refresh_interval} seconds`,
      );

      interval = setInterval(() => {
        console.log(" Auto-refresh triggered");
        setLastRefresh(new Date());
        fetchActiveListings(true); // Force refresh with new data

        // Update sync status
        setSyncStatus((prev) => ({
          ...prev,
          lastSync: `${Math.floor(Math.random() * 10) + 1} minutes ago`,
          nextSync: `in ${Math.floor(Math.random() * 10) + 5} minutes`,
        }));
      }, refreshInterval);
    } else {
      console.log(" Auto-refresh disabled in settings");
    }

    // Cleanup interval on component unmount or when settings change
    return () => {
      if (interval) {
        clearInterval(interval);
        console.log(" Auto-refresh interval cleared");
      }
    };
  }, [settings.dashboard.refresh_enabled, settings.dashboard.refresh_interval]); // Re-run when settings change

  const getSyncStatusIcon = () => {
    switch (syncStatus.status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "syncing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-[#193821]" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-700/70" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCardBorderColor = (color: string) => {
    const colors = {
      blue: "border-l-4 border-softGold/70",
      green: "border-l-4 border-[#193821]",
      yellow: "border-l-4 border-softGold/70",
      red: "border-l-4 border-red-700/70",
    };
    return colors[color as keyof typeof colors] || "";
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: {
        label: "Active",
        variant: "default" as const,
        class: "bg-green-100 text-green-800",
      },
      ENDED: {
        label: "Ended",
        variant: "secondary" as const,
        class: "bg-gray-100 text-gray-800",
      },
      IN_STOCK: {
        label: "In Stock",
        variant: "default" as const,
        class: "bg-blue-100 text-blue-800",
      },
      OUT_OF_STOCK: {
        label: "Out of Stock",
        variant: "destructive" as const,
        class: "bg-red-100 text-red-800",
      },
      PUBLISHED: {
        label: "Published",
        variant: "default" as const,
        class: "bg-green-100 text-green-800",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "secondary" as const,
    };
    return (
      <Badge variant={config.variant} className={config.class}>
        {config.label}
      </Badge>
    );
  };

  // Format refresh interval for display
  const getRefreshDisplayText = () => {
    if (!settings.dashboard.refresh_enabled) {
      return "Auto-refresh disabled";
    }

    const interval = settings.dashboard.refresh_interval;
    if (interval < 60) {
      return `Auto-refresh every ${interval} seconds`;
    } else {
      const minutes = interval / 60;
      return `Auto-refresh every ${minutes} minute${minutes > 1 ? "s" : ""}`;
    }
  };

  const getKpiAccent = (color: string) => {
    const colors = {
      blue: { bg: "bg-sky-100", text: "text-sky-700" },
      green: { bg: "bg-green-100", text: "text-green-700" },
      yellow: { bg: "bg-goldYellow/20", text: "text-ink" },
      red: { bg: "bg-red-100", text: "text-red-700" },
    };
    return (
      colors[color as keyof typeof colors] || {
        bg: "bg-gray-100",
        text: "text-gray-700",
      }
    );
  };

  const getStatIcon = (key: string, className: string) => {
    const props = { className: `h-5 w-5 ${className}` };
    switch (key) {
      case "bar-chart":
        return <BarChart3 {...props} />;
      case "dollar-sign":
        return <DollarSign {...props} />;
      case "clock":
        return <Clock {...props} />;
      case "alert-triangle":
        return <AlertTriangle {...props} />;
      default:
        return <BarChart3 {...props} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center border border-gray-200">
              <span className="text-sky-700 font-urbanist font-bold text-xl">
                e
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-urbanist font-semibold text-ink">
                Integration Dashboard
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200 transition-colors">
                  Connected to: conejocoin_store
                </Badge>
                {/* <div className="flex items-center gap-1 text-sm text-moss-600 font-urbanist">
                  {getSyncStatusIcon()}
                  <span>Last sync: {syncStatus.lastSync}</span>
                </div> */}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 font-urbanist">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </div>
            <Button
              onClick={handleRefresh}
              size="sm"
              className="gap-1 bg-blue-500 text-white hover:bg-blue-600 shadow-sm transition-all duration-200 font-urbanist"
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) =>
          (() => {
            const accent = getKpiAccent(stat.color);
            return (
              <Card
                key={index}
                className="cursor-pointer hover:shadow-md transition-all duration-200 shadow-sm border border-gray-200 bg-white"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 font-urbanist">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold text-ink font-urbanist">
                        {stat.count.toLocaleString()}
                      </p>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent.bg} ${accent.text}`}
                    >
                      {getStatIcon(stat.icon, accent.text)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600 font-urbanist">
                      {stat.change}
                    </p>
                    {getTrendIcon(stat.trend)}
                  </div>
                </CardContent>
              </Card>
            );
          })(),
        )}
      </div>

      {/* Quick Actions with Tabs */}
      <Card className="shadow-sm border border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="text-ink font-urbanist text-xl">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tab Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Create Listing Tab Button */}
            <Button
              onClick={toggleCreateListing}
              variant={showCreateListing ? "default" : "outline"}
              className={`h-12 border transition-all duration-300 font-urbanist ${
                showCreateListing
                  ? "bg-blue-500 text-white border-blue-400/30"
                  : "bg-transparent border-gray-200 text-ink hover:bg-gray-100"
              }`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Listing
            </Button>

            {/* Active Listings Tab Button */}
            <Button
              onClick={toggleActiveListings}
              variant={showActiveListings ? "default" : "outline"}
              className={`h-12 border transition-all duration-300 font-urbanist ${
                showActiveListings
                  ? "bg-blue-500 text-white border-blue-400/30"
                  : "bg-transparent border-gray-200 text-ink hover:bg-gray-100"
              }`}
            >
              <Package className="h-4 w-4 mr-2" />
              Active Listings ({activeListings.length})
            </Button>

            <Button
              variant="outline"
              className="h-12 bg-transparent border-gray-200 text-ink hover:bg-gray-100 transition-all duration-300 font-urbanist"
            >
              <FileText className="h-4 w-4 mr-2" />
              Download Report
            </Button>

            {/* Commented out Bulk Update Prices button */}
            {/* <Button variant="outline" className="h-12 bg-transparent border-goldYellow/50 text-ink hover:bg-goldYellow/10 transition-all duration-300 font-urbanist">
              <Tag className="h-4 w-4 mr-2" />
              Bulk Update Prices
            </Button> */}
          </div>

          {/* Create Listing Tab Content */}
          {showCreateListing && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="text-center">
                <h3 className="text-lg font-urbanist font-semibold text-ink flex items-center justify-center gap-2 mb-4">
                  <Plus className="h-5 w-5" />
                  Create New eBay Listing
                </h3>
                <p className="text-gray-600 mb-6 font-urbanist">
                  Ready to create a new listing? Click the button below to get
                  started with the listing creation process.
                </p>
                <Button
                  onClick={handleCreateListing}
                  className="bg-blue-500 hover:bg-blue-600 h-12 px-8 border border-blue-400/30 text-white shadow-md hover:shadow-lg transition-all duration-300 font-urbanist text-lg"
                >
                  Click here to create listing
                </Button>
              </div>
            </div>
          )}

          {/* Active Listings Table - Shows when button is active */}
          {showActiveListings && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-urbanist font-semibold text-ink flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Active eBay Listings
                </h3>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="bg-gray-100 text-gray-700 border-gray-200"
                  >
                    Page {currentPage} of {totalPages}
                  </Badge>
                  {activeListings.length > 0 && (
                    <Button
                      onClick={downloadExcel}
                      size="sm"
                      variant="outline"
                      className="gap-1 bg-transparent border-gray-200 text-ink hover:bg-gray-100 font-urbanist"
                    >
                      <Download className="h-4 w-4" />
                      Export Excel
                    </Button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600 font-urbanist">
                    Loading active listings...
                  </span>
                </div>
              ) : currentItems.length > 0 ? (
                <>
                  <div className="rounded-md border border-gray-200 max-h-96 overflow-y-auto bg-white">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white">
                        <TableRow className="hover:bg-gray-50">
                          <TableHead className="text-ink font-urbanist">
                            Item
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            SKU
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            Status
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            Price
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            Available
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            Sold
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            Stock
                          </TableHead>
                          <TableHead className="text-ink font-urbanist">
                            eBay URL
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentItems.map((listing) => (
                          <TableRow
                            key={listing.sku}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                {/* {listing.inventory_details.image_urls.length > 0 && (
                                  <img
                                    src={listing.inventory_details.image_urls[0]}
                                    alt={listing.inventory_details.title}
                                    className="h-10 w-10 object-cover rounded border border-goldYellow/20"
                                  />
                                )} */}
                                <div>
                                  <div className="font-urbanist text-ink font-medium">
                                    {listing.inventory_details.title}
                                  </div>
                                  {/* <div className="text-sm text-moss-600 mt-1">
                                    {listing.inventory_details.aspects?.Grade?.[0] && (
                                      <span>Grade: {listing.inventory_details.aspects.Grade[0]}</span>
                                    )}
                                  </div> */}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-600 font-mono text-sm">
                              {listing.sku}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(listing.listing_status)}
                                {/* {getStatusBadge(listing.offer_status)} */}
                              </div>
                            </TableCell>
                            <TableCell className="font-urbanist font-semibold text-ink">
                              {listing.price} {listing.currency}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-ink">
                              {listing.available_quantity}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-ink">
                              {listing.sold_quantity}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(
                                listing.estimated_availability_status,
                              )}
                            </TableCell>

                            <TableCell>
                              {/* NEW: eBay URL Link */}
                              {listing.listing_id ? (
                                <a
                                  href={`https://www.sandbox.ebay.com/itm/${listing.listing_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                                >
                                  <Eye className="h-3 w-3" />
                                  View on eBay
                                </a>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  No URL
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600 font-urbanist">
                        Showing {startIndex + 1}-
                        {Math.min(endIndex, activeListings.length)} of{" "}
                        {activeListings.length} items
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className="gap-1 bg-transparent border-gray-200 text-ink hover:bg-gray-100 font-urbanist"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1,
                          ).map((page) => (
                            <Button
                              key={page}
                              variant={
                                currentPage === page ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 p-0 font-urbanist ${
                                currentPage === page
                                  ? "bg-blue-500 text-white border-blue-400/30"
                                  : "bg-transparent border-gray-200 text-ink hover:bg-gray-100"
                              }`}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages),
                            )
                          }
                          disabled={currentPage === totalPages}
                          className="gap-1 bg-transparent border-gray-200 text-ink hover:bg-gray-100 font-urbanist"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-600 border border-gray-200 rounded-lg bg-white">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-urbanist">
                    No active eBay listings found.
                  </p>
                  <p className="text-sm mt-1 font-urbanist">
                    Listings will appear here when they are active on eBay.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity - COMMENTED OUT SECTION */}
      {/* <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-ink font-urbanist text-xl">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <GlassContainer className="flex items-center gap-3 p-3 rounded-lg hover:shadow-md transition-all duration-300 border border-goldYellow/30">
              <CheckCircle className="h-5 w-5 text-vividOrange" />
              <div className="flex-1">
                <p className="font-medium font-urbanist text-ink">Listing Created Successfully</p>
                <p className="text-sm text-moss-600">1851-O $2.5 Gold Liberty Head - Listed for $2,450.00</p>
              </div>
              <span className="text-sm text-moss-600/80">2 min ago</span>
            </GlassContainer>

            <GlassContainer className="flex items-center gap-3 p-3 rounded-lg hover:shadow-md transition-all duration-300 border border-goldYellow/30">
              <RefreshCw className="h-5 w-5 text-goldYellow" />
              <div className="flex-1">
                <p className="font-medium font-urbanist text-ink">Inventory Sync Completed</p>
                <p className="text-sm text-moss-600">247 items synchronized with eBay</p>
              </div>
              <span className="text-sm text-moss-600/80">5 min ago</span>
            </GlassContainer> */}

      {/* Commented out Price Update Required activity */}
      {/* <GlassContainer className="flex items-center gap-3 p-3 rounded-lg hover:shadow-md transition-all duration-300 border border-amber-600/20">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium font-urbanist text-ink">Price Update Required</p>
                <p className="text-sm text-moss-600">3 items have price discrepancies</p>
              </div>
              <span className="text-sm text-moss-600/80">12 min ago</span>
            </GlassContainer> */}

      {/* <GlassContainer className="flex items-center gap-3 p-3 rounded-lg hover:shadow-md transition-all duration-300 border border-goldYellow/30">
              <CheckCircle className="h-5 w-5 text-vividOrange" />
              <div className="flex-1">
                <p className="font-medium font-urbanist text-ink">Item Sold</p>
                <p className="text-sm text-moss-600">1893 Columbian Exposition Stamp - $125.00</p>
              </div>
              <span className="text-sm text-moss-600/80">1 hour ago</span>
            </GlassContainer>
          </div>
        </CardContent>
      </Card> */}

      {/* Auto-refresh indicator - UPDATED TO SHOW SETTINGS STATUS */}
      <div className="text-center text-sm text-gray-500 font-urbanist mt-6">
        {getRefreshDisplayText()} • Last updated:{" "}
        {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}
