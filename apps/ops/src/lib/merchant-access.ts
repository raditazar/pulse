import type { PulseMerchantRecord } from "@pulse/types";

const keyForWallet = (walletAddress: string) => `pulse:merchant:${walletAddress}`;

export function getStoredMerchant(walletAddress?: string | null) {
  if (!walletAddress || typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(keyForWallet(walletAddress));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PulseMerchantRecord;
  } catch {
    window.localStorage.removeItem(keyForWallet(walletAddress));
    return null;
  }
}

export function storeMerchantForWallet(
  walletAddress: string,
  merchant: PulseMerchantRecord,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyForWallet(walletAddress), JSON.stringify(merchant));
}
