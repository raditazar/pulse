/**
 * Initialize the Solana PaymentSession PDA after action-api creates the DB
 * session, so the cross-chain relayer can settle against an on-chain account.
 *
 * Signed by the merchant authority wallet in the cashier flow.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  buildCreateSessionIx,
  buildInitializeMerchantIx,
  derivePulseMerchantPda,
  normalizeSessionSeed,
} from "@pulse/solana";

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PULSE_PAYMENT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PULSE_PAYMENT_PROGRAM_ID ??
    "2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF",
);

/** Minimum SOL for rent + transaction fees when creating merchant/session PDAs. */
const MIN_LAMPORTS_FOR_SESSION_INIT = 2_500_000; // 0.0025 SOL safety margin

let cachedConnection: Connection | null = null;
function getConnection(): Connection {
  if (cachedConnection) return cachedConnection;
  cachedConnection = new Connection(SOLANA_RPC, "confirmed");
  return cachedConnection;
}

export async function merchantPdaExists(
  authorityAddress: string,
): Promise<boolean> {
  const authority = new PublicKey(authorityAddress);
  const [merchantPda] = derivePulseMerchantPda(authority, PULSE_PAYMENT_PROGRAM_ID);
  const info = await getConnection().getAccountInfo(merchantPda, "confirmed");
  return info !== null;
}

export interface BuildInitMerchantTxInput {
  authorityAddress: string;
  /** Defaults to authority when omitted. */
  primaryBeneficiary?: string;
  splitBeneficiaries?: Array<{ wallet: string; bps: number; label: string }>;
  metadataUri?: string;
}

export interface BuildInitMerchantTxResult {
  txBytes: Uint8Array;
  merchantPda: string;
}

export async function buildInitializeMerchantTxBytes(
  input: BuildInitMerchantTxInput,
): Promise<BuildInitMerchantTxResult> {
  const authority = new PublicKey(input.authorityAddress);
  const primary = new PublicKey(input.primaryBeneficiary ?? input.authorityAddress);

  const { ix, merchantPda } = buildInitializeMerchantIx(
    {
      primaryBeneficiary: primary,
      splitBeneficiaries: (input.splitBeneficiaries ?? []).map((s) => ({
        wallet: new PublicKey(s.wallet),
        bps: s.bps,
        label: s.label,
      })),
      metadataUri:
        input.metadataUri ?? `pulse://merchant/${input.authorityAddress}`,
    },
    { authority, programId: PULSE_PAYMENT_PROGRAM_ID },
  );

  const connection = getConnection();

  // Preflight: enough SOL for Merchant rent plus fees.
  const balance = await connection.getBalance(authority, "confirmed");
  if (balance < MIN_LAMPORTS_FOR_SESSION_INIT) {
    throw new CreateSessionPreflightError(
      `Authority wallet has insufficient SOL (${(balance / 1e9).toFixed(4)} SOL).`,
      `At least 0.0025 SOL is required for Merchant PDA rent and transaction fees. Trigger /merchants/:id/fund or airdrop manually.`,
    );
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = authority;
  tx.recentBlockhash = blockhash;
  tx.add(ix);

  const sim = await connection.simulateTransaction(tx, undefined, false);
  if (sim.value.err) {
    const logs = (sim.value.logs ?? []).join("\n");
    throw new CreateSessionPreflightError(
      `initialize_merchant simulation failed: ${JSON.stringify(sim.value.err)}`,
      logs ? `Program logs:\n${logs}` : undefined,
    );
  }

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    txBytes: new Uint8Array(serialized),
    merchantPda: merchantPda.toBase58(),
  };
}

export async function waitForAccountExists(
  address: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 30_000, intervalMs = 1_500 } = options;
  const connection = getConnection();
  const pk = new PublicKey(address);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await connection.getAccountInfo(pk, "confirmed");
    if (info) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for account ${address} to be created on-chain`);
}

export interface BuildCreateSessionTxInput {
  authorityAddress: string;
  sessionSeed: string;
  amountUsdcUnits: bigint;
  expiresAt: Date;
}

export interface BuildCreateSessionTxResult {
  txBytes: Uint8Array;
  sessionPda: string;
}

export class CreateSessionPreflightError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "CreateSessionPreflightError";
  }
}

export interface BuildCreateSessionTxResultWithSkip
  extends BuildCreateSessionTxResult {
  alreadyExists: boolean;
}

export async function buildCreateSessionTxBytes(
  input: BuildCreateSessionTxInput,
): Promise<BuildCreateSessionTxResultWithSkip> {
  const authority = new PublicKey(input.authorityAddress);
  const sessionIdBytes = normalizeSessionSeed(input.sessionSeed);
  const { ix, sessionPda, merchantPda } = buildCreateSessionIx(
    {
      sessionId: sessionIdBytes,
      amountUsdc: input.amountUsdcUnits,
      expiresAt: BigInt(Math.floor(input.expiresAt.getTime() / 1000)),
    },
    { authority, programId: PULSE_PAYMENT_PROGRAM_ID },
  );

  const connection = getConnection();

  // Preflight 1: merchant PDA must already exist on-chain.
  const merchantInfo = await connection.getAccountInfo(merchantPda, "confirmed");
  if (!merchantInfo) {
    throw new CreateSessionPreflightError(
      "Merchant PDA does not exist on Solana devnet.",
      `Authority wallet (${input.authorityAddress.slice(0, 8)}...) has not initialized the merchant account yet. Make sure this wallet matches merchant.authority in the database.`,
    );
  }

  // Preflight 1b: if the PaymentSession PDA already exists, skip create_session.
  const sessionInfo = await connection.getAccountInfo(sessionPda, "confirmed");
  if (sessionInfo) {
    return {
      txBytes: new Uint8Array(),
      sessionPda: sessionPda.toBase58(),
      alreadyExists: true,
    };
  }

  // Preflight 2: enough SOL for rent plus fees.
  const balance = await connection.getBalance(authority, "confirmed");
  if (balance < MIN_LAMPORTS_FOR_SESSION_INIT) {
    throw new CreateSessionPreflightError(
      `Authority wallet has insufficient SOL (${(balance / 1e9).toFixed(4)} SOL).`,
      `At least 0.0025 SOL is required for PaymentSession rent and transaction fees. Devnet airdrop: solana airdrop 1 ${input.authorityAddress} --url devnet`,
    );
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = authority;
  tx.recentBlockhash = blockhash;
  tx.add(ix);

  // Preflight 3: simulate before opening the Privy signing popup.
  const sim = await connection.simulateTransaction(tx, undefined, false);
  if (sim.value.err) {
    const logs = (sim.value.logs ?? []).join("\n");
    throw new CreateSessionPreflightError(
      `Simulation failed: ${JSON.stringify(sim.value.err)}`,
      logs ? `Program logs:\n${logs}` : undefined,
    );
  }

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    txBytes: new Uint8Array(serialized),
    sessionPda: sessionPda.toBase58(),
    alreadyExists: false,
  };
}
