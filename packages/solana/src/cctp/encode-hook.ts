/**
 * Encode/decode `PulseHookData` (88 bytes BE) — counterpart Rust ada di
 * `contracts/programs/pulse_payment/src/cross_chain/hook_data.rs`.
 *
 * Encoder ini dipakai di sisi EVM (passthrough sebagai `bytes` argument
 * `depositForBurnWithHook(..., hookData)`). Decoder dipakai untuk dev/debug.
 */

import { PublicKey } from "@solana/web3.js";

import { CCTP_DOMAIN, HOOK_DATA_LEN } from "./types";
import type { CctpDomain, PulseHookData } from "./types";

export interface EncodeHookInput {
  sessionId: PublicKey;
  sourceDomain: CctpDomain;
  /** EVM address user (0x..., 20 bytes). */
  originalSender: `0x${string}`;
  /** USDC base units (6 decimals). */
  amount: bigint;
  /** Random 24-byte tag. Kalau `undefined`, generate via crypto.getRandomValues. */
  nonceTag?: Uint8Array;
}

const isBrowserCrypto = (): boolean =>
  typeof globalThis !== "undefined" && !!globalThis.crypto?.getRandomValues;

function randomNonce(): Uint8Array {
  const buf = new Uint8Array(24);
  if (isBrowserCrypto()) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // Node.js fallback — eval require to skip bundler static analysis.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomFillSync } = require("node:crypto") as typeof import("node:crypto");
    randomFillSync(buf);
  }
  return buf;
}

function hexToBytes(hex: string, expectedLen: number): Uint8Array {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (stripped.length !== expectedLen * 2) {
    throw new Error(
      `Hex length mismatch: expected ${expectedLen} bytes (${expectedLen * 2} hex chars), got ${stripped.length} chars`
    );
  }
  const out = new Uint8Array(expectedLen);
  for (let i = 0; i < expectedLen; i++) {
    out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  const chars: string[] = [];
  for (const b of bytes) chars.push(b.toString(16).padStart(2, "0"));
  return `0x${chars.join("")}` as `0x${string}`;
}

function u32ToBeBytes(value: number): Uint8Array {
  if (value < 0 || value > 0xffffffff) throw new Error(`u32 out of range: ${value}`);
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value, false);
  return buf;
}

function u64ToBeBytes(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new Error(`u64 out of range: ${value}`);
  }
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, value, false);
  return buf;
}

/**
 * Encode hook data buffer (88 bytes). Output dipakai sebagai `hookData` param di
 * `TokenMessengerV2.depositForBurnWithHook` di EVM.
 */
export function encodeHookData(input: EncodeHookInput): Uint8Array {
  const out = new Uint8Array(HOOK_DATA_LEN);
  const sessionBytes = input.sessionId.toBytes();
  if (sessionBytes.length !== 32) throw new Error("session pubkey != 32 bytes");
  out.set(sessionBytes, 0);
  out.set(u32ToBeBytes(input.sourceDomain), 32);
  out.set(hexToBytes(input.originalSender, 20), 36);
  out.set(u64ToBeBytes(input.amount), 56);
  out.set(input.nonceTag ?? randomNonce(), 64);
  return out;
}

/** Decode hook data buffer kembali ke struct (untuk testing/debug). */
export function decodeHookData(raw: Uint8Array): PulseHookData {
  if (raw.length !== HOOK_DATA_LEN) {
    throw new Error(
      `hook_data length must be ${HOOK_DATA_LEN}, got ${raw.length}`
    );
  }
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const sourceDomain = dv.getUint32(32, false) as CctpDomain;
  if (
    sourceDomain !== CCTP_DOMAIN.ETH_SEPOLIA &&
    sourceDomain !== CCTP_DOMAIN.AVAX_FUJI &&
    sourceDomain !== CCTP_DOMAIN.ARB_SEPOLIA &&
    sourceDomain !== CCTP_DOMAIN.SOLANA &&
    sourceDomain !== CCTP_DOMAIN.BASE_SEPOLIA
  ) {
    throw new Error(`Unknown CCTP domain: ${sourceDomain}`);
  }

  return {
    sessionId: raw.slice(0, 32),
    sourceDomain,
    originalSender: raw.slice(36, 56),
    amount: dv.getBigUint64(56, false),
    nonceTag: raw.slice(64, 88),
  };
}

/** Convenience: encode original sender bytes back ke 0x-prefixed hex. */
export function senderToHex(originalSender: Uint8Array): `0x${string}` {
  return bytesToHex(originalSender);
}
