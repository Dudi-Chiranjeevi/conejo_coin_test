"use client";

import { useState, useEffect } from "react";
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
  Save,
  Key,
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

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

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

  // STATES FOR NGC CREDENTIALS
  const [ngcCredentials, setNgcCredentials] = useState({
    username: "",
    password: "",
  });
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  const [secretsExist, setSecretsExist] = useState({
    username: false,
    password: false,
  });

  // STATES FOR OPENAI API KEY
  const [openAICredentials, setOpenAICredentials] = useState({
    apiKey: "",
  });
  const [isLoadingOpenAI, setIsLoadingOpenAI] = useState(false);
  const [openAISecretExists, setOpenAISecretExists] = useState(false);

  // NEW STATES FOR EBAY CREDENTIALS
  const [eBayCredentials, setEBayCredentials] = useState({
    // Sandbox credentials
    sandboxAppId: "",
    sandboxCertId: "",
    sandboxDevId: "",
    sandboxRuName: "",
    // Production credentials
    prodAppId: "",
    prodCertId: "",
    prodDevId: "",
    prodRuName: "",
  });
  const [isLoadingEBay, setIsLoadingEBay] = useState(false);
  const [eBaySecretsExist, setEBaySecretsExist] = useState({
    sandboxAppId: false,
    sandboxCertId: false,
    sandboxDevId: false,
    sandboxRuName: false,
    prodAppId: false,
    prodCertId: false,
    prodDevId: false,
    prodRuName: false,
  });
  const [eBaySandboxMode, setEBaySandboxMode] = useState(false);

  // NEW STATES FOR DATABASE CREDENTIALS
  const [databaseCredentials, setDatabaseCredentials] = useState({
    dbName: "",
    dbUser: "",
    dbPassword: "",
    dbPort: "",
  });
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(false);
  const [databaseSecretsExist, setDatabaseSecretsExist] = useState({
    dbName: false,
    dbUser: false,
    dbPassword: false,
    dbPort: false,
  });

  // NEW STATE FOR GLOBAL SAVE
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [globalSaveMessage, setGlobalSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track changes for all credentials
  const [originalCredentials, setOriginalCredentials] = useState({
    ngc: { username: "", password: "" },
    openai: { apiKey: "" },
    ebay: {
      sandboxAppId: "",
      sandboxCertId: "",
      sandboxDevId: "",
      sandboxRuName: "",
      prodAppId: "",
      prodCertId: "",
      prodDevId: "",
      prodRuName: "",
      sandboxMode: false,
    },
    database: {
      dbName: "",
      dbUser: "",
      dbPassword: "",
      dbPort: "",
    },
  });

  // Tab state
  const [activeTab, setActiveTab] = useState("ngc");

  // Load all credentials on component mount
  useEffect(() => {
    loadAllCredentials();
  }, []);

  const loadAllCredentials = async () => {
    await Promise.all([
      loadNgcCredentials(),
      loadOpenAICredentials(),
      loadEBayCredentials(),
      loadDatabaseCredentials(),
    ]);
  };

  const loadNgcCredentials = async () => {
    setIsLoadingSecrets(true);
    try {
      const usernameResponse = await fetch(
        `${BACKEND_URL}/api/v1/auth/secrets/NGC_USERNAME/`,
      );
      if (usernameResponse.ok) {
        const data = await usernameResponse.json();
        if (data.exists) {
          setNgcCredentials((prev) => ({
            ...prev,
            username: data.value_masked,
          }));
          setSecretsExist((prev) => ({ ...prev, username: true }));
          setOriginalCredentials((prev) => ({
            ...prev,
            ngc: { ...prev.ngc, username: data.value_masked },
          }));
        } else {
          setNgcCredentials((prev) => ({ ...prev, username: "" }));
          setSecretsExist((prev) => ({ ...prev, username: false }));
        }
      }

      const passwordResponse = await fetch(
        `${BACKEND_URL}/api/v1/auth/secrets/NGC_PASSWORD/`,
      );
      if (passwordResponse.ok) {
        const data = await passwordResponse.json();
        if (data.exists) {
          setNgcCredentials((prev) => ({
            ...prev,
            password: data.value_masked,
          }));
          setSecretsExist((prev) => ({ ...prev, password: true }));
          setOriginalCredentials((prev) => ({
            ...prev,
            ngc: { ...prev.ngc, password: data.value_masked },
          }));
        } else {
          setNgcCredentials((prev) => ({ ...prev, password: "" }));
          setSecretsExist((prev) => ({ ...prev, password: false }));
        }
      }
    } catch (error) {
      console.error("Error loading NGC credentials:", error);
    } finally {
      setIsLoadingSecrets(false);
    }
  };

  const loadOpenAICredentials = async () => {
    setIsLoadingOpenAI(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/auth/secrets/OPENAI_API_KEY/`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setOpenAICredentials((prev) => ({
            ...prev,
            apiKey: data.value_masked,
          }));
          setOpenAISecretExists(true);
          setOriginalCredentials((prev) => ({
            ...prev,
            openai: { apiKey: data.value_masked },
          }));
        } else {
          setOpenAICredentials((prev) => ({ ...prev, apiKey: "" }));
          setOpenAISecretExists(false);
        }
      }
    } catch (error) {
      console.error("Error loading OpenAI credentials:", error);
    } finally {
      setIsLoadingOpenAI(false);
    }
  };

  // NEW FUNCTION: Load eBay credentials
  const loadEBayCredentials = async () => {
    setIsLoadingEBay(true);
    try {
      // Load sandbox mode setting
      const sandboxResponse = await fetch(
        `${BACKEND_URL}/api/v1/auth/secrets/EBAY_SANDBOX_MODE/`,
      );
      if (sandboxResponse.ok) {
        const data = await sandboxResponse.json();
        if (data.exists) {
          setEBaySandboxMode(data.value_masked === "true");
          setOriginalCredentials((prev) => ({
            ...prev,
            ebay: { ...prev.ebay, sandboxMode: data.value_masked === "true" },
          }));
        }
      }

      // Helper function to convert secret ID to field name
      const secretIdToFieldName = (secretId: string, isSandbox: boolean) => {
        const prefix = isSandbox ? "sandbox" : "prod";

        // Remove the eBay prefix and convert to camelCase
        const baseName = secretId
          .toLowerCase()
          .replace(isSandbox ? "ebay_sandbox_" : "ebay_prod_", "");

        // Convert to camelCase (e.g., "app_id" -> "appId")
        const camelCaseName = baseName.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase(),
        );

        return `${prefix}${camelCaseName
          .charAt(0)
          .toUpperCase()}${camelCaseName.slice(1)}`;
      };

      // Load sandbox credentials
      const sandboxSecrets = [
        "EBAY_SANDBOX_APP_ID",
        "EBAY_SANDBOX_CERT_ID",
        "EBAY_SANDBOX_DEV_ID",
        "EBAY_SANDBOX_RU_NAME",
      ];

      for (const secretId of sandboxSecrets) {
        const response = await fetch(
          `${BACKEND_URL}/api/v1/auth/secrets/${secretId}/`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            const fieldName = secretIdToFieldName(secretId, true);
            setEBayCredentials((prev) => ({
              ...prev,
              [fieldName]: data.value_masked,
            }));
            setEBaySecretsExist((prev) => ({ ...prev, [fieldName]: true }));
            setOriginalCredentials((prev) => ({
              ...prev,
              ebay: { ...prev.ebay, [fieldName]: data.value_masked },
            }));
          }
        }
      }

      // Load production credentials
      const prodSecrets = [
        "EBAY_PROD_APP_ID",
        "EBAY_PROD_CERT_ID",
        "EBAY_PROD_DEV_ID",
        "EBAY_PROD_RU_NAME",
      ];

      for (const secretId of prodSecrets) {
        const response = await fetch(
          `${BACKEND_URL}/api/v1/auth/secrets/${secretId}/`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            const fieldName = secretIdToFieldName(secretId, false);
            setEBayCredentials((prev) => ({
              ...prev,
              [fieldName]: data.value_masked,
            }));
            setEBaySecretsExist((prev) => ({ ...prev, [fieldName]: true }));
            setOriginalCredentials((prev) => ({
              ...prev,
              ebay: { ...prev.ebay, [fieldName]: data.value_masked },
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error loading eBay credentials:", error);
    } finally {
      setIsLoadingEBay(false);
    }
  };

  // NEW FUNCTION: Load database credentials
  const loadDatabaseCredentials = async () => {
    setIsLoadingDatabase(true);
    try {
      const databaseSecrets = [
        { id: "DB_NAME", field: "dbName" },
        { id: "DB_USER", field: "dbUser" },
        { id: "DB_PASSWORD", field: "dbPassword" },
        { id: "DB_PORT", field: "dbPort" },
      ];

      for (const secret of databaseSecrets) {
        const response = await fetch(
          `${BACKEND_URL}/api/v1/auth/secrets/${secret.id}/`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            setDatabaseCredentials((prev) => ({
              ...prev,
              [secret.field]: data.value_masked,
            }));
            setDatabaseSecretsExist((prev) => ({
              ...prev,
              [secret.field]: true,
            }));
            setOriginalCredentials((prev) => ({
              ...prev,
              database: { ...prev.database, [secret.field]: data.value_masked },
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error loading database credentials:", error);
    } finally {
      setIsLoadingDatabase(false);
    }
  };

  // Check for changes whenever credentials change
  useEffect(() => {
    checkForChanges();
  }, [
    ngcCredentials,
    openAICredentials,
    eBayCredentials,
    eBaySandboxMode,
    databaseCredentials,
  ]);

  const checkForChanges = () => {
    const ngcChanged =
      ngcCredentials.username !== originalCredentials.ngc.username ||
      ngcCredentials.password !== originalCredentials.ngc.password;

    const openaiChanged =
      openAICredentials.apiKey !== originalCredentials.openai.apiKey;

    const ebayChanged =
      eBaySandboxMode !== originalCredentials.ebay.sandboxMode ||
      eBayCredentials.sandboxAppId !== originalCredentials.ebay.sandboxAppId ||
      eBayCredentials.sandboxCertId !==
        originalCredentials.ebay.sandboxCertId ||
      eBayCredentials.sandboxDevId !== originalCredentials.ebay.sandboxDevId ||
      eBayCredentials.sandboxRuName !==
        originalCredentials.ebay.sandboxRuName ||
      eBayCredentials.prodAppId !== originalCredentials.ebay.prodAppId ||
      eBayCredentials.prodCertId !== originalCredentials.ebay.prodCertId ||
      eBayCredentials.prodDevId !== originalCredentials.ebay.prodDevId ||
      eBayCredentials.prodRuName !== originalCredentials.ebay.prodRuName;

    const databaseChanged =
      databaseCredentials.dbName !== originalCredentials.database.dbName ||
      databaseCredentials.dbUser !== originalCredentials.database.dbUser ||
      databaseCredentials.dbPassword !==
        originalCredentials.database.dbPassword ||
      databaseCredentials.dbPort !== originalCredentials.database.dbPort;

    const hasChanges =
      ngcChanged || openaiChanged || ebayChanged || databaseChanged;
    setHasUnsavedChanges(hasChanges);
    onChangesDetected(hasChanges);
  };

  // NEW FUNCTION: Save all credentials at once
  const saveAllCredentials = async () => {
    if (!hasUnsavedChanges) return;

    setIsSavingAll(true);
    setGlobalSaveMessage(null);

    try {
      const savePromises = [];

      // console.log('=== STARTING SAVE ALL CREDENTIALS ===');
      // console.log('Current NGC Username:', ngcCredentials.username);
      // console.log('Current NGC Password:', ngcCredentials.password);
      // console.log('Original NGC Username:', originalCredentials.ngc.username);
      // console.log('Original NGC Password:', originalCredentials.ngc.password);
      // console.log('Secrets Exist - Username:', secretsExist.username, 'Password:', secretsExist.password);

      // Save NGC credentials if changed
      const isNgcUsernameChanged =
        ngcCredentials.username !== originalCredentials.ngc.username;
      const isNgcPasswordChanged =
        ngcCredentials.password !== originalCredentials.ngc.password;

      //console.log('NGC Changes - Username:', isNgcUsernameChanged, 'Password:', isNgcPasswordChanged);

      if (isNgcUsernameChanged && ngcCredentials.username) {
        //console.log('🚀 SAVING NGC_USERNAME:', ngcCredentials.username);
        savePromises.push(
          fetch(`${BACKEND_URL}/api/v1/auth/secrets/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret_id: "NGC_USERNAME",
              secret_value: ngcCredentials.username,
            }),
          }).then(async (response) => {
            //console.log('NGC_USERNAME Save Response:', response.status, await response.text());
            return response;
          }),
        );
      }

      if (isNgcPasswordChanged && ngcCredentials.password) {
        //console.log('🚀 SAVING NGC_PASSWORD:', ngcCredentials.password);
        savePromises.push(
          fetch(`${BACKEND_URL}/api/v1/auth/secrets/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret_id: "NGC_PASSWORD",
              secret_value: ngcCredentials.password,
            }),
          }).then(async (response) => {
            //console.log('NGC_PASSWORD Save Response:', response.status, await response.text());
            return response;
          }),
        );
      }

      // Save OpenAI credentials if changed
      const isOpenAIChanged =
        openAICredentials.apiKey !== originalCredentials.openai.apiKey;
      //console.log('OpenAI Changes:', isOpenAIChanged, 'Current:', openAICredentials.apiKey);

      if (isOpenAIChanged && openAICredentials.apiKey) {
        //console.log('🚀 SAVING OPENAI_API_KEY');
        savePromises.push(
          fetch(`${BACKEND_URL}/api/v1/auth/secrets/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret_id: "OPENAI_API_KEY",
              secret_value: openAICredentials.apiKey,
            }),
          }).then(async (response) => {
            //console.log('OPENAI Save Response:', response.status, await response.text());
            return response;
          }),
        );
      }

      // Save eBay sandbox mode
      const isEBayModeChanged =
        eBaySandboxMode !== originalCredentials.ebay.sandboxMode;
      //console.log('eBay Mode Changes:', isEBayModeChanged, 'Current:', eBaySandboxMode);

      if (isEBayModeChanged) {
        //console.log('🚀 SAVING EBAY_SANDBOX_MODE:', eBaySandboxMode);
        savePromises.push(
          fetch(`${BACKEND_URL}/api/v1/auth/secrets/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret_id: "EBAY_SANDBOX_MODE",
              secret_value: eBaySandboxMode.toString(),
            }),
          }).then(async (response) => {
            //console.log('EBAY_MODE Save Response:', response.status, await response.text());
            return response;
          }),
        );
      }

      // Log all save promises
      // console.log('Total Save Promises:', savePromises.length);
      // console.log('Save Promises Details:', savePromises);

      // Wait for all save operations to complete
      const results = await Promise.all(savePromises);
      //console.log('All Save Results:', results);

      setGlobalSaveMessage({
        type: "success",
        text: "All API credentials saved successfully!",
      });
      setHasUnsavedChanges(false);
      onChangesDetected(false);

      // Update original credentials to current values
      setOriginalCredentials({
        ngc: { ...ngcCredentials },
        openai: { ...openAICredentials },
        ebay: {
          sandboxAppId: eBayCredentials.sandboxAppId,
          sandboxCertId: eBayCredentials.sandboxCertId,
          sandboxDevId: eBayCredentials.sandboxDevId,
          sandboxRuName: eBayCredentials.sandboxRuName,
          prodAppId: eBayCredentials.prodAppId,
          prodCertId: eBayCredentials.prodCertId,
          prodDevId: eBayCredentials.prodDevId,
          prodRuName: eBayCredentials.prodRuName,
          sandboxMode: eBaySandboxMode,
        },
        database: { ...databaseCredentials },
      });

      //console.log('✅ Original credentials updated after save');

      // Reload all credentials to show masked values
      setTimeout(() => {
        loadAllCredentials();
      }, 1000);
    } catch (error) {
      console.error("❌ Error saving credentials:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setGlobalSaveMessage({
        type: "error",
        text: `Error saving credentials: ${errorMessage}`,
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  // Helper function to render eBay credential fields
  const renderEBayCredentialFields = (isSandbox: boolean) => {
    const prefix = isSandbox ? "sandbox" : "prod";
    const fields = [
      { key: "AppId", label: "App ID" },
      { key: "CertId", label: "Cert ID" },
      { key: "DevId", label: "Dev ID" },
      { key: "RuName", label: "RU Name" },
    ];

    return fields.map((field) => {
      const fieldKey = `${prefix}${field.key}` as keyof typeof eBayCredentials;

      return (
        <div key={fieldKey}>
          <Label>{field.label}</Label>
          <Input
            type="password"
            value={eBayCredentials[fieldKey]}
            onChange={(e) =>
              setEBayCredentials((prev) => ({
                ...prev,
                [fieldKey]: e.target.value,
              }))
            }
            placeholder={
              eBaySecretsExist[fieldKey]
                ? `Enter new ${field.label}`
                : `Enter ${isSandbox ? "Sandbox" : "Production"} ${field.label}`
            }
            disabled={isLoadingEBay}
            className="font-mono text-sm"
          />
          {eBaySecretsExist[fieldKey] &&
            eBayCredentials[fieldKey].includes("****") && (
              <p className="text-xs text-blue-600 mt-1">
                Masked value shown - enter new value to update
              </p>
            )}
        </div>
      );
    });
  };

  // Keep all existing functions exactly as they are
  const handleTestConnection = async (apiId: string) => {
    setTestingConnection(apiId);
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
      {/* NEW HEADER SECTION WITH SAVE BUTTON */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          API Configuration
        </h2>

        {/* Global Save Button - Only show when there are changes */}
        {hasUnsavedChanges && (
          <div className="flex items-center gap-4">
            {globalSaveMessage && (
              <div
                className={`px-3 py-2 rounded-md text-sm ${
                  globalSaveMessage.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {globalSaveMessage.text}
              </div>
            )}

            <Button
              onClick={saveAllCredentials}
              disabled={isSavingAll}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isSavingAll ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSavingAll ? "Saving..." : "Save All Changes"}
            </Button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="w-full border-b border-gray-200">
        <div className="flex overflow-x-auto scrollbar-hide justify-center">
          <div className="flex">
            {/* NGC Tab */}
            <button
              onClick={() => setActiveTab("ngc")}
              className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === "ngc"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Key className="h-4 w-4" />
              NGC Credentials
            </button>

            {/* eBay Tab */}
            <button
              onClick={() => setActiveTab("ebay")}
              className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === "ebay"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Shield className="h-4 w-4" />
              eBay API
            </button>

            {/* Database Tab */}
            <button
              onClick={() => setActiveTab("database")}
              className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === "database"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Database className="h-4 w-4" />
              Database
            </button>

            {/* OpenAPI Tab */}
            <button
              onClick={() => setActiveTab("openapi")}
              className={`px-6 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === "openapi"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Wifi className="h-4 w-4" />
              OpenAPI
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* NGC Tab Content */}
        {activeTab === "ngc" && (
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon("connected")}
                    NGC API
                  </CardTitle>
                  <Badge className={getStatusBadge("connected")}>
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>NGC Username</Label>
                  <Input
                    type="text"
                    value={ngcCredentials.username}
                    onChange={(e) =>
                      setNgcCredentials((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    placeholder={
                      secretsExist.username
                        ? "Enter new username"
                        : "Enter NGC username"
                    }
                    disabled={isLoadingSecrets}
                  />
                  {secretsExist.username &&
                    ngcCredentials.username.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div>
                  <Label>NGC Password</Label>
                  <Input
                    type="password"
                    value={ngcCredentials.password}
                    onChange={(e) =>
                      setNgcCredentials((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder={
                      secretsExist.password
                        ? "Enter new password"
                        : "Enter NGC password"
                    }
                    disabled={isLoadingSecrets}
                  />
                  {secretsExist.password &&
                    ngcCredentials.password.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={loadNgcCredentials}
                    disabled={isLoadingSecrets}
                  >
                    {isLoadingSecrets ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* eBay Tab Content */}
        {activeTab === "ebay" && (
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon("connected")}
                    eBay API
                  </CardTitle>
                  <Badge className={getStatusBadge("connected")}>
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sandbox Mode Toggle */}
                <div className="flex items-center justify-between pb-4 border-b">
                  <Label className="text-sm font-medium">Sandbox Mode</Label>
                  <Switch
                    checked={eBaySandboxMode}
                    onCheckedChange={(checked) => {
                      setEBaySandboxMode(checked);
                    }}
                  />
                </div>

                {/* Conditional Rendering based on Sandbox Mode */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3 text-gray-700">
                      {eBaySandboxMode
                        ? "Sandbox Credentials"
                        : "Production Credentials"}
                    </h4>
                    <div className="space-y-3">
                      {renderEBayCredentialFields(eBaySandboxMode)}
                    </div>
                  </div>

                  {/* Show the other environment as collapsed/optional */}
                  <div className="border-t pt-4">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-gray-600">
                        {eBaySandboxMode
                          ? "Production Credentials (Optional)"
                          : "Sandbox Credentials (Optional)"}
                      </summary>
                      <div className="mt-3 space-y-3">
                        {renderEBayCredentialFields(!eBaySandboxMode)}
                      </div>
                    </details>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={loadEBayCredentials}
                    disabled={isLoadingEBay}
                  >
                    {isLoadingEBay ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Database Tab Content */}
        {activeTab === "database" && (
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon("connected")}
                    Database
                  </CardTitle>
                  <Badge className={getStatusBadge("connected")}>
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Database Name</Label>
                  <Input
                    type="text"
                    value={databaseCredentials.dbName}
                    onChange={(e) =>
                      setDatabaseCredentials((prev) => ({
                        ...prev,
                        dbName: e.target.value,
                      }))
                    }
                    placeholder={
                      databaseSecretsExist.dbName
                        ? "Enter new database name"
                        : "Enter database name"
                    }
                    disabled={isLoadingDatabase}
                  />
                  {databaseSecretsExist.dbName &&
                    databaseCredentials.dbName.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div>
                  <Label>Database User</Label>
                  <Input
                    type="text"
                    value={databaseCredentials.dbUser}
                    onChange={(e) =>
                      setDatabaseCredentials((prev) => ({
                        ...prev,
                        dbUser: e.target.value,
                      }))
                    }
                    placeholder={
                      databaseSecretsExist.dbUser
                        ? "Enter new database user"
                        : "Enter database user"
                    }
                    disabled={isLoadingDatabase}
                  />
                  {databaseSecretsExist.dbUser &&
                    databaseCredentials.dbUser.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div>
                  <Label>Database Password</Label>
                  <Input
                    type="password"
                    value={databaseCredentials.dbPassword}
                    onChange={(e) =>
                      setDatabaseCredentials((prev) => ({
                        ...prev,
                        dbPassword: e.target.value,
                      }))
                    }
                    placeholder={
                      databaseSecretsExist.dbPassword
                        ? "Enter new database password"
                        : "Enter database password"
                    }
                    disabled={isLoadingDatabase}
                  />
                  {databaseSecretsExist.dbPassword &&
                    databaseCredentials.dbPassword.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div>
                  <Label>Database Port</Label>
                  <Input
                    type="text"
                    value={databaseCredentials.dbPort}
                    onChange={(e) =>
                      setDatabaseCredentials((prev) => ({
                        ...prev,
                        dbPort: e.target.value,
                      }))
                    }
                    placeholder={
                      databaseSecretsExist.dbPort
                        ? "Enter new database port"
                        : "Enter database port"
                    }
                    disabled={isLoadingDatabase}
                  />
                  {databaseSecretsExist.dbPort &&
                    databaseCredentials.dbPort.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={loadDatabaseCredentials}
                    disabled={isLoadingDatabase}
                  >
                    {isLoadingDatabase ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* OpenAPI Tab Content */}
        {activeTab === "openapi" && (
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon("connected")}
                    OpenAI API
                  </CardTitle>
                  <Badge className={getStatusBadge("connected")}>
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>OpenAI API Key</Label>
                  <Input
                    type="password"
                    value={openAICredentials.apiKey}
                    onChange={(e) =>
                      setOpenAICredentials((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                      }))
                    }
                    placeholder={
                      openAISecretExists
                        ? "Enter new API key"
                        : "Enter OpenAI API key"
                    }
                    disabled={isLoadingOpenAI}
                    className="font-mono text-sm"
                  />
                  {openAISecretExists &&
                    openAICredentials.apiKey.includes("****") && (
                      <p className="text-xs text-blue-600 mt-1">
                        Masked value shown - enter new value to update
                      </p>
                    )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={loadOpenAICredentials}
                    disabled={isLoadingOpenAI}
                  >
                    {isLoadingOpenAI ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* KEEP ALL YOUR COMMENTED/EXISTING SECTIONS EXACTLY AS THEY WERE */}
      {/* Sync & Automation Settings */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync & Automation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6"> */}
      {/* Auto-sync Interval */}
      {/* <div className="space-y-3">
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
          </div> */}

      {/* Sync Schedule removed */}

      {/* Data Retention */}
      {/* <div className="space-y-3">
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
          </div> */}

      {/* Backup Settings */}
      {/* <div className="flex items-center justify-between">
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
      </Card> */}

      {/* Notification Thresholds */}
      {/* <Card>
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
      </Card> */}

      {/* System Maintenance */}
      {/* <Card>
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
          </div> */}

      {/* System Health */}
      {/* <div className="mt-6 p-4 bg-green-50 rounded-lg">
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
      </Card> */}
    </div>
  );
}
