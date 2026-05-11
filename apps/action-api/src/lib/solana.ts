import { clusterApiUrl, Connection } from "@solana/web3.js";
import { env } from "./env";

export const solanaConnection = new Connection(
  env.SOLANA_RPC_URL ?? env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("devnet"),
  env.SOLANA_COMMITMENT
);
