"use client";

import { ReportsDashboard } from "./components/reports-dashboard";
import Head from "next/head";

export default function Reports() {
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
        {/* Main content */}
        <div className="relative z-10 p-6">
          <ReportsDashboard />
        </div>
      </div>
    </>
  );
}
