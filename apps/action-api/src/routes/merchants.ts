import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@pulse/database";
import { bigintToString } from "../lib/http";

const merchants = new Hono();

merchants.get("/:id", async (c) => {
  const id = c.req.param("id");

  const merchant = await prisma.merchant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      walletAddress: true,
      usdcTokenAccount: true,
      platformFeeBps: true,
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  return c.json(merchant);
});

merchants.get("/:id/transactions", async (c) => {
  const id = c.req.param("id");
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  });
  const query = querySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  if (!query.success) {
    return c.json({ error: "Invalid pagination query" }, 400);
  }

  const txs = await prisma.transaction.findMany({
    where: {
      session: {
        merchantId: id,
      },
    },
    include: {
      session: {
        select: {
          amountUsdcUnits: true,
          createdAt: true,
        },
      },
    },
    orderBy: { confirmedAt: "desc" },
    take: query.data.limit,
    skip: query.data.offset,
  });

  return c.json({
    transactions: txs.map((tx) => ({
      id: tx.id,
      sessionId: tx.sessionId,
      txSignature: tx.txSignature,
      payerAddress: tx.payerAddress,
      sourceChain: tx.sourceChain,
      sourceTxHash: tx.sourceTxHash,
      settlementChain: tx.settlementChain,
      merchantAmountUsdcUnits: bigintToString(tx.merchantAmountUsdcUnits),
      platformAmountUsdcUnits: bigintToString(tx.platformAmountUsdcUnits),
      tokenMint: tx.tokenMint,
      confirmedAt: tx.confirmedAt.toISOString(),
      session: {
        amountUsdcUnits: bigintToString(tx.session.amountUsdcUnits),
        createdAt: tx.session.createdAt.toISOString(),
      },
    })),
    limit: query.data.limit,
    offset: query.data.offset,
  });
});

export { merchants };
