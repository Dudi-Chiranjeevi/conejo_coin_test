"use client";

import { useState } from "react";
import { AuthProvider } from "./context/auth-context";
import { AuthSystem } from "./components/auth-system";
import InventoryManagement from "../inventory-management/page";
// import LocationTracking from "../location-tracking/page";
// import NGCIntegrationPage from "../ngc-integration/page";
// import EbayIntegrationPage from "../ebay-integration/page";

export default function AuthSystemPage() {
  const [currentPage, setCurrentPage] = useState<string>("auth");

  const handleNavigate = (path: string) => {
    setCurrentPage(path);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "/inventory-management":
        return <InventoryManagement />;
      // case "/location-tracking":
      //   return <LocationTracking />;
      // case "/ngc-integration":
      //   return <NGCIntegrationPage />;
      // case "/ebay-integration":
      //   return <EbayIntegrationPage />;
      default:
        return <AuthSystem onNavigate={handleNavigate} />;
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen">
        {renderCurrentPage()}

        {/* Back to Dashboard Button (when not on auth page) */}
        {currentPage !== "auth" && (
          <button
            onClick={() => setCurrentPage("auth")}
            className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
          >
            ← Back to Dashboard
          </button>
        )}
      </div>
    </AuthProvider>
  );
}
