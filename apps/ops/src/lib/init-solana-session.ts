/**
 * Init `PaymentSession` PDA di Solana — wajib dipanggil setelah action-api
 * bikin DB session, supaya relayer cross-chain bisa settle (relayer cari
 * PaymentSession via getProgramAccounts; account harus sudah di-init).
 *
 * Sign by merchant authority (Privy Solana wallet di sisi cashier).
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

/** Minimum SOL untuk bayar rent + tx fee saat init PaymentSession (~0.0017 SOL). */
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
  const [merchantPda] = derivePulseMerchantPda(authority);
  const info = await getConnection().getAccountInfo(merchantPda, "confirmed");
  return info !== null;
}

export interface BuildInitMerchantTxInput {
  authorityAddress: string;
  /** Default ke authority kalau tidak di-set. */
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
    { authority },
  );

  const connection = getConnection();

  // Preflight: SOL cukup buat bayar Merchant rent (~0.002 SOL) + fee.
  const balance = await connection.getBalance(authority, "confirmed");
  if (balance < MIN_LAMPORTS_FOR_SESSION_INIT) {
    throw new CreateSessionPreflightError(
      `SOL tidak cukup di wallet authority (${(balance / 1e9).toFixed(4)} SOL).`,
      `Butuh minimal 0.0025 SOL untuk rent Merchant PDA + tx fee. Trigger /merchants/:id/fund atau airdrop manual.`,
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
    { authority },
  );

  const connection = getConnection();

  // Preflight 1: merchant PDA harus sudah di-init on-chain.
  const merchantInfo = await connection.getAccountInfo(merchantPda, "confirmed");
  if (!merchantInfo) {
    throw new CreateSessionPreflightError(
      `Merchant PDA tidak ada on-chain di Solana devnet.`,
      `Authority wallet (${input.authorityAddress.slice(0, 8)}…) belum pernah panggil initialize_merchant. Wallet ini cocok dengan merchant.authority di DB? Atau merchant Solana account belum dibuat.`,
    );
  }

  // Preflight 1b: kalau PaymentSession PDA SUDAH ada di-chain, skip create_session
  // — kemungkinan tx dari attempt sebelumnya sudah landed (Privy retry, race,
  // atau prev session). Reuse aja, tidak perlu re-init.
  const sessionInfo = await connection.getAccountInfo(sessionPda, "confirmed");
  if (sessionInfo) {
    return {
      txBytes: new Uint8Array(),
      sessionPda: sessionPda.toBase58(),
      alreadyExists: true,
    };
  }

  // Preflight 2: SOL cukup untuk rent + tx fee.
  const balance = await connection.getBalance(authority, "confirmed");
  if (balance < MIN_LAMPORTS_FOR_SESSION_INIT) {
    throw new CreateSessionPreflightError(
      `SOL tidak cukup di wallet authority (${(balance / 1e9).toFixed(4)} SOL).`,
      `Butuh minimal 0.0025 SOL untuk rent PaymentSession + tx fee. Airdrop devnet: solana airdrop 1 ${input.authorityAddress} --url devnet`,
    );
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = authority;
  tx.recentBlockhash = blockhash;
  tx.add(ix);

  // Preflight 3: simulate dulu — tangkap program error sebelum Privy popup.
  // Pakai `sigVerify: false` karena tx belum di-sign saat simulate.
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
