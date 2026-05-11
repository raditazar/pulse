import { prisma } from "@pulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../lib/env";
import { bigintToString, parseJsonBody } from "../lib/http";
import { createMerchantSession } from "../services/session-service";

const terminals = new Hono();

const createTerminalSchema = z.object({
  merchantId: z.string().uuid(),
  label: z.string().min(1),
  nfcCode: z.string().min(3),
});

const createTerminalSessionSchema = z.object({
  amountUsdcUnits: z.coerce.bigint().positive(),
  sourceChain: z.string().min(2).default("solana"),
});

terminals.post("/", async (c) => {
  const parsed = await parseJsonBody(c, createTerminalSchema);
  if (parsed instanceof Response) return parsed;

  const merchant = await prisma.merchant.findUnique({
    where: { id: parsed.merchantId },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const terminal = await prisma.terminal.create({
    data: parsed,
  });

  return c.json(
    {
      id: terminal.id,
      merchantId: terminal.merchantId,
      label: terminal.label,
      nfcCode: terminal.nfcCode,
      tapUrl: `${env.NEXT_PUBLIC_APP_URL}/tap/${terminal.nfcCode}`,
    },
    201
  );
});

terminals.get("/:id", async (c) => {
  const id = c.req.param("id");
  const terminal = await prisma.terminal.findUnique({
    where: { id },
    include: { merchant: true },
  });

  if (!terminal) {
    return c.json({ error: "Terminal not found" }, 404);
  }

  return c.json({
    id: terminal.id,
    merchantId: terminal.merchantId,
    label: terminal.label,
    nfcCode: terminal.nfcCode,
    currentSessionId: terminal.currentSessionId,
    tapUrl: `${env.NEXT_PUBLIC_APP_URL}/tap/${terminal.nfcCode}`,
    merchant: {
      id: terminal.merchant.id,
      name: terminal.merchant.name,
      walletAddress: terminal.merchant.walletAddress,
      usdcTokenAccount: terminal.merchant.usdcTokenAccount,
    },
  });
});

terminals.post("/:id/sessions", async (c) => {
  const id = c.req.param("id");
  const parsed = await parseJsonBody(c, createTerminalSessionSchema);
  if (parsed instanceof Response) return parsed;

  const terminal = await prisma.terminal.findUnique({
    where: { id },
    include: { merchant: true },
  });

  if (!terminal) {
    return c.json({ error: "Terminal not found" }, 404);
  }

  const session = await prisma.$transaction(async (tx) => {
    if (terminal.currentSessionId) {
      await tx.session.updateMany({
        where: {
          id: terminal.currentSessionId,
          status: { in: ["pending", "submitted"] },
        },
        data: { status: "cancelled" },
      });
    }

    const created = await createMerchantSession({
      merchantId: terminal.merchantId,
      terminalId: terminal.id,
      amountUsdcUnits: parsed.amountUsdcUnits,
      sourceChain: parsed.sourceChain,
      db: tx,
    });

    await tx.terminal.update({
      where: { id: terminal.id },
      data: { currentSessionId: created.id },
    });

    return created;
  });

  return c.json(
    {
      sessionId: session.id,
      terminalId: terminal.id,
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
      expiresAt: session.expiresAt.toISOString(),
      checkoutUrl: `${env.NEXT_PUBLIC_APP_URL}/tap/${terminal.nfcCode}`,
    },
    201
  );
});

export { terminals };
