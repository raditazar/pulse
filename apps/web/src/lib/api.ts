import type {
  CheckoutSessionResponse,
  RecordTransactionInput,
  RecordTransactionResponse,
} from "@pulse/types";

const actionApiUrl =
  process.env.NEXT_PUBLIC_ACTION_API_URL ?? "http://localhost:8000/api";

const apiBase = actionApiUrl.replace(/\/$/, "").endsWith("/api")
  ? actionApiUrl.replace(/\/$/, "")
  : `${actionApiUrl.replace(/\/$/, "")}/api`;

export async function fetchCheckoutSession(
  sessionRef: string,
): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${apiBase}/sessions/${sessionRef}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = (body as { error?: unknown }).error;
    const message =
      typeof error === "string"
        ? error
        : error
          ? JSON.stringify(error)
          : `Failed to load checkout session (${response.status})`;
    throw new Error(`${message} [${response.status} ${response.url}]`);
  }

  return response.json();
}

export async function recordCheckoutTransaction(
  payload: RecordTransactionInput,
): Promise<RecordTransactionResponse> {
  const response = await fetch(`${apiBase}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = (body as { error?: unknown }).error;
    const message =
      typeof error === "string"
        ? error
        : error
          ? JSON.stringify(error)
          : `Failed to record transaction (${response.status})`;
    throw new Error(`${message} [${response.status} ${response.url}]`);
  }

  return response.json();
}
