/**
 * Unified payment intent event — emit oleh kedua listener:
 *   - `evm-listener`: PulseSender.PaymentIntentSent (Base/Arb Sepolia)
 *   - `solana-lz-listener`: pulse_lz_oapp.LzPaymentIntentReceived (fallback path,
 *     aktif kalau LZ V2 delivery sudah bekerja)
 *
 * Settler consume `PulsePaymentIntent` apa pun source-nya — kontrak settlement
 * di Solana sama, hanya `source` yang beda.
 */

export type PaymentIntentSource = "evm" | "solana-lz";

export interface PulsePaymentIntent {
  /** 32-byte session ID (raw bytes). */
  sessionId: Uint8Array;
  /** LayerZero source EID — 40245 Base Sep, 40231 Arb Sep, 40161 Eth Sep. */
  sourceEid: number;
  /** EVM payer address (20 raw bytes). */
  sourcePayer: Uint8Array;
  /** USDC base units (6 decimals). */
  amount: bigint;
  /** Asal event — untuk logging + dedup. */
  source: PaymentIntentSource;
  /** Tx signature/hash dari source chain (untuk audit log). */
  sourceTxHash: string;
}

export function sessionIdHex(intent: Pick<PulsePaymentIntent, "sessionId">): string {
  return "0x" + Buffer.from(intent.sessionId).toString("hex");
}
