import { Hono } from "hono";
import { z } from "zod";

import { prisma } from "@pulse/database";
import {
  buildCreateMerchantData,
  buildMerchantResponse,
  buildCheckoutResponse,
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
      }),
    )
    .max(4)
    .optional(),
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

  return c.json({ merchant: mapMerchantRecord(merchant) });
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
  const limit = Number(c.req.query("limit") ?? "20");
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
    orderBy: { paidAt: "desc" },
    take: limit,
  });

  return c.json({
    merchant: mapMerchantRecord(merchant),
    transactions: txs.map((tx) => ({
      id: tx.id,
      txSignature: tx.txSignature,
      payerAddress: tx.payerAddress,
      chain: tx.chain,
      tokenMint: tx.tokenMint,
      amountUsdc: tx.amountUsdc?.toString() ?? null,
      splitBreakdown: tx.splitBreakdown,
      paidAt: tx.paidAt.toISOString(),
      sessionPda: tx.session.sessionPda,
      sessionId: tx.session.id,
    })),
  });
});

export { merchants };
