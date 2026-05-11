"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import type { PulseMerchantRecord } from "@pulse/types";
import { getMerchantMe } from "@/lib/api";

type MerchantContextValue = {
  merchant: PulseMerchantRecord | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

const MerchantContext = createContext<MerchantContextValue | null>(null);

export function MerchantProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const wallet = wallets[0];

  const [merchant, setMerchant] = useState<PulseMerchantRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!ready || !walletsReady) return;

    if (!authenticated) {
      setMerchant(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const privyUserId = user?.id;
    const walletAddress = wallet?.address;
    if (!privyUserId && !walletAddress) {
      setMerchant(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getMerchantMe({ privyUserId, wallet: walletAddress })
      .then((m) => {
        if (cancelled) return;
        setMerchant(m);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load merchant");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, walletsReady, user?.id, wallet?.address, fetchKey]);

  return (
    <MerchantContext.Provider value={{ merchant, isLoading, error, refetch }}>
      {children}
    </MerchantContext.Provider>
  );
}

export function useMerchant() {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error("useMerchant must be inside MerchantProvider");
  return ctx;
}
