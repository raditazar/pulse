import { Hono } from "hono";
import { Prisma, prisma } from "@pulse/database";
import { z } from "zod";

const transactions = new Hono();

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

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        sessionId: session.id,
        txSignature: parsed.data.txSignature,
        payerAddress: parsed.data.payerAddress,
        tokenMint: parsed.data.tokenMint ?? null,
        chain: parsed.data.chain,
        amountUsdc: parsed.data.amountUsdc
          ? new Prisma.Decimal(parsed.data.amountUsdc)
          : null,
        splitBreakdown: (parsed.data.splitBreakdown as Prisma.InputJsonValue | null | undefined) ?? undefined,
      },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: {
        status: "paid",
        paidBy: parsed.data.payerAddress,
      },
    }),
  ]);

  return c.json(
    {
      success: true,
      transactionId: transaction.id,
      txSignature: transaction.txSignature,
    },
    201,
  );
});

export { transactions };
