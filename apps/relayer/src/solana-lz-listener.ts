/**
 * Solana-side listener: polling logs program `pulse_lz_oapp` untuk event
 * `LzPaymentIntentReceived`. Aktif sebagai BACKUP path — saat LZ V2 receive
 * config sudah live, message akan ter-deliver via lz_receive lalu di-emit di sini.
 *
 * Untuk hackathon path utama, EVM listener (`evm-listener.ts`) yang biasa fire
 * duluan (~5-10 detik setelah pay()), jadi Solana listener jarang dapat event
 * yang belum di-settle. Settler men-handle dedup via session.status check.
 */

import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
  type Finality,
} from "@solana/web3.js";
import { logger } from "./logger";
import type { PulsePaymentIntent } from "./types";

const EVENT_DISCRIMINATOR_SIZE = 8;
const ANCHOR_EVENT_LOG_PREFIX = "Program data: ";

/** sha256("event:LzPaymentIntentReceived")[..8] */
export const LZ_PAYMENT_INTENT_RECEIVED_DISCRIMINATOR = Uint8Array.from([
  0x24, 0xf4, 0x5e, 0xb0, 0x4b, 0xaa, 0x97, 0x20,
]);

export class SolanaLzListener {
  private lastSignature: string | null = null;
  private running = false;

  constructor(
    private readonly connection: Connection,
    private readonly programId: PublicKey,
    private readonly onEvent: (intent: PulsePaymentIntent) => Promise<void>,
    private readonly pollIntervalMs = 4_000,
    private readonly commitment: Finality = "confirmed",
  ) {}

  async start() {
    if (this.running) return;
    this.running = true;

    const initial = await this.connection.getSignaturesForAddress(this.programId, { limit: 1 });
    if (initial[0]) this.lastSignature = initial[0].signature;
    logger.info(
      { cursor: this.lastSignature, source: "solana-lz" },
      "solana LZ listener started",
    );

    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        logger.error({ err, source: "solana-lz" }, "tick failure (will retry)");
      }
      await sleep(this.pollIntervalMs);
    }
  }

  stop() {
    this.running = false;
  }

  private async tick() {
    const sigs = await this.connection.getSignaturesForAddress(this.programId, {
      until: this.lastSignature ?? undefined,
      limit: 100,
    });
    if (sigs.length === 0) return;
    const ordered = [...sigs].reverse();
    for (const sig of ordered) {
      if (sig.err) continue;
      await this.processSignature(sig);
    }
    this.lastSignature = sigs[0]!.signature;
  }

  private async processSignature(sig: ConfirmedSignatureInfo) {
    const tx = await this.connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: this.commitment,
    });
    if (!tx?.meta || tx.meta.err) return;

    for (const log of tx.meta.logMessages ?? []) {
      if (!log.startsWith(ANCHOR_EVENT_LOG_PREFIX)) continue;
      const data = Buffer.from(log.substring(ANCHOR_EVENT_LOG_PREFIX.length), "base64");
      if (data.length < EVENT_DISCRIMINATOR_SIZE) continue;
      if (!discriminatorMatches(data, LZ_PAYMENT_INTENT_RECEIVED_DISCRIMINATOR)) continue;

      try {
        const intent = decodeLzPaymentIntent(data, sig.signature);
        await this.onEvent(intent);
      } catch (err) {
        logger.error({ err, sig: sig.signature, source: "solana-lz" }, "decode/handle failed");
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function discriminatorMatches(data: Buffer, expected: Uint8Array) {
  for (let i = 0; i < EVENT_DISCRIMINATOR_SIZE; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Borsh layout (matches Rust `LzPaymentIntentReceived` event):
 *   disc(8) | session_id [u8;32] | source_eid u32 | source_payer [u8;20]
 *           | amount u64 | guid [u8;32] | nonce u64 | timestamp i64
 * Total: 120 bytes.
 */
function decodeLzPaymentIntent(buf: Buffer, signature: string): PulsePaymentIntent {
  if (buf.length < 120) throw new Error(`event payload too short: ${buf.length}`);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    sessionId: Uint8Array.from(buf.subarray(8, 40)),
    sourceEid: view.getUint32(40, true),
    sourcePayer: Uint8Array.from(buf.subarray(44, 64)),
    amount: view.getBigUint64(64, true),
    source: "solana-lz",
    sourceTxHash: signature,
  };
}
