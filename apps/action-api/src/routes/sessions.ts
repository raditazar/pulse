import { Hono } from "hono";
import { z } from "zod";

import { prisma } from "@pulse/database";
import {
  buildCheckoutResponse,
  buildCreateSessionData,
  buildCreateSessionResponse,
} from "../services/pulse";

const sessions = new Hono();

const createSessionSchema = z.object({
  merchantId: z.string().uuid().optional(),
  merchantPda: z.string().optional(),
  amountUsdc: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  sessionSeed: z.string().optional(),
}).refine((value) => value.merchantId || value.merchantPda, {
  message: "merchantId or merchantPda is required",
  path: ["merchantId"],
});

sessions.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [
        parsed.data.merchantId ? { id: parsed.data.merchantId } : undefined,
        parsed.data.merchantPda ? { merchantPda: parsed.data.merchantPda } : undefined,
      ].filter(Boolean) as { id?: string; merchantPda?: string }[],
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  const session = await prisma.session.create({
    data: buildCreateSessionData(parsed.data, merchant),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return c.json(buildCreateSessionResponse(session, merchant, appUrl), 201);
});

sessions.get("/:id", async (c) => {
  const id = c.req.param("id");

  const session = await prisma.session.findFirst({
    where: {
      OR: [{ id }, { sessionPda: id }, { sessionSeed: id }],
    },
    include: { merchant: true },
  });

  if (!session || !session.merchant) {
    return c.json({ error: "Session not found" }, 404);
  }

  const payload = buildCheckoutResponse(session, session.merchant);
  if (payload.session.status === "paid") {
    return c.json(payload);
  }
  if (new Date(payload.session.expiresAt).getTime() < Date.now()) {
    payload.session.status = "expired";
  }

  return c.json(payload);
});

export { sessions };
