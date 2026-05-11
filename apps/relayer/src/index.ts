/**
 * Pulse trusted relayer entrypoint.
 *
 * Subscribe ke DUA sumber payment intent:
 *
 *   1. **EVM (primary, path utama)** — polling `PulseSender.PaymentIntentSent`
 *      di Base Sepolia + Arbitrum Sepolia. Latency 5-10 detik setelah `pay()`.
 *      Tidak butuh LZ V2 wiring.
 *
 *   2. **Solana LZ (backup)** — polling event `LzPaymentIntentReceived` di
 *      program `pulse_lz_oapp`. Aktif kalau LZ V2 receive config sudah live
 *      di Solana testnet endpoint. Dedup: kalau EVM listener sudah settle
 *      session-nya, listener Solana cek `session.status` dan skip.
 *
 * Settler men-handle dedup: in-memory inflight lock + on-chain `session.status` check.
 * Kalau dua listener fire untuk session sama, hanya satu yang akan execute.
 */

import { Connection } from "@solana/web3.js";

import { config } from "./config";
import { logger } from "./logger";
import { TrustedSplitSettler } from "./settler";
import { SolanaLzListener } from "./solana-lz-listener";
import { EvmPulseSenderListener } from "./evm-listener";
import type { PulsePaymentIntent } from "./types";
import { sessionIdHex } from "./types";

async function main() {
  const connection = new Connection(config.rpcUrl, config.commitment);

  logger.info(
    {
      cluster: config.cluster,
      rpcUrl: config.rpcUrl,
      relayer: config.relayerKeypair.publicKey.toBase58(),
      pulseLz: config.pulseLzOappProgramId.toBase58(),
      pulsePayment: config.pulsePaymentProgramId.toBase58(),
      evmChains: config.evmChains.map((c) => `${c.label}(eid=${c.eid})`),
      enableSolanaLzListener: config.enableSolanaLzListener,
    },
    "starting Pulse trusted relayer",
  );

  const settler = new TrustedSplitSettler(
    connection,
    config.relayerKeypair,
    config.pulsePaymentProgramId,
    config.usdcMint,
  );

  const handleIntent = async (intent: PulsePaymentIntent) => {
    logger.info(
      {
        sessionIdHex: sessionIdHex(intent),
        sourceEid: intent.sourceEid,
        amount: intent.amount.toString(),
        payer: "0x" + Buffer.from(intent.sourcePayer).toString("hex"),
        source: intent.source,
        sourceTx: intent.sourceTxHash,
      },
      "📥 payment intent received",
    );
    try {
      await settler.settle(intent);
    } catch (err) {
      logger.error(
        {
          err,
          sessionIdHex: sessionIdHex(intent),
          source: intent.source,
        },
        "settle failed",
      );
    }
  };

  const listeners: Array<{ stop: () => void; promise: Promise<void> }> = [];

  // --- EVM listeners (per chain) ---
  if (config.evmChains.length === 0) {
    logger.warn("no EVM chains configured (set PULSE_SENDER_BASE_SEPOLIA, etc.)");
  }
  for (const chain of config.evmChains) {
    const listener = new EvmPulseSenderListener(chain, handleIntent, config.evmPollIntervalMs);
    listeners.push({ stop: () => listener.stop(), promise: listener.start() });
  }

  // --- Solana LZ listener (opsional, backup) ---
  if (config.enableSolanaLzListener) {
    const sol = new SolanaLzListener(
      connection,
      config.pulseLzOappProgramId,
      handleIntent,
      config.solanaPollIntervalMs,
      config.commitment,
    );
    listeners.push({ stop: () => sol.stop(), promise: sol.start() });
  }

  // --- Graceful shutdown ---
  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    for (const l of listeners) l.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Block forever (Promise.all menahan main hidup; kalau listener throw, error bubble up).
  await Promise.all(listeners.map((l) => l.promise));
}

main().catch((err) => {
  logger.fatal({ err }, "relayer crashed");
  process.exit(1);
});
