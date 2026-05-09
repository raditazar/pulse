/**
 * Circle Iris API client — fetch CCTP V2 attestations untuk testnet messages.
 *
 * Endpoint: `iris-api-sandbox.circle.com` (testnet). Mainnet endpoint sengaja
 * tidak diekspos di package ini.
 *
 * Flow:
 * 1. User burn USDC di EVM via `depositForBurnWithHook` → tx hash di EVM
 * 2. Circle attestation service witness event → publish attestation (~13-30s)
 * 3. Call `fetchAttestation({ srcDomain, txHash })` sampai status === "complete"
 * 4. Submit `message + attestation` ke MessageTransmitterV2.receive_message di Solana
 */

import { IRIS_API_BASE } from "./addresses";
import type { CctpDomain, IrisAttestationMessage, IrisAttestationResponse } from "./types";

export interface FetchAttestationParams {
  srcDomain: CctpDomain;
  txHash: `0x${string}`;
}

export class IrisError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "IrisError";
  }
}

/**
 * Single fetch (no polling). Returns array of attestation messages — biasanya satu burn = satu
 * message, tapi `depositForBurnWithHook` bisa menghasilkan tambahan messages tergantung flow.
 */
export async function fetchAttestation(
  params: FetchAttestationParams,
  fetchImpl: typeof fetch = fetch
): Promise<IrisAttestationResponse> {
  const url = `${IRIS_API_BASE}/v2/messages/${params.srcDomain}?transactionHash=${params.txHash}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new IrisError(
      `Iris fetch failed: HTTP ${res.status} ${res.statusText}`,
      res.status,
      body
    );
  }
  return (await res.json()) as IrisAttestationResponse;
}

export interface PollOptions {
  /** Interval poll (ms). Default 3000. */
  intervalMs?: number;
  /** Max waktu polling (ms) sebelum timeout. Default 180_000 (3 menit). */
  timeoutMs?: number;
  /** Logger callback (status/timing). */
  onTick?: (info: { elapsedMs: number; lastStatus: string | null }) => void;
}

/**
 * Polling helper — tunggu sampai attestation status = "complete" untuk message pertama yang
 * match. Returns message yang complete; throws kalau timeout atau Iris API error.
 */
export async function pollAttestation(
  params: FetchAttestationParams,
  opts: PollOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<IrisAttestationMessage> {
  const interval = opts.intervalMs ?? 3000;
  const timeout = opts.timeoutMs ?? 180_000;
  const start = Date.now();

  let lastStatus: string | null = null;
  while (Date.now() - start < timeout) {
    try {
      const res = await fetchAttestation(params, fetchImpl);
      const complete = res.messages.find((m) => m.status === "complete");
      if (complete) return complete;
      lastStatus = res.messages[0]?.status ?? "no_messages_yet";
    } catch (err) {
      // Iris returns 404 sebelum message ke-witness → suppress sampai timeout.
      if (err instanceof IrisError && err.status === 404) {
        lastStatus = "404_pending_burn";
      } else {
        throw err;
      }
    }
    opts.onTick?.({ elapsedMs: Date.now() - start, lastStatus });
    await sleep(interval);
  }

  throw new IrisError(
    `Attestation polling timeout setelah ${timeout}ms (last status: ${lastStatus ?? "n/a"})`
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
