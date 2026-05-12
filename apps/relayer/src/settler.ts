/**
 * Settler: turunkan event LZ jadi tx `execute_trusted_split` di pulse_payment.
 *
 * Flow:
 *   1. Resolve PaymentSession PDA via session_id → ambil merchant PDA.
 *   2. Fetch Merchant data untuk dapatkan primary_beneficiary + split list.
 *   3. Derive semua ATA (primary + split beneficiary) + relayer USDC ATA.
 *   4. Build IX via `buildExecuteTrustedSplitIx` dari @pulse/solana.
 *   5. Sign + send + confirm.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  type Keypair,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { buildExecuteTrustedSplitIx } from "../../../packages/solana/src/cross-chain/trusted-relayer";

import { ComputeBudgetProgram } from "@solana/web3.js";

import { logger } from "./logger";
import type { PulsePaymentIntent } from "./types";
import { sessionIdHex } from "./types";
import { fetchMerchant, findSessionBySessionId } from "./session-resolver";

export interface SettleResult {
  signature: string;
  sessionPda: PublicKey;
  merchantPda: PublicKey;
}

export class TrustedSplitSettler {
  /** In-flight settle locks per session — cegah race antara dua listener. */
  private inflight = new Set<string>();

  constructor(
    private readonly connection: Connection,
    private readonly relayer: Keypair,
    private readonly pulsePaymentProgramId: PublicKey,
    private readonly usdcMint: PublicKey,
  ) {}

  async settle(intent: PulsePaymentIntent): Promise<SettleResult | null> {
    const sidHex = sessionIdHex(intent);

    // In-memory lock — kalau settle untuk sessionId ini sedang berjalan, skip.
    if (this.inflight.has(sidHex)) {
      logger.debug({ sessionIdHex: sidHex, source: intent.source }, "settle already in-flight, skipping");
      return null;
    }
    this.inflight.add(sidHex);

    try {
      const sessionResolution = await findSessionBySessionId(
        this.connection,
        this.pulsePaymentProgramId,
        intent.sessionId,
      );
      if (!sessionResolution) {
        logger.warn(
          { sessionIdHex: sidHex, source: intent.source, sourceTx: intent.sourceTxHash },
          "session not found on-chain — will retry next tick",
        );
        return null;
      }

      if (sessionResolution.status !== 0) {
        logger.info(
          {
            sessionPda: sessionResolution.sessionPda.toBase58(),
            status: sessionResolution.status,
            source: intent.source,
          },
          "session already settled / closed — skipping",
        );
        return null;
      }

      if (sessionResolution.amountUsdc !== intent.amount) {
        logger.error(
          {
            sessionAmount: sessionResolution.amountUsdc.toString(),
            eventAmount: intent.amount.toString(),
            source: intent.source,
          },
          "amount mismatch — refusing to settle",
        );
        return null;
      }

      const merchant = await fetchMerchant(this.connection, sessionResolution.merchantPda);

      const relayerUsdcAta = getAssociatedTokenAddressSync(this.usdcMint, this.relayer.publicKey);
      const primaryBeneficiaryAta = getAssociatedTokenAddressSync(
        this.usdcMint,
        merchant.primaryBeneficiary,
      );
      const splitBeneficiaryAtas = merchant.splitBeneficiaries.map((b) =>
        getAssociatedTokenAddressSync(this.usdcMint, b.wallet),
      );

      const ix = buildExecuteTrustedSplitIx(
        {
          sourceEid: intent.sourceEid,
          sourcePayer: intent.sourcePayer,
          amountUsdc: intent.amount,
        },
        {
          relayer: this.relayer.publicKey,
          merchantAuthority: merchant.authority,
          session: sessionResolution.sessionPda,
          usdcMint: this.usdcMint,
          relayerUsdcAta,
          primaryBeneficiary: merchant.primaryBeneficiary,
          primaryBeneficiaryAta,
          splitBeneficiaryAtas,
          programId: this.pulsePaymentProgramId,
        },
      );

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ix,
      );
      const signature = await sendAndConfirmTransaction(this.connection, tx, [this.relayer], {
        commitment: "confirmed",
      });

      logger.info(
        {
          signature,
          sessionPda: sessionResolution.sessionPda.toBase58(),
          amountUsdc: intent.amount.toString(),
          sourceEid: intent.sourceEid,
          source: intent.source,
          sourceTx: intent.sourceTxHash,
          explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        },
        "✅ settled cross-chain payment",
      );

      return {
        signature,
        sessionPda: sessionResolution.sessionPda,
        merchantPda: sessionResolution.merchantPda,
      };
    } finally {
      this.inflight.delete(sidHex);
    }
  }
}
