import { prisma } from "@pulse/database";
import { Hono } from "hono";
import { env, getPlatformUsdcTokenAccount } from "../lib/env";
import { bigintToString } from "../lib/http";

const tap = new Hono();

tap.get("/:nfcCode", async (c) => {
  const nfcCode = c.req.param("nfcCode");
  const terminal = await prisma.terminal.findUnique({
    where: { nfcCode },
    include: { merchant: true },
  });

  if (!terminal) {
    return c.json({ error: "Terminal not found" }, 404);
  }

  if (!terminal.currentSessionId) {
    return c.json({ error: "No active session for terminal" }, 404);
  }

  const session = await prisma.session.findUnique({
    where: { id: terminal.currentSessionId },
    include: { merchant: true },
  });

  if (!session) {
    await prisma.terminal.update({
      where: { id: terminal.id },
      data: { currentSessionId: null },
    });
    return c.json({ error: "Active session not found" }, 404);
  }

  if (session.status !== "pending" && session.status !== "submitted") {
    await prisma.terminal.update({
      where: { id: terminal.id },
      data: { currentSessionId: null },
    });

    return c.json({ error: "No active session for terminal" }, 404);
  }

  if (
    session.expiresAt <= new Date() &&
    (session.status === "pending" || session.status === "submitted")
  ) {
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { status: "expired" },
      }),
      prisma.terminal.update({
        where: { id: terminal.id },
        data: { currentSessionId: null },
      }),
    ]);

    return c.json({ error: "Active session expired" }, 410);
  }

  return c.json({
    sessionId: session.id,
    terminalId: terminal.id,
    status: session.status,
    amountUsdcUnits: bigintToString(session.amountUsdcUnits),
    merchantAmountUsdcUnits: bigintToString(session.merchantAmountUsdcUnits),
    platformAmountUsdcUnits: bigintToString(session.platformAmountUsdcUnits),
    platformFeeBps: session.platformFeeBps,
    currency: session.currency,
    sourceChain: session.sourceChain,
    settlementChain: session.settlementChain,
    tokenMint: session.tokenMint,
    tokenDecimals: session.tokenDecimals,
    merchant: {
      id: session.merchant.id,
      name: session.merchant.name,
      walletAddress: session.merchant.walletAddress,
      usdcTokenAccount: session.merchant.usdcTokenAccount,
    },
    platformUsdcTokenAccount: getPlatformUsdcTokenAccount(),
    programId: env.PULSE_PAYMENT_PROGRAM_ID,
    expiresAt: session.expiresAt.toISOString(),
  });
});

export { tap };
