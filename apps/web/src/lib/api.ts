import type {
  CheckoutSessionResponse,
  PulseMerchantRecord,
  PulseSessionRecord,
  RecordTransactionInput,
  RecordTransactionResponse,
  SessionStatus,
} from "@pulse/types";

const actionApiUrl =
  process.env.NEXT_PUBLIC_ACTION_API_URL ?? "http://localhost:8000/api";

const apiBase = actionApiUrl.replace(/\/$/, "").endsWith("/api")
  ? actionApiUrl.replace(/\/$/, "")
  : `${actionApiUrl.replace(/\/$/, "")}/api`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(`${message} [${status} ${url}]`);
    this.name = "ApiError";
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = (body as { error?: unknown }).error;
    const message =
      typeof error === "string"
        ? error
        : error
          ? JSON.stringify(error)
          : `API request failed (${response.status})`;
    throw new ApiError(message, response.status, response.url);
  }

  return body as T;
}

type TerminalCheckoutResponse = {
  sessionId: string;
  sessionPda?: string;
  sessionSeed?: string;
  merchantId: string;
  terminalId?: string | null;
  amountUsdcUnits: string;
  merchantAmountUsdcUnits: string;
  platformAmountUsdcUnits: string;
  platformFeeBps: number;
  currency: "USDC";
  sourceChain: string;
  settlementChain: "solana";
  tokenMint: string;
  tokenDecimals: 6;
  status: SessionStatus;
  merchant: {
    id: string;
    name: string | null;
    walletAddress: string;
    usdcTokenAccount: string;
    platformFeeBps?: number;
  };
  platformUsdcTokenAccount: string;
  programId: string;
  expiresAt: string;
};

function unitsToUsdc(units: string) {
  return (Number(units) / 1_000_000).toFixed(2);
}

function isTerminalCheckoutResponse(payload: unknown): payload is TerminalCheckoutResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "sessionId" in payload &&
      "amountUsdcUnits" in payload &&
      "merchant" in payload &&
      !("session" in payload),
  );
}

function normalizeTerminalCheckout(payload: TerminalCheckoutResponse): CheckoutSessionResponse {
  const merchant = {
    id: payload.merchant.id,
    merchantPda: payload.merchant.id,
    privyUserId: "",
    authority: payload.merchant.walletAddress,
    primaryBeneficiary: payload.merchant.walletAddress,
    splitBasisPoints: payload.platformFeeBps,
    splitBeneficiaries: [],
    name: payload.merchant.name,
    walletAddress: payload.merchant.walletAddress,
    usdcTokenAccount: payload.merchant.usdcTokenAccount,
    platformFeeBps: payload.merchant.platformFeeBps ?? payload.platformFeeBps,
    isActive: true,
  } satisfies PulseMerchantRecord;

  const session = {
    id: payload.sessionId,
    sessionPda: payload.sessionPda ?? payload.sessionId,
    sessionSeed: payload.sessionSeed ?? payload.sessionId,
    merchantPda: merchant.merchantPda,
    merchantId: payload.merchantId,
    amountUsdc: unitsToUsdc(payload.amountUsdcUnits),
    expiresAt: payload.expiresAt,
    status: payload.status,
    checkoutPath: `/pay/${payload.sessionId}`,
    paidBy: null,
  } satisfies PulseSessionRecord;

  return {
    session,
    merchant,
    programId: payload.programId,
    cluster: "devnet",
  };
}

function normalizeCheckoutSession(payload: unknown): CheckoutSessionResponse {
  if (isTerminalCheckoutResponse(payload)) {
    return normalizeTerminalCheckout(payload);
  }
  return payload as CheckoutSessionResponse;
}

export async function fetchCheckoutSession(
  sessionRef: string,
): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${apiBase}/sessions/${sessionRef}`, {
    cache: "no-store",
  });

  const payload = await parseJson<unknown>(response);
  return normalizeCheckoutSession(payload);
}

export async function fetchTapSession(nfcCode: string): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${apiBase}/tap/${nfcCode}`, {
    cache: "no-store",
  });
  const payload = await parseJson<unknown>(response);
  return normalizeCheckoutSession(payload);
}

export async function recordCheckoutTransaction(
  payload: RecordTransactionInput,
): Promise<RecordTransactionResponse> {
  const response = await fetch(`${apiBase}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJson<RecordTransactionResponse>(response);
}
