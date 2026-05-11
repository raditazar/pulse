import { prisma } from "@pulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../lib/env";
import { bigintToString } from "../lib/http";
import { createMerchantSession } from "../services/session-service";
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
  walletAddress: z.string().min(32).optional(),
  usdcTokenAccount: z.string().min(32).optional(),
  platformFeeBps: z.number().int().min(0).max(10_000).optional(),
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

const updateMerchantSchema = z.object({
  name: z.string().min(1).optional(),
  metadataUri: z.string().nullable().optional(),
  walletAddress: z.string().min(32).optional(),
  usdcTokenAccount: z.string().min(32).optional(),
  primaryBeneficiary: z.string().min(32).optional(),
  platformFeeBps: z.number().int().min(0).max(10_000).optional(),
  splitBasisPoints: z.number().int().min(0).max(10_000).optional(),
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
  isActive: z.boolean().optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const volumeQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

const createLatestSessionSchema = z
  .object({
    amountUsdc: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
    amountUsdcUnits: z.coerce.bigint().positive().optional(),
    sourceChain: z.string().min(2).default("solana"),
  })
  .refine((value) => value.amountUsdc || value.amountUsdcUnits, {
    message: "amountUsdc or amountUsdcUnits is required",
    path: ["amountUsdc"],
  });

function amountUsdcToUnits(amountUsdc: string) {
  const [whole, fraction = ""] = amountUsdc.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

async function findMerchantByRef(id: string) {
  return prisma.merchant.findFirst({
    where: {
      OR: [{ id }, { merchantPda: id }],
    },
  });
}

function serializeTerminal(terminal: {
  id: string;
  merchantId: string;
  label: string;
  nfcCode: string;
  currentSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: terminal.id,
    merchantId: terminal.merchantId,
    label: terminal.label,
    nfcCode: terminal.nfcCode,
    currentSessionId: terminal.currentSessionId,
    tapUrl: `${env.NEXT_PUBLIC_APP_URL}/tap/${terminal.nfcCode}`,
    createdAt: terminal.createdAt.toISOString(),
    updatedAt: terminal.updatedAt.toISOString(),
  };
}

function serializeTransaction(tx: Awaited<ReturnType<typeof prisma.transaction.findMany>>[number] & {
  session: {
    sessionPda: string;
    amountUsdc: { toString(): string };
    amountUsdcUnits: bigint;
    createdAt: Date;
  };
}) {
  return {
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
  };
}

merchants.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createMerchantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const createData = {
    ...buildCreateMerchantData(parsed.data),
    walletAddress: parsed.data.walletAddress ?? parsed.data.primaryBeneficiary,
    usdcTokenAccount: parsed.data.usdcTokenAccount ?? "",
    platformFeeBps: parsed.data.platformFeeBps ?? parsed.data.splitBasisPoints,
  };
  const merchant = await prisma.merchant.upsert({
    where: { merchantPda: createData.merchantPda },
    update: createData,
    create: createData,
  });

  return c.json(buildMerchantResponse(merchant), 201);
});

merchants.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateMerchantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const merchant = await findMerchantByRef(id);
  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const updated = await prisma.merchant.update({
    where: { id: merchant.id },
    data: parsed.data,
  });

  return c.json({
    merchant: mapMerchantRecord(updated),
    id: updated.id,
    name: updated.name,
    walletAddress: updated.walletAddress,
    usdcTokenAccount: updated.usdcTokenAccount,
    platformFeeBps: updated.platformFeeBps,
  });
});

merchants.get("/:id", async (c) => {
  const id = c.req.param("id");
  const merchant = await findMerchantByRef(id);

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

merchants.get("/:id/summary", async (c) => {
  const id = c.req.param("id");
  const merchant = await findMerchantByRef(id);

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [transactions, sessions, terminals] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        session: { merchantId: merchant.id },
        confirmedAt: { gte: startOfToday },
      },
    }),
    prisma.session.findMany({
      where: { merchantId: merchant.id },
      select: { status: true },
    }),
    prisma.terminal.count({
      where: { merchantId: merchant.id },
    }),
  ]);

  const totalVolumeUsdc = transactions.reduce(
    (total, tx) => total + Number(tx.amountUsdc?.toString() ?? "0"),
    0
  );
  const successful = transactions.length;
  const pending = sessions.filter((session) =>
    ["pending", "submitted"].includes(session.status)
  ).length;
  const failed = sessions.filter((session) =>
    ["failed", "expired", "cancelled"].includes(session.status)
  ).length;

  return c.json({
    merchant: mapMerchantRecord(merchant),
    summary: {
      totalVolumeUsdc: totalVolumeUsdc.toFixed(2),
      totalTransactions: transactions.length,
      successfulTransactions: successful,
      pendingSessions: pending,
      failedSessions: failed,
      activeTerminals: terminals,
      date: startOfToday.toISOString(),
    },
  });
});

merchants.get("/:id/volume", async (c) => {
  const id = c.req.param("id");
  const query = volumeQuerySchema.safeParse({ days: c.req.query("days") });
  if (!query.success) {
    return c.json({ error: "Invalid volume query" }, 400);
  }

  const merchant = await findMerchantByRef(id);
  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - query.data.days + 1);

  const txs = await prisma.transaction.findMany({
    where: {
      session: { merchantId: merchant.id },
      confirmedAt: { gte: start },
    },
    select: {
      amountUsdc: true,
      confirmedAt: true,
    },
  });

  const buckets = new Map<string, { date: string; volumeUsdc: number; transactions: number }>();
  for (let index = 0; index < query.data.days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { date: key, volumeUsdc: 0, transactions: 0 });
  }

  for (const tx of txs) {
    const key = tx.confirmedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.volumeUsdc += Number(tx.amountUsdc?.toString() ?? "0");
    bucket.transactions += 1;
  }

  return c.json({
    merchant: mapMerchantRecord(merchant),
    days: query.data.days,
    points: Array.from(buckets.values()).map((point) => ({
      ...point,
      volumeUsdc: point.volumeUsdc.toFixed(2),
    })),
  });
});

merchants.get("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const merchant = await prisma.merchant.findFirst({
    where: { OR: [{ id }, { merchantPda: id }] },
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

merchants.post("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = createLatestSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const merchant = await findMerchantByRef(id);
  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const amountUsdcUnits =
    parsed.data.amountUsdcUnits ?? amountUsdcToUnits(parsed.data.amountUsdc ?? "0");

  const result = await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: {
        merchantId: merchant.id,
        status: { in: ["pending", "submitted"] },
      },
      data: { status: "cancelled" },
    });

    const terminal =
      (await tx.terminal.findFirst({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: "asc" },
      })) ??
      (await tx.terminal.create({
        data: {
          merchantId: merchant.id,
          label: "Cashier Counter",
          nfcCode: `cashier-${merchant.id}`,
        },
      }));

    const session = await createMerchantSession({
      merchantId: merchant.id,
      terminalId: terminal.id,
      amountUsdcUnits,
      sourceChain: parsed.data.sourceChain,
      db: tx,
    });

    const updatedTerminal = await tx.terminal.update({
      where: { id: terminal.id },
      data: { currentSessionId: session.id },
    });

    return { session, terminal: updatedTerminal };
  });

  return c.json(
    {
      sessionId: result.session.id,
      terminal: serializeTerminal(result.terminal),
      amountUsdcUnits: bigintToString(result.session.amountUsdcUnits),
      merchantAmountUsdcUnits: bigintToString(result.session.merchantAmountUsdcUnits),
      platformAmountUsdcUnits: bigintToString(result.session.platformAmountUsdcUnits),
      platformFeeBps: result.session.platformFeeBps,
      currency: result.session.currency,
      sourceChain: result.session.sourceChain,
      settlementChain: result.session.settlementChain,
      tokenMint: result.session.tokenMint,
      tokenDecimals: result.session.tokenDecimals,
      status: result.session.status,
      expiresAt: result.session.expiresAt.toISOString(),
      checkoutUrl: `${env.NEXT_PUBLIC_APP_URL}/tap/${result.terminal.nfcCode}`,
    },
    201
  );
});

merchants.get("/:id/terminals", async (c) => {
  const id = c.req.param("id");
  const merchant = await findMerchantByRef(id);

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const terminals = await prisma.terminal.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    merchant: mapMerchantRecord(merchant),
    terminals: terminals.map(serializeTerminal),
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

  const merchant = await findMerchantByRef(id);

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
    transactions: txs.map(serializeTransaction),
    limit: query.data.limit,
    offset: query.data.offset,
  });
});

export { merchants };
