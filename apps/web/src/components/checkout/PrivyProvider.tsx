"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import type { ReactNode } from "react";

export const buyerPrivyAppId =
  process.env.NEXT_PUBLIC_PRIVY_BUYER_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export function BuyerPrivyProvider({ children }: { children: ReactNode }) {
  if (!buyerPrivyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={buyerPrivyAppId}
      config={{
        appearance: {
          accentColor: "#9945FF",
          theme: "light",
          walletChainType: "ethereum-and-solana",
          walletList: [
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "wallet_connect",
            "phantom",
            "solflare",
            "backpack",
            "detected_ethereum_wallets",
            "detected_solana_wallets",
          ],
        },
        loginMethods: ["wallet", "email", "google", "passkey"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
