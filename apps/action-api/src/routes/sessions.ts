import { prisma } from "../lib/database";
import { Hono } from "hono";
import { z } from "zod";
import { env, getPlatformUsdcTokenAccount, publicAppUrl } from "../lib/env";
import { bigintToString, parseJsonBody } from "../lib/http";
import { verifySmartContractPayment } from "../services/payment-verifier";
import {
  buildCheckoutResponse,
  buildCreateSessionData,
  buildCreateSessionResponse,
} from "../services/pulse";
import { createMerchantSession, expireSessionIfNeeded } from "../services/session-service";

const sessions = new Hono();

const createTerminalSessionSchema = z.object({
  merchantId: z.string().uuid(),
  amountUsdcUnits: z.coerce.bigint().positive(),
  sourceChain: z.string().min(2).default("solana"),
});

const createPulseSessionSchema = z
  .object({
    merchantId: z.string().uuid().optional(),
    merchantPda: z.string().optional(),
    amountUsdc: z.string().min(1),
    expiresAt: z.string().datetime().optional(),
    sessionSeed: z.string().optional(),
  })
  .refine((value) => value.merchantId || value.merchantPda, {
    message: "merchantId or merchantPda is required",
    path: ["merchantId"],
  });

const submitSignatureSchema = z.object({
  txSignature: z.string().min(64),
  payerAddress: z.string().min(32),
  sourceChain: z.string().min(2).optional(),
  sourceTxHash: z.string().min(10).optional(),
});

type SessionWithMerchant = NonNullable<
  Awaited<ReturnType<typeof prisma.session.findFirst<{ include: { merchant: true } }>>>
>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function serializeSession(session: SessionWithMerchant) {
  return {
    sessionId: session.id,
    sessionPda: session.sessionPda,
    sessionSeed: session.sessionSeed,
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
      merchantPda: session.merchant.merchantPda,
      name: session.merchant.name,
      profilePhotoUrl: session.merchant.profilePhotoUrl,
      primaryBeneficiary: session.merchant.primaryBeneficiary,
      splitBasisPoints: session.merchant.splitBasisPoints,
      splitBeneficiaries: session.merchant.splitBeneficiaries,
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
  const body = await c.req.json().catch(() => null);

  if (body && typeof body === "object" && "amountUsdcUnits" in body) {
    const parsed = createTerminalSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request body", issues: parsed.error.flatten() }, 400);
    }

    try {
      const session = await prisma.$transaction(async (tx) => {
        await tx.session.updateMany({
          where: {
            merchantId: parsed.data.merchantId,
            status: { in: ["pending", "submitted"] },
          },
          data: { status: "cancelled" },
        });

        return createMerchantSession({
          merchantId: parsed.data.merchantId,
          amountUsdcUnits: parsed.data.amountUsdcUnits,
          sourceChain: parsed.data.sourceChain,
          db: tx,
        });
      });

      return c.json(
        {
          ...serializeSession(session),
          checkoutUrl: `${publicAppUrl}/pay/${session.id}`,
        },
        201
      );
    } catch (error) {
      if (error instanceof Error && error.message === "MERCHANT_NOT_FOUND") {
        return c.json({ error: "Merchant not found" }, 404);
      }

      throw error;
    }
  }

  const parsed = createPulseSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [
        parsed.data.merchantId ? { id: parsed.data.merchantId } : undefined,
        parsed.data.merchantPda ? { merchantPda: parsed.data.merchantPda } : undefined,
      ].filter(Boolean) as { id?: string; merchantPda?: string }[],
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const session = await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: {
        merchantId: merchant.id,
        status: { in: ["pending", "submitted"] },
      },
      data: { status: "cancelled" },
    });

    return tx.session.create({
      data: buildCreateSessionData(parsed.data, merchant),
    });
  });

  return c.json(buildCreateSessionResponse(session, merchant, publicAppUrl), 201);
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

sessions.post("/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const session = await prisma.session.findFirst({
    where: {
      OR: [
        isUuid(id) ? { id } : undefined,
        { sessionPda: id },
        { sessionSeed: id },
      ].filter(Boolean) as { id?: string; sessionPda?: string; sessionSeed?: string }[],
    },
    include: { merchant: true },
  });

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (session.status !== "pending" && session.status !== "submitted") {
    return c.json({ error: `Session is ${session.status} and cannot be cancelled` }, 409);
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id: session.id },
      data: { status: "cancelled" },
      include: { merchant: true },
    });

    if (session.terminalId) {
      await tx.terminal.updateMany({
        where: {
          id: session.terminalId,
          currentSessionId: session.id,
        },
        data: { currentSessionId: null },
      });
    }

    return updated;
  });

  return c.json({
    success: true,
    sessionId: cancelled.id,
    status: cancelled.status,
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
  const session = await prisma.session.findFirst({
    where: {
      OR: [
        isUuid(id) ? { id } : undefined,
        { sessionPda: id },
        { sessionSeed: id },
      ].filter(Boolean) as { id?: string; sessionPda?: string; sessionSeed?: string }[],
    },
    include: { merchant: true },
  });

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (
    session.expiresAt <= new Date() &&
    (session.status === "pending" || session.status === "submitted")
  ) {
    const expired = await prisma.session.update({
      where: { id: session.id },
      data: { status: "expired" },
      include: { merchant: true },
    });
    return c.json(serializeSession(expired));
  }

  if (session.amountUsdcUnits > 0n || session.terminalId) {
    return c.json(serializeSession(session));
  }

  const payload = buildCheckoutResponse(session, session.merchant);
  if (payload.session.status === "paid") {
    return c.json(payload);
  }
  if (new Date(payload.session.expiresAt).getTime() < Date.now()) {
    payload.session.status = "expired";
  }

  return c.json(payload);
});

export { sessions };

