import { Prisma, prisma } from "@pulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { bigintToString, parseJsonBody } from "../lib/http";
import { verifySmartContractPayment } from "../services/payment-verifier";

const transactions = new Hono();

const submitTransactionSchema = z.object({
  sessionId: z.string().uuid(),
  txSignature: z.string().min(64),
  payerAddress: z.string().min(32),
  sourceChain: z.string().min(2).optional(),
  sourceTxHash: z.string().min(10).optional(),
});

const recordTransactionSchema = z.object({
  sessionPda: z.string().min(32),
  sessionId: z.string().uuid(),
  txSignature: z.string().min(16),
  payerAddress: z.string().min(32),
  tokenMint: z.string().optional().nullable(),
  chain: z.string().default("solana"),
  amountUsdc: z.string().optional(),
  splitBreakdown: z.record(z.string(), z.unknown()).optional().nullable(),
});

transactions.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (body && typeof body === "object" && "sessionPda" in body) {
    const parsed = recordTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const session = await prisma.session.findFirst({
      where: {
        OR: [{ id: parsed.data.sessionId }, { sessionPda: parsed.data.sessionPda }],
      },
    });

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          sessionId: session.id,
          txSignature: parsed.data.txSignature,
          payerAddress: parsed.data.payerAddress,
          tokenMint: parsed.data.tokenMint ?? null,
          chain: parsed.data.chain,
          sourceChain: parsed.data.chain,
          amountUsdc: parsed.data.amountUsdc
            ? new Prisma.Decimal(parsed.data.amountUsdc)
            : null,
          splitBreakdown:
            (parsed.data.splitBreakdown as Prisma.InputJsonValue | null | undefined) ??
            undefined,
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: {
          status: "paid",
          paidBy: parsed.data.payerAddress,
        },
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

      return created;
    });

    return c.json(
      {
        success: true,
        transactionId: transaction.id,
        txSignature: transaction.txSignature,
      },
      201
    );
  }

  const parsed = submitTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", issues: parsed.error.flatten() }, 400);
  }

  const result = await verifySmartContractPayment(parsed.data);

  if (result.status === "confirmed") {
    return c.json(
      {
        success: true,
        status: result.status,
        txSignature: result.txSignature,
      },
      201
    );
  }

  return c.json(
    {
      success: false,
      status: result.status,
      message: result.reason,
    },
    result.status === "submitted" ? 202 : 400
  );
});

transactions.get("/:signature", async (c) => {
  const txSignature = c.req.param("signature");
  const transaction = await prisma.transaction.findUnique({
    where: { txSignature },
    include: { session: true },
  });

  if (!transaction) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  return c.json({
    id: transaction.id,
    sessionId: transaction.sessionId,
    sessionPda: transaction.session.sessionPda,
    txSignature: transaction.txSignature,
    payerAddress: transaction.payerAddress,
    chain: transaction.chain,
    sourceChain: transaction.sourceChain,
    sourceTxHash: transaction.sourceTxHash,
    settlementChain: transaction.settlementChain,
    amountUsdc: transaction.amountUsdc?.toString() ?? null,
    merchantAmountUsdcUnits: bigintToString(transaction.merchantAmountUsdcUnits),
    platformAmountUsdcUnits: bigintToString(transaction.platformAmountUsdcUnits),
    tokenMint: transaction.tokenMint,
    tokenDecimals: transaction.tokenDecimals,
    confirmedAt: transaction.confirmedAt.toISOString(),
    paidAt: transaction.paidAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
  });
});

export { transactions };
