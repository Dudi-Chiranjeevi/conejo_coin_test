"use client"

import { EbayIntegration } from "./components/ebay-integration"
import { ProtectedRoute } from "../auth/components/protected-route"
import { AppLayout } from "@/components/app-layout"

export default function EbayIntegrationPage() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <EbayIntegration />
      </ProtectedRoute>
    </AppLayout>
  )
}

