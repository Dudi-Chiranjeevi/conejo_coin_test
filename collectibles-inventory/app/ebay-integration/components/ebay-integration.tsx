"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EbayDashboardOverview } from "./ebay-dashboard-overview";
import { CreateEbayListing } from "./create-ebay-listing";
import { EbaySyncStatus } from "./ebay-sync-status";
import { ArrowLeft } from "lucide-react";

export function EbayIntegration() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const router = useRouter();

  return (
    <div className="relative z-10 w-full">
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-sky-600 hover:text-sky-700 transition-colors"
                aria-label="Back"
                type="button"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                eBay Integration
              </h1>
            </div>
          </div>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TabsList className="flex w-full max-w-2xl gap-3 bg-transparent p-1">
              <TabsTrigger
                value="dashboard"
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-urbanist font-medium text-slate-500 transition data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
              >
                Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="create"
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-urbanist font-medium text-slate-500 transition data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
              >
                Create Listing
              </TabsTrigger>
              <TabsTrigger
                value="sync"
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-urbanist font-medium text-slate-500 transition data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
              >
                Sync Status
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          <EbayDashboardOverview onTabChange={setActiveTab} />
        </TabsContent>

        <TabsContent value="create" className="mt-0">
          <CreateEbayListing />
        </TabsContent>

        <TabsContent value="sync" className="mt-0">
          <EbaySyncStatus />
        </TabsContent>
      </Tabs>
    </div>
  );
}
