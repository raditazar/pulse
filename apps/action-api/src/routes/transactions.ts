import { prisma } from "@pulse/database";
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

transactions.post("/", async (c) => {
  const parsed = await parseJsonBody(c, submitTransactionSchema);
  if (parsed instanceof Response) return parsed;

  const result = await verifySmartContractPayment(parsed);

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
    txSignature: transaction.txSignature,
    payerAddress: transaction.payerAddress,
    sourceChain: transaction.sourceChain,
    sourceTxHash: transaction.sourceTxHash,
    settlementChain: transaction.settlementChain,
    merchantAmountUsdcUnits: bigintToString(transaction.merchantAmountUsdcUnits),
    platformAmountUsdcUnits: bigintToString(transaction.platformAmountUsdcUnits),
    tokenMint: transaction.tokenMint,
    tokenDecimals: transaction.tokenDecimals,
    confirmedAt: transaction.confirmedAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
  });
});

export { transactions };
