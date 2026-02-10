"use client";

import { useState } from "react";
import {
  Wifi,
  WifiOff,
  TestTube,
  RefreshCw,
  Database,
  Shield,
  Bell,
  HardDrive,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mockAPIConfigs,
  type APIConfig,
  type SystemSettings,
} from "../types/user-management";

interface SystemSettingsTabProps {
  onChangesDetected: (hasChanges: boolean) => void;
}

export function SystemSettingsTab({
  onChangesDetected,
}: SystemSettingsTabProps) {
  const [apiConfigs, setApiConfigs] = useState<APIConfig[]>(mockAPIConfigs);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    autoSyncInterval: 15,
    syncSchedule: "0 */6 * * *",
    dataRetentionDays: 90,
    backupEnabled: true,
    notificationThresholds: {
      lowStock: 10,
      highValue: 10000,
      syncErrors: 5,
    },
  });
  const [testingConnection, setTestingConnection] = useState<string | null>(
    null,
  );

  const handleTestConnection = async (apiId: string) => {
    setTestingConnection(apiId);

    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setApiConfigs((prev) =>
      prev.map((api) =>
        api.id === apiId
          ? { ...api, status: Math.random() > 0.3 ? "connected" : "error" }
          : api,
      ),
    );

    setTestingConnection(null);
    onChangesDetected(true);
  };

  const handleSyncNow = async (apiId: string) => {
    setApiConfigs((prev) =>
      prev.map((api) =>
        api.id === apiId ? { ...api, lastSync: new Date().toISOString() } : api,
      ),
    );
    onChangesDetected(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "error":
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: "bg-green-100 text-green-800",
      disconnected: "bg-gray-100 text-gray-800",
      error: "bg-red-100 text-red-800",
    };
    return variants[status as keyof typeof variants] || variants.disconnected;
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return "Never";

    const date = new Date(lastSync);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440)
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      {/* API Configuration */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          API Configuration
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {apiConfigs.map((api) => (
            <Card key={api.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon(api.status)}
                    {api.name}
                  </CardTitle>
                  <Badge className={getStatusBadge(api.status)}>
                    {api.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* API Endpoint */}
                <div>
                  <Label>API Endpoint</Label>
                  <Input
                    value={api.endpoint}
                    onChange={(e) => {
                      setApiConfigs((prev) =>
                        prev.map((a) =>
                          a.id === api.id
                            ? { ...a, endpoint: e.target.value }
                            : a,
                        ),
                      );
                      onChangesDetected(true);
                    }}
                    className="font-mono text-sm"
                  />
                </div>

                {/* API Key */}
                <div>
                  <Label>API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="password"
                      value={api.apiKey}
                      onChange={(e) => {
                        setApiConfigs((prev) =>
                          prev.map((a) =>
                            a.id === api.id
                              ? { ...a, apiKey: e.target.value }
                              : a,
                          ),
                        );
                        onChangesDetected(true);
                      }}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Rate Limit */}
                <div>
                  <Label>Rate Limit Usage</Label>
                  <div className="space-y-2">
                    <Progress
                      value={(api.rateLimitUsed / api.rateLimitTotal) * 100}
                      className="h-2"
                    />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{api.rateLimitUsed.toLocaleString()} used</span>
                      <span>{api.rateLimitTotal.toLocaleString()} total</span>
                    </div>
                  </div>
                </div>

                {/* Last Sync */}
                <div>
                  <Label>Last Sync</Label>
                  <p className="text-sm text-gray-600">
                    {formatLastSync(api.lastSync)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(api.id)}
                    disabled={testingConnection === api.id}
                    className="flex-1"
                  >
                    {testingConnection === api.id ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-3 w-3 mr-1" />
                        Test
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncNow(api.id)}
                    disabled={api.status !== "connected"}
                    className="flex-1"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync
                  </Button>
                </div>

                {/* API-specific settings */}
                {api.id === "ebay" && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Sandbox Mode</Label>
                      <Switch
                        checked={api.settings.sandbox}
                        onCheckedChange={(checked) => {
                          setApiConfigs((prev) =>
                            prev.map((a) =>
                              a.id === api.id
                                ? {
                                    ...a,
                                    settings: {
                                      ...a.settings,
                                      sandbox: checked,
                                    },
                                  }
                                : a,
                            ),
                          );
                          onChangesDetected(true);
                        }}
                      />
                    </div>
                  </div>
                )}

                {api.id === "openai" && (
                  <div className="pt-2 border-t space-y-2">
                    <div>
                      <Label className="text-sm">Model</Label>
                      <Select
                        value={api.settings.model}
                        onValueChange={(value) => {
                          setApiConfigs((prev) =>
                            prev.map((a) =>
                              a.id === api.id
                                ? {
                                    ...a,
                                    settings: { ...a.settings, model: value },
                                  }
                                : a,
                            ),
                          );
                          onChangesDetected(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">
                            GPT-3.5 Turbo
                          </SelectItem>
                          <SelectItem value="gpt-4-turbo">
                            GPT-4 Turbo
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Sync & Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync & Automation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-sync Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Auto-sync Interval</Label>
              <span className="text-sm text-gray-600">
                {systemSettings.autoSyncInterval} minutes
              </span>
            </div>
            <Slider
              value={[systemSettings.autoSyncInterval]}
              onValueChange={([value]) => {
                setSystemSettings((prev) => ({
                  ...prev,
                  autoSyncInterval: value,
                }));
                onChangesDetected(true);
              }}
              max={60}
              min={5}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>5 min</span>
              <span>30 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Sync Schedule */}
          <div className="space-y-2">
            <Label>Sync Schedule (Cron Expression)</Label>
            <Input
              value={systemSettings.syncSchedule}
              onChange={(e) => {
                setSystemSettings((prev) => ({
                  ...prev,
                  syncSchedule: e.target.value,
                }));
                onChangesDetected(true);
              }}
              placeholder="0 */6 * * *"
              className="font-mono"
            />
            <p className="text-sm text-gray-600">Current: Every 6 hours</p>
          </div>

          {/* Data Retention */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Data Retention Period</Label>
              <span className="text-sm text-gray-600">
                {systemSettings.dataRetentionDays} days
              </span>
            </div>
            <Slider
              value={[systemSettings.dataRetentionDays]}
              onValueChange={([value]) => {
                setSystemSettings((prev) => ({
                  ...prev,
                  dataRetentionDays: value,
                }));
                onChangesDetected(true);
              }}
              max={365}
              min={30}
              step={30}
              className="w-full"
            />
          </div>

          {/* Backup Settings */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Automatic Backups</Label>
              <p className="text-sm text-gray-600">
                Enable daily automated backups
              </p>
            </div>
            <Switch
              checked={systemSettings.backupEnabled}
              onCheckedChange={(checked) => {
                setSystemSettings((prev) => ({
                  ...prev,
                  backupEnabled: checked,
                }));
                onChangesDetected(true);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Low Stock Alert</Label>
              <Input
                type="number"
                value={systemSettings.notificationThresholds.lowStock}
                onChange={(e) => {
                  setSystemSettings((prev) => ({
                    ...prev,
                    notificationThresholds: {
                      ...prev.notificationThresholds,
                      lowStock: Number.parseInt(e.target.value) || 0,
                    },
                  }));
                  onChangesDetected(true);
                }}
              />
              <p className="text-xs text-gray-600">Items below this quantity</p>
            </div>

            <div className="space-y-2">
              <Label>High Value Alert</Label>
              <Input
                type="number"
                value={systemSettings.notificationThresholds.highValue}
                onChange={(e) => {
                  setSystemSettings((prev) => ({
                    ...prev,
                    notificationThresholds: {
                      ...prev.notificationThresholds,
                      highValue: Number.parseInt(e.target.value) || 0,
                    },
                  }));
                  onChangesDetected(true);
                }}
              />
              <p className="text-xs text-gray-600">
                Items above this value ($)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sync Error Alert</Label>
              <Input
                type="number"
                value={systemSettings.notificationThresholds.syncErrors}
                onChange={(e) => {
                  setSystemSettings((prev) => ({
                    ...prev,
                    notificationThresholds: {
                      ...prev.notificationThresholds,
                      syncErrors: Number.parseInt(e.target.value) || 0,
                    },
                  }));
                  onChangesDetected(true);
                }}
              />
              <p className="text-xs text-gray-600">Consecutive sync failures</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            System Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
            >
              <Database className="h-6 w-6" />
              <span className="text-sm">Optimize Database</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
            >
              <RefreshCw className="h-6 w-6" />
              <span className="text-sm">Clear Cache</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
            >
              <HardDrive className="h-6 w-6" />
              <span className="text-sm">Backup Now</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
            >
              <Shield className="h-6 w-6" />
              <span className="text-sm">Security Scan</span>
            </Button>
          </div>

          {/* System Health */}
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">
                System Health: Good
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">CPU Usage:</span>
                <span className="ml-1 font-medium">23%</span>
              </div>
              <div>
                <span className="text-gray-600">Memory:</span>
                <span className="ml-1 font-medium">1.2GB</span>
              </div>
              <div>
                <span className="text-gray-600">Storage:</span>
                <span className="ml-1 font-medium">45GB free</span>
              </div>
              <div>
                <span className="text-gray-600">Uptime:</span>
                <span className="ml-1 font-medium">7 days</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
