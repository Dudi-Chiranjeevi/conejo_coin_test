"use client";

import React, { useEffect } from "react";
import { loadRuntimeConfig } from "./config/env";

export function RuntimeConfigLoader({ children }: { children: React.ReactNode }) {
  // Load runtime config on component mount
  useEffect(() => {
    console.log("RuntimeConfigLoader: Loading runtime config...");
    loadRuntimeConfig().catch(error => {
      console.error("RuntimeConfigLoader: Error loading runtime config:", error);
    });
  }, []);

  return <>{children}</>;
}
