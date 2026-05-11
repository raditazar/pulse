import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { BuyerPrivyProvider } from "@/components/checkout/PrivyProvider";
import "./globals.css";

const blockBraveWalletScript = `
(function(){
  try {
    var w = window;
    var killBrave = function(){
      try {
        if (w.solana && w.solana.isBraveWallet) {
          Object.defineProperty(w, 'solana', { value: undefined, writable: true, configurable: true });
        }
        if (w.braveSolana) {
          Object.defineProperty(w, 'braveSolana', { value: undefined, writable: true, configurable: true });
        }
      } catch (e) {}
    };
    killBrave();
    var iv = setInterval(killBrave, 50);
    setTimeout(function(){ clearInterval(iv); }, 4000);
  } catch (e) {}
})();
`;

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
  title: "Pulse — Tap. Approve. Settled.",
  description:
    "NFC-triggered Solana checkout. Pay merchants in one tap, settle instantly, split natively on-chain.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F5F7FA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <head>
        <Script
          id="block-brave-wallet"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: blockBraveWalletScript }}
        />
      </head>
      <body className="bg-bg text-text font-sans antialiased">
        <BuyerPrivyProvider>{children}</BuyerPrivyProvider>
      </body>
    </html>
  );
}
