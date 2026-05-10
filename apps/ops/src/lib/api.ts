import type {
  CreateMerchantInput,
  CreateMerchantResponse,
  CreateSessionInput,
  CreateSessionResponse,
  PulseMerchantRecord,
} from "@pulse/types";

const apiBase =
  process.env.NEXT_PUBLIC_ACTION_API_URL ?? "http://localhost:8000/api";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? "API request failed");
  }
  return body as T;
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
