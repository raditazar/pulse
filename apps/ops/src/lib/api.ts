import type {
  CreateMerchantInput,
  CreateMerchantResponse,
  CreateSessionInput,
  CreateSessionResponse,
  GetMerchantMeQuery,
  PulseMerchantRecord,
  PulseSessionRecord,
  SessionStatus,
} from "@pulse/types";

const actionApiUrl =
  process.env.NEXT_PUBLIC_ACTION_API_URL ?? "http://localhost:8000/api";

const apiBase = actionApiUrl.replace(/\/$/, "").endsWith("/api")
  ? actionApiUrl.replace(/\/$/, "")
  : `${actionApiUrl.replace(/\/$/, "")}/api`;

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
    throw new Error(`${message} [${response.status} ${response.url}]`);
  }
  return body as T;
}

export async function getMerchantMe(
  query: GetMerchantMeQuery,
): Promise<PulseMerchantRecord | null> {
  const params = new URLSearchParams();
  if (query.privyUserId) params.set("privyUserId", query.privyUserId);
  if (query.wallet) params.set("wallet", query.wallet);
  const response = await fetch(`${apiBase}/merchants/me?${params.toString()}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  const body = await parseJson<{ merchant: PulseMerchantRecord }>(response);
  return body.merchant;
}

export async function getMerchantByRef(
  merchantRef: string,
): Promise<PulseMerchantRecord | null> {
  const response = await fetch(`${apiBase}/merchants/${merchantRef}`, {
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  const body = await parseJson<{ merchant: PulseMerchantRecord }>(response);
  return body.merchant;
}

export async function createMerchant(
  payload: CreateMerchantInput,
): Promise<CreateMerchantResponse> {
  const response = await fetch(`${apiBase}/merchants`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<CreateMerchantResponse>(response);
}

export async function createSession(
  payload: CreateSessionInput,
): Promise<CreateSessionResponse> {
  const response = await fetch(`${apiBase}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<CreateSessionResponse>(response);
}

export type MerchantSummary = {
  totalVolumeUsdc: string;
  totalTransactions: number;
  successfulTransactions: number;
  pendingSessions: number;
  failedSessions: number;
  activeTerminals: number;
  date: string;
};

export type MerchantVolumePoint = {
  date: string;
  volumeUsdc: string;
  transactions: number;
};

export type MerchantTerminal = {
  id: string;
  merchantId: string;
  label: string;
  nfcCode: string;
  currentSessionId?: string | null;
  tapUrl: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateTerminalInput = {
  merchantId: string;
  label: string;
  nfcCode: string;
};

export type MerchantTransaction = {
  id: string;
  sessionId: string;
  sessionPda: string;
  txSignature: string;
  payerAddress: string;
  chain: string;
  sourceChain: string;
  sourceTxHash: string | null;
  settlementChain: string;
  amountUsdc: string | null;
  splitBreakdown: unknown;
  merchantAmountUsdcUnits: string;
  platformAmountUsdcUnits: string;
  tokenMint: string | null;
  confirmedAt: string;
  paidAt: string;
  session: {
    amountUsdc: string;
    amountUsdcUnits: string;
    createdAt: string;
  };
};

export type CreateMerchantSessionInput = {
  amountUsdc?: string;
  amountUsdcUnits?: string;
  sourceChain?: string;
};

export type CreateMerchantSessionResponse = {
  sessionId: string;
  sessionPda: string;
  sessionSeed: string;
  terminal: MerchantTerminal;
  amountUsdcUnits: string;
  merchantAmountUsdcUnits: string;
  platformAmountUsdcUnits: string;
  platformFeeBps: number;
  currency: "USDC";
  sourceChain: string;
  settlementChain: string;
  tokenMint: string;
  tokenDecimals: number;
  status: SessionStatus;
  expiresAt: string;
  checkoutUrl: string;
};

export type UpdateMerchantInput = Partial<{
  name: string;
  metadataUri: string | null;
  profilePhotoUrl: string | null;
  walletAddress: string;
  usdcTokenAccount: string;
  primaryBeneficiary: string;
  platformFeeBps: number;
  splitBasisPoints: number;
  isActive: boolean;
}>;

export async function updateMerchant(
  merchantRef: string,
  payload: UpdateMerchantInput,
): Promise<PulseMerchantRecord> {
  const response = await fetch(`${apiBase}/merchants/${merchantRef}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ merchant: PulseMerchantRecord }>(response);
  return body.merchant;
}

export async function uploadMerchantProfilePhoto(
  merchantRef: string,
  file: File,
): Promise<PulseMerchantRecord> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/profile-photo`, {
    method: "POST",
    body: formData,
  });
  const body = await parseJson<{ merchant: PulseMerchantRecord }>(response);
  return body.merchant;
}

export async function getMerchantSummary(merchantRef: string): Promise<MerchantSummary> {
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/summary`, {
    cache: "no-store",
  });
  const body = await parseJson<{ summary: MerchantSummary }>(response);
  return body.summary;
}

export async function getMerchantVolume(
  merchantRef: string,
  days = 14,
): Promise<MerchantVolumePoint[]> {
  const params = new URLSearchParams({ days: String(days) });
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/volume?${params}`, {
    cache: "no-store",
  });
  const body = await parseJson<{ points: MerchantVolumePoint[] }>(response);
  return body.points;
}

export async function getMerchantSessions(
  merchantRef: string,
  limit = 20,
): Promise<PulseSessionRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/sessions?${params}`, {
    cache: "no-store",
  });
  const body = await parseJson<{ sessions: PulseSessionRecord[] }>(response);
  return body.sessions;
}

export async function createMerchantSession(
  merchantRef: string,
  payload: CreateMerchantSessionInput,
): Promise<CreateMerchantSessionResponse> {
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<CreateMerchantSessionResponse>(response);
}

export interface FundMerchantResponse {
  funded: boolean;
  reason: string;
  txSignature?: string;
  recipientBalanceLamportsAfter: number;
  funderAddress: string;
}

/**
 * Tops up the merchant authority with devnet SOL from the action-api funding pool.
 * Idempotent: when the balance is sufficient, returns `funded: false`.
 */
export async function fundMerchantSol(
  merchantRef: string,
): Promise<FundMerchantResponse> {
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/fund`, {
    method: "POST",
  });
  return parseJson<FundMerchantResponse>(response);
}

export async function cancelSession(sessionRef: string): Promise<{
  success: true;
  sessionId: string;
  status: SessionStatus;
}> {
  const response = await fetch(`${apiBase}/sessions/${sessionRef}/cancel`, {
    method: "POST",
  });
  return parseJson<{
    success: true;
    sessionId: string;
    status: SessionStatus;
  }>(response);
}

export async function getMerchantTerminals(
  merchantRef: string,
): Promise<MerchantTerminal[]> {
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/terminals`, {
    cache: "no-store",
  });
  const body = await parseJson<{ terminals: MerchantTerminal[] }>(response);
  return body.terminals;
}

export async function createTerminal(payload: CreateTerminalInput): Promise<MerchantTerminal> {
  const response = await fetch(`${apiBase}/terminals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<MerchantTerminal>(response);
}

export async function getMerchantTransactions(
  merchantRef: string,
  options: { limit?: number; offset?: number } = {},
): Promise<MerchantTransaction[]> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
  });
  const response = await fetch(`${apiBase}/merchants/${merchantRef}/transactions?${params}`, {
    cache: "no-store",
  });
  const body = await parseJson<{ transactions: MerchantTransaction[] }>(response);
  return body.transactions;
}
