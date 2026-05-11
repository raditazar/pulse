import type {
  CreateMerchantInput,
  CreateMerchantResponse,
  CreateSessionInput,
  CreateSessionResponse,
  GetMerchantMeQuery,
  PulseMerchantRecord,
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
