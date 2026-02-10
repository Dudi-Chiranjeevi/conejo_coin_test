import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { Urbanist } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import GlobalAIWidget from "@/app/ai-assistant/components/global-ai-widget";
import { TopBgStrip } from "@/components/top-bg-strip";

const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });

export const metadata: Metadata = {
  title: "Conejo Coins",
  description: "Premum collectibles inventory",
  generator: "Anergroup",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={urbanist.variable}>
      <head>
        <style>{`
html {
  font-family: ${urbanist.style.fontFamily};
  --font-sans: ${urbanist.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <TopBgStrip />
        <Providers>{children}</Providers>
        {<GlobalAIWidget />}
        <Toaster />
      </body>
    </html>
  );
}
