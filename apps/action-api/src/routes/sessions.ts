import { prisma } from "@pulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { env, getPlatformUsdcTokenAccount } from "../lib/env";
import { bigintToString, parseJsonBody } from "../lib/http";
import { createMerchantSession, expireSessionIfNeeded } from "../services/session-service";
import { verifySmartContractPayment } from "../services/payment-verifier";

const sessions = new Hono();

const createSessionSchema = z.object({
  merchantId: z.string().uuid(),
  amountUsdcUnits: z.coerce.bigint().positive(),
  sourceChain: z.string().min(2).default("solana"),
});

const submitSignatureSchema = z.object({
  txSignature: z.string().min(64),
  payerAddress: z.string().min(32),
  sourceChain: z.string().min(2).optional(),
  sourceTxHash: z.string().min(10).optional(),
});

function serializeSession(session: Awaited<ReturnType<typeof createMerchantSession>>) {
  return {
    sessionId: session.id,
    merchantId: session.merchantId,
    terminalId: session.terminalId,
    amountUsdcUnits: bigintToString(session.amountUsdcUnits),
    merchantAmountUsdcUnits: bigintToString(session.merchantAmountUsdcUnits),
    platformAmountUsdcUnits: bigintToString(session.platformAmountUsdcUnits),
    platformFeeBps: session.platformFeeBps,
    currency: session.currency,
    sourceChain: session.sourceChain,
    settlementChain: session.settlementChain,
    tokenMint: session.tokenMint,
    tokenDecimals: session.tokenDecimals,
    status: session.status,
    merchant: {
      id: session.merchant.id,
      name: session.merchant.name,
      walletAddress: session.merchant.walletAddress,
      usdcTokenAccount: session.merchant.usdcTokenAccount,
      platformFeeBps: session.merchant.platformFeeBps,
    },
    platformUsdcTokenAccount: getPlatformUsdcTokenAccount(),
    programId: env.PULSE_PAYMENT_PROGRAM_ID,
    expiresAt: session.expiresAt.toISOString(),
  };
}

sessions.post("/", async (c) => {
  const parsed = await parseJsonBody(c, createSessionSchema);
  if (parsed instanceof Response) return parsed;

  try {
    const session = await createMerchantSession({
      merchantId: parsed.merchantId,
      amountUsdcUnits: parsed.amountUsdcUnits,
      sourceChain: parsed.sourceChain,
    });

    return c.json(
      {
        ...serializeSession(session),
        checkoutUrl: `${env.NEXT_PUBLIC_APP_URL}/pay/${session.id}`,
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === "MERCHANT_NOT_FOUND") {
      return c.json({ error: "Merchant not found" }, 404);
    }

    throw error;
  }
});

sessions.get("/:id/status", async (c) => {
  const id = c.req.param("id");
  const session = await expireSessionIfNeeded(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    sessionId: session.id,
    status: session.status,
    txSignature: session.txSignature,
    confirmedAt: session.confirmedAt?.toISOString() ?? null,
  });
});

sessions.post("/:id/submit-signature", async (c) => {
  const id = c.req.param("id");
  const parsed = await parseJsonBody(c, submitSignatureSchema);
  if (parsed instanceof Response) return parsed;

  const result = await verifySmartContractPayment({
    sessionId: id,
    txSignature: parsed.txSignature,
    payerAddress: parsed.payerAddress,
    sourceChain: parsed.sourceChain,
    sourceTxHash: parsed.sourceTxHash,
  });

  if (result.status === "confirmed") {
    return c.json({
      success: true,
      status: result.status,
      txSignature: result.txSignature,
    });
  }

  const statusCode = result.status === "submitted" ? 202 : 400;
  return c.json(
    {
      success: false,
      status: result.status,
      message: result.reason,
    },
    statusCode
  );
});

sessions.get("/:id", async (c) => {
  const id = c.req.param("id");
  const maybeExpired = await expireSessionIfNeeded(id);

  if (!maybeExpired) {
    return c.json({ error: "Session not found" }, 404);
  }

  const session = await prisma.session.findUnique({
    where: { id },
    include: { merchant: true },
  });

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json(serializeSession(session));
});

export { sessions };
