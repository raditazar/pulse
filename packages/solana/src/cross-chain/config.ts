/**
 * Cross-chain configuration untuk Pulse — LayerZero V2 + Trusted Relayer model.
 *
 * `CROSS_CHAIN_CONFIG` adalah single source of truth untuk semua endpoint testnet
 * yang dipakai oleh sisi EVM (Base Sepolia, Arbitrum Sepolia) ↔ Solana Devnet.
 * Hardcoded ke devnet/testnet, dengan runtime check yang throw kalau terdeteksi mainnet.
 */

import { PublicKey } from "@solana/web3.js";

const ALLOWED_CLUSTERS = ["devnet", "testnet"] as const;
type AllowedCluster = (typeof ALLOWED_CLUSTERS)[number];

export class MainnetGuardError extends Error {
  constructor(detected: string) {
    super(
      `Pulse cross-chain runtime guard: cluster="${detected}" tidak diizinkan. ` +
        `Set NEXT_PUBLIC_SOLANA_CLUSTER ke devnet atau testnet.`
    );
    this.name = "MainnetGuardError";
  }
}

export function assertNonMainnetCluster(
  cluster: string | undefined = process.env.NEXT_PUBLIC_SOLANA_CLUSTER
): asserts cluster is AllowedCluster {
  const value = (cluster ?? "devnet").toLowerCase();
  if (!ALLOWED_CLUSTERS.includes(value as AllowedCluster)) {
    throw new MainnetGuardError(value);
  }
}

assertNonMainnetCluster();

/**
 * LayerZero V2 testnet Endpoint addresses untuk sisi EVM.
 * Source: layerzero.network/v2/deployments.
 */
export const LZ_ENDPOINT_V2_EVM = {
  baseSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  arbSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  ethSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
} as const;

/**
 * Native chain IDs (EVM) — dipakai untuk wagmi/viem config & block explorer routing.
 */
export const EVM_CHAIN_ID = {
  baseSepolia: 84_532,
  arbSepolia: 421_614,
  ethSepolia: 11_155_111,
} as const;

/**
 * RPC defaults — bisa di-override via env (NEXT_PUBLIC_RPC_BASE_SEPOLIA, etc.).
 */
export const EVM_RPC_DEFAULTS = {
  baseSepolia: "https://sepolia.base.org",
  arbSepolia: "https://sepolia-rollup.arbitrum.io/rpc",
  ethSepolia: "https://ethereum-sepolia-rpc.publicnode.com",
} as const;

export const CROSS_CHAIN_CONFIG = {
  network: "devnet" as const,

  layerzero: {
    eids: {
      solanaDevnet: 40168,
      arbSepolia: 40231,
      baseSepolia: 40245,
      ethSepolia: 40161,
    },
    /**
     * LayerZero V2 Endpoint program ID — Solana Testnet (Devnet).
     * Source: lz-devtools metadata solana-testnet.json (eid 40168, v2).
     */
    endpointProgramIdSolana: new PublicKey(
      "76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6",
    ),
    endpointsEvm: LZ_ENDPOINT_V2_EVM,
  },

  /**
   * Pulse OApp Solana program ID — penerima `PulseLzPayload` di sisi Solana.
   */
  pulseLzOappProgramId: new PublicKey(
    "AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8",
  ),

  /**
   * Pulse Payment program ID — instruction `execute_trusted_split` dipanggil oleh
   * trusted relayer setelah baca event `LzPaymentIntentReceived`.
   */
  pulsePaymentProgramId: new PublicKey(
    "2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF",
  ),

  /**
   * EVM chain registry — diisi alamat deploy mock USDC + PulseSender per chain.
   * Diisi via env saat runtime (lihat helper `loadEvmChainAddresses`).
   */
  evm: {
    baseSepolia: {
      chainId: EVM_CHAIN_ID.baseSepolia,
      eid: 40245,
      lzEndpoint: LZ_ENDPOINT_V2_EVM.baseSepolia,
      mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_BASE_SEPOLIA ?? null,
      pulseSender: process.env.NEXT_PUBLIC_PULSE_SENDER_BASE_SEPOLIA ?? null,
      rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA ?? EVM_RPC_DEFAULTS.baseSepolia,
      blockExplorer: "https://sepolia.basescan.org",
    },
    arbSepolia: {
      chainId: EVM_CHAIN_ID.arbSepolia,
      eid: 40231,
      lzEndpoint: LZ_ENDPOINT_V2_EVM.arbSepolia,
      mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_ARB_SEPOLIA ?? null,
      pulseSender: process.env.NEXT_PUBLIC_PULSE_SENDER_ARB_SEPOLIA ?? null,
      rpcUrl: process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA ?? EVM_RPC_DEFAULTS.arbSepolia,
      blockExplorer: "https://sepolia.arbiscan.io",
    },
  },
} as const;

export type CrossChainConfig = typeof CROSS_CHAIN_CONFIG;
export type EvmChainKey = keyof CrossChainConfig["evm"];

/**
 * Map dari LZ EID ke chain key. Berguna untuk relayer saat resolve source chain
 * dari event payload `LzPaymentIntentReceived`.
 */
export function eidToChainKey(eid: number): EvmChainKey | "solanaDevnet" | null {
  switch (eid) {
    case 40245:
      return "baseSepolia";
    case 40231:
      return "arbSepolia";
    case 40168:
      return "solanaDevnet";
    default:
      return null;
  }
}
