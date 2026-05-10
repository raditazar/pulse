import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MerchantPrivyProvider } from "@/components/dashboard/PrivyProvider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse Ops — Settlement command center",
  description:
    "Operational dashboard for merchants on Pulse: live tap stream, settlement split, and NFC sticker control.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F7FA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-bg text-text font-sans antialiased">
        <MerchantPrivyProvider>
          <DashboardShell>{children}</DashboardShell>
        </MerchantPrivyProvider>
      </body>
    </html>
  );
}
