import { randomUUID } from "node:crypto";

import { Prisma, type Merchant, type Session } from "@pulse/database";
import {
  SOLANA_CLUSTER,
  createRandomSessionSeed,
  derivePulseMerchantPda,
  derivePulseSessionPda,
  encodeSessionSeed,
  normalizeSessionSeed,
} from "@pulse/solana";
import type {
  CheckoutSessionResponse,
  CreateMerchantInput,
  CreateMerchantResponse,
  CreateSessionInput,
  CreateSessionResponse,
  PulseMerchantRecord,
  PulseSessionRecord,
  SolanaCluster,
} from "@pulse/types";
import { PublicKey } from "@solana/web3.js";
import { env } from "../lib/env";

const cluster = (process.env.PULSE_SOLANA_CLUSTER ?? SOLANA_CLUSTER) as SolanaCluster;
const pulsePaymentProgramId = new PublicKey(env.PULSE_PAYMENT_PROGRAM_ID);
const programId = pulsePaymentProgramId.toBase58();

export function pulseRuntime() {
  return {
    cluster,
    programId,
  };
}

export function mapMerchantRecord(merchant: Merchant): PulseMerchantRecord {
  return {
    id: merchant.id,
    merchantPda: merchant.merchantPda,
    privyUserId: merchant.privyUserId,
    authority: merchant.authority,
    email: merchant.email,
    businessType: merchant.businessType,
    primaryBeneficiary: merchant.primaryBeneficiary,
    splitBasisPoints: merchant.splitBasisPoints,
    splitBeneficiaries: Array.isArray(merchant.splitBeneficiaries)
      ? (merchant.splitBeneficiaries as PulseMerchantRecord["splitBeneficiaries"])
      : [],
    metadataUri: merchant.metadataUri,
    name: merchant.name,
    walletAddress: merchant.walletAddress,
    usdcTokenAccount: merchant.usdcTokenAccount,
    platformFeeBps: merchant.platformFeeBps,
    isActive: merchant.isActive,
    createdAt: merchant.createdAt.toISOString(),
    updatedAt: merchant.updatedAt.toISOString(),
  };
}

export function mapSessionRecord(
  session: Session,
  merchant: Merchant,
): PulseSessionRecord {
  return {
    id: session.id,
    sessionPda: session.sessionPda,
    sessionSeed: session.sessionSeed,
    merchantPda: merchant.merchantPda,
    merchantId: merchant.id,
    amountUsdc: session.amountUsdc.toString(),
    expiresAt: session.expiresAt.toISOString(),
    status: session.status as PulseSessionRecord["status"],
    checkoutPath: `/pay/${session.sessionPda}`,
    createdAt: session.createdAt.toISOString(),
    paidBy: session.paidBy,
  };
}

export function buildCreateMerchantData(input: CreateMerchantInput) {
  const authority = new PublicKey(input.authority);
  const primaryBeneficiary = new PublicKey(input.primaryBeneficiary);
  const [merchantPda] = derivePulseMerchantPda(authority, pulsePaymentProgramId);

  return {
    privyUserId: input.privyUserId,
    merchantPda: merchantPda.toBase58(),
    authority: authority.toBase58(),
    email: input.email ?? null,
    businessType: input.businessType ?? null,
    primaryBeneficiary: primaryBeneficiary.toBase58(),
    splitBasisPoints: input.splitBasisPoints,
    splitBeneficiaries: input.splitBeneficiaries ?? [],
    metadataUri: input.metadataUri ?? null,
    name: input.name ?? `Merchant ${authority.toBase58().slice(0, 6)}`,
    isActive: true,
  } satisfies Prisma.MerchantUncheckedCreateInput;
}

export function buildCreateSessionData(
  input: CreateSessionInput,
  merchant: Merchant,
) {
  const merchantPda = new PublicKey(merchant.merchantPda);
  const sessionSeed = input.sessionSeed
    ? normalizeSessionSeed(input.sessionSeed)
    : createRandomSessionSeed();
  const [sessionPda] = derivePulseSessionPda(
    merchantPda,
    sessionSeed,
    pulsePaymentProgramId,
  );
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(Date.now() + 15 * 60 * 1000);

  return {
    id: randomUUID(),
    sessionPda: sessionPda.toBase58(),
    sessionSeed: encodeSessionSeed(sessionSeed),
    merchantId: merchant.id,
    amountUsdc: new Prisma.Decimal(input.amountUsdc),
    expiresAt,
    status: "pending",
  } satisfies Prisma.SessionUncheckedCreateInput;
}

export function buildCheckoutResponse(
  session: Session,
  merchant: Merchant,
): CheckoutSessionResponse {
  return {
    session: mapSessionRecord(session, merchant),
    merchant: mapMerchantRecord(merchant),
    ...pulseRuntime(),
  };
}

export function buildMerchantResponse(
  merchant: Merchant,
): CreateMerchantResponse {
  return {
    merchant: mapMerchantRecord(merchant),
    ...pulseRuntime(),
  };
}

export function buildCreateSessionResponse(
  session: Session,
  merchant: Merchant,
  appUrl: string,
): CreateSessionResponse {
  const payload = buildCheckoutResponse(session, merchant);
  return {
    ...payload,
    checkoutUrl: `${appUrl}${payload.session.checkoutPath}`,
  };
}
