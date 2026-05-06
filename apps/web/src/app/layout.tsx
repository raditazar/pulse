import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse Checkout",
  description: "NFC-triggered Solana payment checkout for Pulse.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

