/**
 * Normalized chain keys for the Pulse buyer flow. Solana and EVM testnets share
 * one type so checkout UI can branch from a single switch.
 */

import type { EvmChainKey } from "@pulse/evm";

export type CheckoutChainKey = "solana" | EvmChainKey;

export function isEvmChain(key: CheckoutChainKey): key is EvmChainKey {
  return key === "baseSepolia" || key === "arbSepolia";
}

export function chainLabel(key: CheckoutChainKey): string {
  switch (key) {
    case "solana":
      return "Solana Devnet";
    case "baseSepolia":
      return "Base Sepolia";
    case "arbSepolia":
      return "Arbitrum Sepolia";
  }
}

export function chainShortLabel(key: CheckoutChainKey): string {
  switch (key) {
    case "solana":
      return "Solana";
    case "baseSepolia":
      return "Base";
    case "arbSepolia":
      return "Arbitrum";
  }
}

export function explorerTxUrl(key: CheckoutChainKey, hash: string): string {
  switch (key) {
    case "solana":
      return `https://solscan.io/tx/${hash}?cluster=devnet`;
    case "baseSepolia":
      return `https://sepolia.basescan.org/tx/${hash}`;
    case "arbSepolia":
      return `https://sepolia.arbiscan.io/tx/${hash}`;
  }
}

export function explorerName(key: CheckoutChainKey): string {
  switch (key) {
    case "solana":
      return "Solscan";
    case "baseSepolia":
      return "Basescan";
    case "arbSepolia":
      return "Arbiscan";
  }
}

export function transactionChainTag(key: CheckoutChainKey): string {
  switch (key) {
    case "solana":
      return "solana";
    case "baseSepolia":
      return "base-sepolia";
    case "arbSepolia":
      return "arb-sepolia";
  }
}
