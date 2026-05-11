import { readFileSync } from "node:fs";
import { Keypair, PublicKey } from "@solana/web3.js";
import "dotenv/config";
import type { Address } from "viem";

import type { EvmChainConfig } from "./evm-listener";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} missing`);
  return v;
}

function optional(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : null;
}

function loadKeypair(pathOrJson: string): Keypair {
  let raw: string;
  if (pathOrJson.startsWith("[")) {
    raw = pathOrJson;
  } else {
    raw = readFileSync(pathOrJson, "utf8");
  }
  const arr = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function evmChain(
  label: string,
  envPrefix: string,
  defaults: { chainId: number; eid: number; rpcUrl: string },
): EvmChainConfig | null {
  const sender = optional(`PULSE_SENDER_${envPrefix}`);
  if (!sender) return null;
  const rpc = optional(`${envPrefix}_RPC_URL`) ?? defaults.rpcUrl;
  return {
    label,
    chainId: defaults.chainId,
    eid: defaults.eid,
    rpcUrl: rpc,
    pulseSender: sender as Address,
  };
}

const evmChains: EvmChainConfig[] = [];
const baseSep = evmChain("Base Sepolia", "BASE_SEPOLIA", {
  chainId: 84_532,
  eid: 40_245,
  rpcUrl: "https://sepolia.base.org",
});
const arbSep = evmChain("Arb Sepolia", "ARB_SEPOLIA", {
  chainId: 421_614,
  eid: 40_231,
  rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
});
if (baseSep) evmChains.push(baseSep);
if (arbSep) evmChains.push(arbSep);

export const config = {
  cluster: process.env.SOLANA_CLUSTER ?? "devnet",
  rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  commitment: (process.env.COMMITMENT ?? "confirmed") as "confirmed" | "finalized",
  solanaPollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 4_000),
  evmPollIntervalMs: Number(process.env.EVM_POLL_INTERVAL_MS ?? 5_000),

  relayerKeypair: loadKeypair(required("RELAYER_KEYPAIR_PATH")),

  pulsePaymentProgramId: new PublicKey(required("PULSE_PAYMENT_PROGRAM_ID")),
  pulseLzOappProgramId: new PublicKey(required("PULSE_LZ_OAPP_PROGRAM_ID")),
  usdcMint: new PublicKey(required("USDC_MINT_DEVNET")),

  databaseUrl: process.env.DATABASE_URL ?? null,

  /** EVM chains aktif (di-include kalau env `PULSE_SENDER_<CHAIN>` di-set). */
  evmChains,

  /** Toggle Solana LZ listener — false untuk skip kalau LZ V2 belum wire. */
  enableSolanaLzListener: (process.env.ENABLE_SOLANA_LZ_LISTENER ?? "true") === "true",
} as const;

if (config.cluster !== "devnet" && config.cluster !== "testnet") {
  throw new Error(`relayer hanya boleh devnet/testnet, got "${config.cluster}"`);
}
