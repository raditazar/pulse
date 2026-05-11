"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import {
  defaultSolanaRpcsPlugin,
  toSolanaWalletConnectors,
} from "@privy-io/react-auth/solana";
import type { ReactNode } from "react";

export const merchantPrivyAppId =
  process.env.NEXT_PUBLIC_PRIVY_MERCHANT_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

const solanaRpcsPlugin = defaultSolanaRpcsPlugin();

export function MerchantPrivyProvider({ children }: { children: ReactNode }) {
  if (!merchantPrivyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={merchantPrivyAppId}
      config={{
        appearance: {
          accentColor: "#9945FF",
          theme: "light",
          walletChainType: "solana-only",
          walletList: ["phantom", "solflare", "wallet_connect_qr_solana"],
        },
        loginMethods: ["email", "google", "passkey", "wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        plugins: [solanaRpcsPlugin],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
