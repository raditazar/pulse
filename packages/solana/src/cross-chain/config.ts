/**
 * Cross-chain configuration + runtime mainnet guard.
 *
 * `CROSS_CHAIN_CONFIG` adalah single source of truth untuk semua devnet/testnet endpoint
 * yang dipakai oleh CCTP + LayerZero flows. Hardcoded ke devnet, dengan runtime check
 * yang throw kalau terdeteksi mainnet — supaya tidak ada accidental cross-chain transfer
 * pakai real funds saat development.
 */

import { PublicKey } from "@solana/web3.js";

import { IRIS_API_BASE, SOLANA_CCTP_V2_DEVNET } from "../cctp/addresses";
import { CCTP_DOMAIN } from "../cctp/types";

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

/**
 * Throws kalau env mengarah ke mainnet. Dipanggil di module load supaya gagal early
 * sebelum ada transaction sign.
 */
export function assertNonMainnetCluster(
  cluster: string | undefined = process.env.NEXT_PUBLIC_SOLANA_CLUSTER
): asserts cluster is AllowedCluster {
  const value = (cluster ?? "devnet").toLowerCase();
  if (!ALLOWED_CLUSTERS.includes(value as AllowedCluster)) {
    throw new MainnetGuardError(value);
  }
}

assertNonMainnetCluster();

export const CROSS_CHAIN_CONFIG = {
  network: "devnet" as const,

  cctp: {
    domains: {
      solana: CCTP_DOMAIN.SOLANA,
      ethSepolia: CCTP_DOMAIN.ETH_SEPOLIA,
      baseSepolia: CCTP_DOMAIN.BASE_SEPOLIA,
      arbSepolia: CCTP_DOMAIN.ARB_SEPOLIA,
      avaxFuji: CCTP_DOMAIN.AVAX_FUJI,
    },
    irisApiUrl: IRIS_API_BASE,
    usdcMintSolana: SOLANA_CCTP_V2_DEVNET.usdcMint,
    messageTransmitterV2: SOLANA_CCTP_V2_DEVNET.messageTransmitterV2,
    tokenMessengerMinterV2: SOLANA_CCTP_V2_DEVNET.tokenMessengerMinterV2,
  },

  layerzero: {
    eids: {
      solanaDevnet: 40168,
      arbSepolia: 40231,
      baseSepolia: 40245,
      ethSepolia: 40161,
    },
    /**
     * LayerZero V2 Solana Devnet endpoint program ID. Saat ini PLACEHOLDER —
     * fetch nilai resmi saat Phase 2 dari:
     *   https://docs.layerzero.network/v2/deployments/chains/solana-testnet
     * Setelah dapat alamatnya, replace `null` dengan `new PublicKey(...)`.
     */
    endpointProgramId: null as PublicKey | null,
  },
} as const;

export type CrossChainConfig = typeof CROSS_CHAIN_CONFIG;
