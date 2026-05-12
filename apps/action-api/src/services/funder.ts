/**
 * Devnet SOL funding pool — auto top-up merchant wallet baru sebelum mereka
 * butuh sign on-chain tx (initialize_merchant + create_session) yang butuh
 * rent + tx fee.
 *
 * Pool keypair di-load dari env. Operator harus pre-fund
 * keypair ini dengan devnet SOL secara manual (`solana airdrop` atau transfer
 * dari wallet lain). Tidak ada auto-replenish.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { env } from "../lib/env";

const TOP_UP_LAMPORTS = Number(process.env.FUNDER_TOPUP_LAMPORTS ?? 50_000_000); // 0.05 SOL
const MIN_THRESHOLD_LAMPORTS = Number(
  process.env.FUNDER_MIN_THRESHOLD_LAMPORTS ?? 10_000_000, // 0.01 SOL
);
const TX_FEE_RESERVE = 5_000; // single sig tx fee buffer

let cachedFunder: Keypair | null = null;
let cachedConnection: Connection | null = null;

function loadFunderKeypair(): Keypair {
  if (cachedFunder) return cachedFunder;
  const keypairEnv = process.env.FUNDER_KEYPAIR ?? process.env.FUNDER_KEYPAIR_PATH;
  if (!keypairEnv) {
    throw new Error(
      "FUNDER_KEYPAIR belum diset. Generate keypair lalu set env ke JSON array secret key, atau set FUNDER_KEYPAIR_PATH untuk local file.",
    );
  }
  const raw = keypairEnv.trim().startsWith("[")
    ? keypairEnv
    : readFileSync(resolve(process.cwd(), keypairEnv), "utf-8");
  const bytes = Uint8Array.from(JSON.parse(raw));
  cachedFunder = Keypair.fromSecretKey(bytes);
  return cachedFunder;
}

function getConnection(): Connection {
  if (cachedConnection) return cachedConnection;
  const url =
    env.SOLANA_RPC_URL ??
    env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.devnet.solana.com";
  cachedConnection = new Connection(url, env.SOLANA_COMMITMENT);
  return cachedConnection;
}

export interface FundResult {
  funded: boolean;
  reason: string;
  txSignature?: string;
  recipientBalanceLamportsAfter: number;
  funderAddress: string;
}

/**
 * Top-up recipient kalau saldo < threshold. Idempotent: kalau saldo cukup, no-op
 * (return `funded: false, reason: "balance sufficient"`).
 */
export async function fundIfNeeded(
  recipientAddress: string,
): Promise<FundResult> {
  const funder = loadFunderKeypair();
  const connection = getConnection();
  const recipient = new PublicKey(recipientAddress);

  const balance = await connection.getBalance(recipient, env.SOLANA_COMMITMENT);
  if (balance >= MIN_THRESHOLD_LAMPORTS) {
    return {
      funded: false,
      reason: `balance sufficient (${(balance / 1e9).toFixed(4)} SOL)`,
      recipientBalanceLamportsAfter: balance,
      funderAddress: funder.publicKey.toBase58(),
    };
  }

  const funderBalance = await connection.getBalance(
    funder.publicKey,
    env.SOLANA_COMMITMENT,
  );
  if (funderBalance < TOP_UP_LAMPORTS + TX_FEE_RESERVE) {
    throw new Error(
      `Funder pool drained: ${(funderBalance / 1e9).toFixed(4)} SOL at ${funder.publicKey.toBase58()}. ` +
        `Top-up pool via: solana airdrop 2 ${funder.publicKey.toBase58()} --url devnet`,
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: funder.publicKey,
      toPubkey: recipient,
      lamports: TOP_UP_LAMPORTS,
    }),
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [funder], {
    commitment: env.SOLANA_COMMITMENT,
  });

  const after = await connection.getBalance(recipient, env.SOLANA_COMMITMENT);
  return {
    funded: true,
    reason: `transferred ${(TOP_UP_LAMPORTS / 1e9).toFixed(4)} SOL from pool`,
    txSignature: signature,
    recipientBalanceLamportsAfter: after,
    funderAddress: funder.publicKey.toBase58(),
  };
}

export function getFunderAddress(): string {
  return loadFunderKeypair().publicKey.toBase58();
}
