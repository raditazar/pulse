import { clusterApiUrl, Connection } from "@solana/web3.js";

export const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export function createSolanaConnection() {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(SOLANA_CLUSTER as "devnet" | "mainnet-beta" | "testnet");

  return new Connection(endpoint, "confirmed");
}

