import { prisma } from "@pulse/database";
import { env } from "../lib/env";

const BPS_DENOMINATOR = 10_000n;

export function calculateSplit(amountUsdcUnits: bigint, platformFeeBps: number) {
  const platformAmountUsdcUnits =
    (amountUsdcUnits * BigInt(platformFeeBps)) / BPS_DENOMINATOR;
  const merchantAmountUsdcUnits = amountUsdcUnits - platformAmountUsdcUnits;

  return {
    merchantAmountUsdcUnits,
    platformAmountUsdcUnits,
  };
}

export function buildExpiresAt(now = new Date()) {
  return new Date(now.getTime() + env.SESSION_TTL_SECONDS * 1000);
}

export async function expireSessionIfNeeded(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) return null;
  if (
    session.expiresAt <= new Date() &&
    (session.status === "pending" || session.status === "submitted")
  ) {
    return prisma.session.update({
      where: { id: session.id },
      data: { status: "expired" },
    });
  }

  return session;
}

export async function createMerchantSession(input: {
  merchantId: string;
  terminalId?: string;
  amountUsdcUnits: bigint;
  sourceChain?: string;
  db?: Pick<typeof prisma, "merchant" | "session">;
}) {
  const db = input.db ?? prisma;
  const merchant = await db.merchant.findUnique({
    where: { id: input.merchantId },
  });

  if (!merchant) {
    throw new Error("MERCHANT_NOT_FOUND");
  }

  const split = calculateSplit(input.amountUsdcUnits, merchant.platformFeeBps);

  return db.session.create({
    data: {
      merchantId: merchant.id,
      terminalId: input.terminalId,
      amountUsdcUnits: input.amountUsdcUnits,
      merchantAmountUsdcUnits: split.merchantAmountUsdcUnits,
      platformAmountUsdcUnits: split.platformAmountUsdcUnits,
      platformFeeBps: merchant.platformFeeBps,
      sourceChain: input.sourceChain ?? "solana",
      settlementChain: "solana",
      tokenMint: env.USDC_MINT,
      tokenDecimals: 6,
      expiresAt: buildExpiresAt(),
      status: "pending",
    },
    include: { merchant: true },
  });
}
