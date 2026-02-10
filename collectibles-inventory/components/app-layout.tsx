"use client";

import React from "react";
import Head from "next/head";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared layout component with consistent background styling for all app modules
 * Uses the warmBg and gradient orbs defined in tailwind.config.ts
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Background gradient orbs for visual interest */}
      <div className="min-h-screen bg-warmBg relative overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-goldYellow/20 to-vividOrange/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-tl from-vividOrange/15 to-goldYellow/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-r from-goldYellow/10 to-vividOrange/10 rounded-full blur-2xl"></div>

        {/* Main content */}
        <div className="relative z-10 p-6">
          <div className="container mx-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

/**
 * Utility component for consistent glass container styling across modules
 */
export function GlassContainer({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`backdrop-blur-md bg-white/20 border border-goldYellow/30 shadow-md ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
