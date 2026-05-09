/**
 * CCTP V2 program addresses untuk Solana Devnet + EVM testnets.
 *
 * Catatan: CCTP V2 mainnet ↔ devnet pakai program ID Solana yang sama (immutable
 * Circle-deployed). USDC mint berbeda antar cluster. Semua nilai di bawah scoped DEVNET ONLY.
 */

import { PublicKey } from "@solana/web3.js";

import type { CctpProgramAddresses } from "./types";

/** Solana CCTP V2 program IDs (sama untuk localnet/devnet/mainnet — Circle-managed). */
export const SOLANA_CCTP_V2_DEVNET: CctpProgramAddresses = {
  messageTransmitterV2: new PublicKey(
    "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC"
  ),
  tokenMessengerMinterV2: new PublicKey(
    "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe"
  ),
  usdcMint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
};

/**
 * EVM testnet CCTP V2 contract addresses.
 * Source: https://developers.circle.com/cctp/evm-smart-contracts (V2 testnet section)
 *
 * Catatan per 2026-05-09: Circle V2 testnet contracts identical address di Sepolia, Base
 * Sepolia, Arbitrum Sepolia, Avalanche Fuji.
 */
export const EVM_TESTNET_CCTP_V2 = {
  tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  /** Per-chain USDC token contract addresses (testnet). */
  usdc: {
    ethSepolia: "0x1c7D4B196Cb0C7B01d743FBc6116a902379C7238",
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    arbSepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    avaxFuji: "0x5425890298aed601595a70AB815c96711a31Bc65",
  },
} as const;

/**
 * Iris API base URL (Circle attestation service).
 * **WAJIB testnet endpoint** — `iris-api-sandbox.circle.com`. Mainnet (`iris-api.circle.com`)
 * sengaja tidak di-export dari modul ini.
 */
export const IRIS_API_BASE = "https://iris-api-sandbox.circle.com" as const;
