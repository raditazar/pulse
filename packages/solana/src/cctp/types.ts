/**
 * CCTP V2 TypeScript types — testnet/devnet scope.
 *
 * Hook data layout (mirror dari `contracts/.../cross_chain/hook_data.rs`):
 *
 * | offset | size | field           |
 * |--------|------|-----------------|
 * | 0      | 32   | session_id      |
 * | 32     | 4    | source_domain   |
 * | 36     | 20   | original_sender |
 * | 56     | 8    | amount          |
 * | 64     | 24   | nonce_tag       |
 *
 * Total = 88 bytes. Big-endian (sesuai EVM ABI raw bytes).
 */

import type { PublicKey } from "@solana/web3.js";

export const HOOK_DATA_LEN = 88;

export type CctpDomain = 0 | 1 | 3 | 5 | 6;

export const CCTP_DOMAIN = {
  ETH_SEPOLIA: 0,
  AVAX_FUJI: 1,
  ARB_SEPOLIA: 3,
  SOLANA: 5,
  BASE_SEPOLIA: 6,
} as const satisfies Record<string, CctpDomain>;

export interface PulseHookData {
  sessionId: Uint8Array; // 32 bytes
  sourceDomain: CctpDomain;
  originalSender: Uint8Array; // 20 bytes (EVM address)
  amount: bigint; // u64 base units
  nonceTag: Uint8Array; // 24 bytes — random tag, audit-only
}

/** Iris attestation API response shape (subset yang kita butuhkan). */
export interface IrisAttestationMessage {
  attestation: `0x${string}`;
  message: `0x${string}`;
  eventNonce: string;
  cctpVersion: number;
  status: "complete" | "pending_confirmations" | string;
  decodedMessage?: {
    sourceDomain: string;
    destinationDomain: string;
    nonce: string;
    sender: string;
    recipient: string;
    destinationCaller: string;
    messageBody: string;
  };
}

export interface IrisAttestationResponse {
  messages: IrisAttestationMessage[];
}

export interface CctpProgramAddresses {
  messageTransmitterV2: PublicKey;
  tokenMessengerMinterV2: PublicKey;
  usdcMint: PublicKey;
}
