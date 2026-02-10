"use client";

import { InventoryDashboard } from "./components/inventory-dashboard";
import { AppLayout } from "@/components/app-layout";

export default function InventoryManagement() {
  return (
    <AppLayout>
      <InventoryDashboard />
    </AppLayout>
  );
}
