"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  RotateCcw,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableHeaderRow,
  DataTableHeaderCell,
  DataTableRow,
  DataTableCell,
} from "@/components/ui/data-table";
import { GlassContainer } from "@/components/app-layout";
import type { SyncProgress, SyncError } from "../types/ebay";
import { syncErrors } from "../types/ebay";
import { useEbaySettings } from "../hooks/useEbaySettings";
import { useToast } from "@/components/ui/use-toast";

export function EbaySyncStatus() {
  const { settings, updateSettings } = useEbaySettings();
  const { toast } = useToast();
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isActive: false,
    currentStep: "Idle",
    progress: 0,
    itemsProcessed: 0,
    totalItems: 0,
    timeRemaining: "0s",
    errors: 0,
  });

  const [errors, setErrors] = useState<SyncError[]>(syncErrors);
  const [activityLog, setActivityLog] = useState<
    Array<{ id: number; timestamp: string; message: string; type: string }>
  >([
    {
      id: 1,
      timestamp: "14:32:15",
      message: "Sync completed successfully",
      type: "success",
    },
    {
      id: 2,
      timestamp: "14:28:09",
      message: "Rate limit encountered, retrying...",
      type: "warning",
    },
    {
      id: 3,
      timestamp: "14:25:33",
      message: "Started inventory synchronization",
      type: "info",
    },
  ]);

  // Define backend URL with same pattern as your example
  const BACKEND_URL =
    process.env.BACKEND_URL ||
    "https://conejo-backend-146447649143.us-central1.run.app";

  // Settings handlers
  const handleAutoSyncToggle = async (enabled: boolean) => {
    const success = await updateSettings({
      sync: {
        auto_sync_enabled: enabled,
        sync_interval: settings.sync.sync_interval,
      },
    });

    if (success) {
      toast({
        title: enabled ? "Auto Sync Enabled" : "Auto Sync Disabled",
        description: enabled
          ? `New inventory items will be automatically listed every ${settings.sync.sync_interval} minutes`
          : "Auto listing creation is now disabled",
      });
    }
  };

  const handleSyncIntervalChange = async (interval: string) => {
    const success = await updateSettings({
      sync: {
        auto_sync_enabled: settings.sync.auto_sync_enabled,
        sync_interval: parseInt(interval),
      },
    });

    if (success && settings.sync.auto_sync_enabled) {
      toast({
        title: "Sync Interval Updated",
        description: `Auto sync will run every ${interval} minutes`,
      });
    }
  };

  const handleDashboardIntervalChange = async (interval: string) => {
    await updateSettings({
      dashboard: {
        refresh_enabled: settings.dashboard.refresh_enabled,
        refresh_interval: parseInt(interval),
      },
    });
  };

  // UPDATED: Manual sync trigger with proper backend URL
  const handleManualSync = async () => {
    try {
      setSyncProgress((prev) => ({
        ...prev,
        isActive: true,
        currentStep: "Starting manual sync...",
      }));

      const response = await fetch(
        `${BACKEND_URL}/api/v1/ebay/trigger-auto-sync/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Added to match your pattern
        },
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Manual Sync Started",
          description: `Processing ${result.data?.total_found || 0} unlisted items`,
        });

        // Simulate progress for manual sync
        setSyncProgress((prev) => ({
          ...prev,
          progress: 0,
          itemsProcessed: 0,
          totalItems: result.data?.total_found || 0,
          currentStep: "Processing items...",
          timeRemaining: "Calculating...",
        }));
      } else {
        throw new Error(result.error || "Sync failed");
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description:
          error instanceof Error ? error.message : "Failed to start sync",
        variant: "destructive",
      });
      setSyncProgress((prev) => ({ ...prev, isActive: false }));
    }
  };

  // Simulate sync progress
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (syncProgress.isActive) {
      interval = setInterval(() => {
        setSyncProgress((prev) => {
          const newProgress = Math.min(prev.progress + Math.random() * 5, 100);
          const newItemsProcessed = Math.floor(
            (newProgress / 100) * prev.totalItems,
          );
          const timeRemaining =
            newProgress < 100 ? `${Math.ceil((100 - newProgress) * 2)}s` : "0s";

          let currentStep = "Fetching listings";
          if (newProgress > 30) currentStep = "Updating inventory";
          if (newProgress > 70) currentStep = "Checking orders";
          if (newProgress >= 100) currentStep = "Completed";

          return {
            ...prev,
            progress: newProgress,
            itemsProcessed: newItemsProcessed,
            currentStep,
            timeRemaining,
            isActive: newProgress < 100,
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncProgress.isActive]);

  const handleStartSync = () => {
    setSyncProgress((prev) => ({
      ...prev,
      isActive: true,
      progress: 0,
      itemsProcessed: 0,
      currentStep: "Starting sync...",
      timeRemaining: "2m 30s",
    }));

    // Add to activity log
    setActivityLog((prev) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        message: "Manual sync started",
        type: "info",
      },
      ...prev,
    ]);
  };

  const handleStopSync = () => {
    setSyncProgress((prev) => ({
      ...prev,
      isActive: false,
      currentStep: "Cancelled",
    }));

    setActivityLog((prev) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        message: "Sync cancelled by user",
        type: "warning",
      },
      ...prev,
    ]);
  };

  const getStatusBadge = (type: string) => {
    const badges = {
      success: (
        <Badge className="bg-[#193821]/20 text-[#193821] border border-[#193821]/30 font-urbanist">
          Success
        </Badge>
      ),
      warning: (
        <Badge className="bg-goldYellow/20 text-ink border border-goldYellow/30 font-urbanist">
          Warning
        </Badge>
      ),
      info: (
        <Badge className="bg-white/20 text-moss-darker border border-softGold/20 font-urbanist">
          Info
        </Badge>
      ),
      error: (
        <Badge className="bg-red-50/50 text-red-800 border border-red-200/50 font-urbanist">
          Error
        </Badge>
      ),
    };
    return badges[type as keyof typeof badges] || badges.info;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between relative z-10 mt-6">
        <h1 className="text-2xl font-urbanist font-semibold text-ink">
          Ebay Sync Status
        </h1>
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-goldYellow/70" />
          <span className="text-sm font-urbanist text-moss-600">
            Real-time monitoring
          </span>
        </div>
      </div>

      {/* Sync Progress Section */}
      <Card className="shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-ink font-urbanist text-xl">
              Sync Progress
            </span>
            <div className="flex items-center gap-2">
              {syncProgress.isActive ? (
                <Button
                  onClick={handleStopSync}
                  variant="outline"
                  size="sm"
                  className="border-goldYellow/50 text-ink hover:bg-goldYellow/10 transition-all duration-300 font-urbanist"
                >
                  <Pause className="h-4 w-4 mr-2 text-goldYellow/70" />
                  Stop Sync
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleManualSync}
                    className="bg-blue-500 hover:bg-blue-600 border border-blue-400/30 text-white shadow-md hover:shadow-lg transition-all duration-300 font-urbanist"
                    size="sm"
                    disabled={syncProgress.isActive}
                  >
                    <RefreshCw className="h-4 w-4 mr-2 text-white" />
                    Sync Now
                  </Button>
                  <Button
                    onClick={handleStartSync}
                    variant="outline"
                    size="sm"
                    className="border-goldYellow/50 text-ink hover:bg-goldYellow/10 transition-all duration-300 font-urbanist"
                  >
                    <Play className="h-4 w-4 mr-2 text-goldYellow/70" />
                    Start Test
                  </Button>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-moss-600 mb-2 font-urbanist">
                <span>{syncProgress.currentStep}</span>
                <span>{syncProgress.progress.toFixed(0)}% complete</span>
              </div>
              <Progress
                value={syncProgress.progress}
                className="h-3 bg-white/30 [&>div]:bg-blue-500"
              />
            </div>

            {/* Progress Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <GlassContainer className="p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-urbanist font-semibold text-vividOrange">
                  {syncProgress.itemsProcessed}
                </div>
                <div className="text-sm text-moss-600 font-urbanist">
                  Items Processed
                </div>
              </GlassContainer>
              <GlassContainer className="p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-urbanist font-semibold text-ink">
                  {syncProgress.totalItems}
                </div>
                <div className="text-sm text-moss-600 font-urbanist">
                  Total Items
                </div>
              </GlassContainer>
              <GlassContainer className="p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-urbanist font-semibold text-goldYellow">
                  {syncProgress.timeRemaining}
                </div>
                <div className="text-sm text-moss-600 font-urbanist">
                  Time Remaining
                </div>
              </GlassContainer>
              <GlassContainer className="p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-urbanist font-semibold text-slate-700">
                  {syncProgress.errors}
                </div>
                <div className="text-sm text-moss-600 font-urbanist">
                  Errors
                </div>
              </GlassContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Schedule Settings - UPDATED WITH AUTO SYNC */}
      <Card className="shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-ink font-urbanist text-xl">
            Sync & Refresh Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Dashboard Refresh Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-goldYellow/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-urbanist text-ink">
                    Dashboard Auto-Refresh
                  </h4>
                  <p className="text-sm text-moss-600 font-urbanist">
                    Automatically refresh dashboard data
                  </p>
                </div>
                <Switch
                  checked={settings.dashboard.refresh_enabled}
                  onCheckedChange={(enabled) =>
                    updateSettings({
                      dashboard: {
                        refresh_enabled: enabled,
                        refresh_interval: settings.dashboard.refresh_interval,
                      },
                    })
                  }
                  className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-400/30"
                />
              </div>

              <div>
                <h4 className="font-urbanist text-ink mb-2">
                  Refresh Interval
                </h4>
                <Select
                  value={settings.dashboard.refresh_interval.toString()}
                  onValueChange={handleDashboardIntervalChange}
                  disabled={!settings.dashboard.refresh_enabled}
                >
                  <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                    <SelectItem
                      value="15"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 15 seconds
                    </SelectItem>
                    <SelectItem
                      value="30"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 30 seconds
                    </SelectItem>
                    <SelectItem
                      value="60"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every minute
                    </SelectItem>
                    <SelectItem
                      value="300"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 5 minutes
                    </SelectItem>
                    <SelectItem
                      value="600"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 10 minutes
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto Sync Settings - UNCOMMENTED AND CONNECTED */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-goldYellow/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-urbanist text-ink">
                    Auto Listing Creation
                  </h4>
                  <p className="text-sm text-moss-600 font-urbanist">
                    Automatically create eBay listings for new inventory
                  </p>
                </div>
                <Switch
                  checked={settings.sync.auto_sync_enabled}
                  onCheckedChange={handleAutoSyncToggle}
                  className="data-[state=checked]:bg-vividOrange data-[state=checked]:border-goldYellow/30"
                />
              </div>

              <div>
                <h4 className="font-urbanist text-ink mb-2">Sync Interval</h4>
                <Select
                  value={settings.sync.sync_interval.toString()}
                  onValueChange={handleSyncIntervalChange}
                  disabled={!settings.sync.auto_sync_enabled}
                >
                  <SelectTrigger className="bg-white/30 border-goldYellow/30 text-ink focus:ring-goldYellow/30 focus:border-goldYellow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/90 backdrop-blur-md border-goldYellow/30">
                    <SelectItem
                      value="5"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 5 minutes
                    </SelectItem>
                    <SelectItem
                      value="10"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 10 minutes
                    </SelectItem>
                    <SelectItem
                      value="15"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 15 minutes
                    </SelectItem>
                    <SelectItem
                      value="30"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every 30 minutes
                    </SelectItem>
                    <SelectItem
                      value="60"
                      className="focus:bg-goldYellow/20 focus:text-ink"
                    >
                      Every hour
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Info Box */}
            {settings.sync.auto_sync_enabled && (
              <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-urbanist text-blue-900 font-medium">
                      Auto Listing Creation Active
                    </h4>
                    <p className="text-sm text-blue-700 font-urbanist mt-1">
                      New inventory items will be automatically listed on eBay
                      every {settings.sync.sync_interval} minutes. You can also
                      manually trigger a sync using the "Sync Now" button above.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Peak Hours Button */}
            {/* <div className="flex justify-center">
              <Button 
                variant="outline" 
                className="bg-white/10 border-goldYellow/30 text-moss-darker hover:bg-goldYellow/10 transition-all duration-300 font-urbanist"
              >
                <Clock className="h-4 w-4 mr-2 text-goldYellow/70" />
                Configure Peak Hours
              </Button>
            </div> */}
          </div>
        </CardContent>
      </Card>

      {/* Error Log */}
      {/* {errors.length > 0 && (
        <Card className="shadow-lg relative z-10">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-moss-darker font-urbanist text-xl">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Sync Errors ({errors.length})
              </span>
              <Button 
                onClick={handleBulkRetry} 
                variant="outline" 
                size="sm"
                className="border-softGold/50 text-moss-darker hover:bg-softGold/10 transition-all duration-300 font-urbanist"
              >
                <RotateCcw className="h-4 w-4 mr-2 text-softGold/70" />
                Bulk Retry
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md overflow-hidden border border-softGold/20">
              <DataTable>
                <DataTableHeader>
                  <DataTableHeaderRow>
                    <DataTableHeaderCell className="h-10 font-urbanist">Timestamp</DataTableHeaderCell>
                    <DataTableHeaderCell className="font-urbanist">Item</DataTableHeaderCell>
                    <DataTableHeaderCell className="font-urbanist">Error Type</DataTableHeaderCell>
                    <DataTableHeaderCell className="font-urbanist">Message</DataTableHeaderCell>
                    <DataTableHeaderCell className="font-urbanist">Attempts</DataTableHeaderCell>
                    <DataTableHeaderCell className="font-urbanist">Actions</DataTableHeaderCell>
                  </DataTableHeaderRow>
                </DataTableHeader>
                <DataTableBody>
                  {errors.map((error) => (
                    <DataTableRow key={error.id}>
                      <DataTableCell className="text-sm text-moss-600 font-urbanist">{error.timestamp}</DataTableCell>
                      <DataTableCell>
                        <div>
                          <div className="font-urbanist text-moss-darker">{error.itemName}</div>
                          <div className="text-sm text-moss-600">ID: {error.itemId}</div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge
                          className={
                            error.type === "Rate Limit"
                              ? "bg-amber-50/50 text-amber-800 border border-amber-200/50"
                              : error.type === "Network Error"
                                ? "bg-red-50/50 text-red-800 border border-red-200/50"
                                : "bg-white/20 text-ink border border-softGold/20"
                          }
                        >
                          {error.type}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell className="text-sm text-moss-600 font-urbanist">{error.message}</DataTableCell>
                      <DataTableCell className="text-moss-darker font-urbanist">{error.attempts}</DataTableCell>
                      <DataTableCell>
                        {error.retryable ? (
                          <Button 
                            onClick={() => handleRetryError(error.id)} 
                            variant="outline" 
                            size="sm"
                            className="border-softGold/30 text-moss-darker hover:bg-softGold/10 transition-all duration-300 font-urbanist text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1 text-softGold/70" />
                            Retry
                          </Button>
                        ) : (
                          <span className="text-sm text-moss-600 font-urbanist">Manual fix required</span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Activity Feed */}
      {/* <Card className="shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-moss-darker font-urbanist text-xl">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {activityLog.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 glass-container bg-white/10 border border-softGold/20 rounded-lg transition-all duration-300 hover:shadow-md">
                <div className="flex-shrink-0">
                  {activity.type === "success" && <CheckCircle className="h-5 w-5 text-[#193821]" />}
                  {activity.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  {activity.type === "info" && <RefreshCw className="h-5 w-5 text-softGold/70" />}
                  {activity.type === "error" && <AlertTriangle className="h-5 w-5 text-red-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-urbanist text-moss-darker">{activity.message}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-moss-600 font-urbanist">{activity.timestamp}</span>
                  {getStatusBadge(activity.type)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}
    </div>
  );
}
