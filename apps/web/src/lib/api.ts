import type {
  CheckoutSessionResponse,
  RecordTransactionInput,
  RecordTransactionResponse,
} from "@pulse/types";

const apiBase =
  process.env.NEXT_PUBLIC_ACTION_API_URL ?? "http://localhost:8000/api";

export async function fetchCheckoutSession(
  sessionRef: string,
): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${apiBase}/sessions/${sessionRef}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load checkout session");
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
    throw new Error(body.error ?? "Failed to record transaction");
  }

  return response.json();
}
