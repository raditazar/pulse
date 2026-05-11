import { prisma } from "@pulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { bigintToString } from "../lib/http";
import {
  buildCheckoutResponse,
  buildCreateMerchantData,
  buildMerchantResponse,
  mapMerchantRecord,
} from "../services/pulse";

const merchants = new Hono();

const createMerchantSchema = z.object({
  authority: z.string().min(32),
  primaryBeneficiary: z.string().min(32),
  splitBasisPoints: z.number().int().min(0).max(10_000).default(1000),
  metadataUri: z.string().optional(),
  name: z.string().optional(),
  splitBeneficiaries: z
    .array(
      z.object({
        wallet: z.string().min(32),
        bps: z.number().int().min(0).max(10_000),
        label: z.string().min(1).max(32),
      })
    )
    .max(4)
    .optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

merchants.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createMerchantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const createData = buildCreateMerchantData(parsed.data);
  const merchant = await prisma.merchant.upsert({
    where: { merchantPda: createData.merchantPda },
    update: createData,
    create: createData,
  });

  return c.json(buildMerchantResponse(merchant), 201);
});

merchants.get("/:id", async (c) => {
  const id = c.req.param("id");
  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [{ id }, { merchantPda: id }],
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  return c.json({
    merchant: mapMerchantRecord(merchant),
    id: merchant.id,
    name: merchant.name,
    walletAddress: merchant.walletAddress,
    usdcTokenAccount: merchant.usdcTokenAccount,
    platformFeeBps: merchant.platformFeeBps,
  });
});

merchants.get("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [{ id }, { merchantPda: id }],
    },
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        take: Number(c.req.query("limit") ?? "20"),
      },
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  return c.json({
    merchant: mapMerchantRecord(merchant),
    sessions: merchant.sessions.map((session) => buildCheckoutResponse(session, merchant).session),
  });
});

merchants.get("/:id/transactions", async (c) => {
  const id = c.req.param("id");
  const query = paginationSchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  if (!query.success) {
    return c.json({ error: "Invalid pagination query" }, 400);
  }

  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [{ id }, { merchantPda: id }],
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const txs = await prisma.transaction.findMany({
    where: {
      session: {
        merchantId: merchant.id,
      },
    },
    include: {
      session: true,
    },
    orderBy: { confirmedAt: "desc" },
    take: query.data.limit,
    skip: query.data.offset,
  });

  return c.json({
    merchant: mapMerchantRecord(merchant),
    transactions: txs.map((tx) => ({
      id: tx.id,
      sessionId: tx.sessionId,
      sessionPda: tx.session.sessionPda,
      txSignature: tx.txSignature,
      payerAddress: tx.payerAddress,
      chain: tx.chain,
      sourceChain: tx.sourceChain,
      sourceTxHash: tx.sourceTxHash,
      settlementChain: tx.settlementChain,
      amountUsdc: tx.amountUsdc?.toString() ?? null,
      splitBreakdown: tx.splitBreakdown,
      merchantAmountUsdcUnits: bigintToString(tx.merchantAmountUsdcUnits),
      platformAmountUsdcUnits: bigintToString(tx.platformAmountUsdcUnits),
      tokenMint: tx.tokenMint,
      confirmedAt: tx.confirmedAt.toISOString(),
      paidAt: tx.paidAt.toISOString(),
      session: {
        amountUsdc: tx.session.amountUsdc.toString(),
        amountUsdcUnits: bigintToString(tx.session.amountUsdcUnits),
        createdAt: tx.session.createdAt.toISOString(),
      },
    })),
    limit: query.data.limit,
    offset: query.data.offset,
  });
});

export { merchants };
