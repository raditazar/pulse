/**
 * Builder untuk instruction `create_session` di program `pulse_payment`.
 *
 * Dipanggil oleh merchant authority (cashier side) untuk init `PaymentSession`
 * PDA on-chain. Wajib jalan SEBELUM relayer settle cross-chain — relayer cari
 * PaymentSession via `getProgramAccounts` filter dan butuh account yang sudah
 * di-init untuk validate amount + flip status `Pending → Paid`.
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";

import {
  DEFAULT_PULSE_PROGRAM_ID,
  derivePulseMerchantPda,
  derivePulseSessionPda,
} from "../pulse";

/** Anchor disc = `sha256("global:create_session")[..8]`. */
const CREATE_SESSION_DISCRIMINATOR = Uint8Array.from([
  0xf2, 0xc1, 0x8f, 0xb3, 0x96, 0x19, 0x7a, 0xe3,
]);

export interface CreateSessionArgs {
  /** 32-byte session seed (sama dengan `sessionSeed` di DB action-api). */
  sessionId: Uint8Array;
  amountUsdc: bigint;
  /** Unix seconds. Must be > now. */
  expiresAt: bigint;
}

export interface CreateSessionAccounts {
  /** Merchant authority — sign tx + bayar rent. */
  authority: PublicKey;
  /** Pulse Payment program ID. Default ke `DEFAULT_PULSE_PROGRAM_ID`. */
  programId?: PublicKey;
}

export interface CreateSessionIxResult {
  ix: TransactionInstruction;
  merchantPda: PublicKey;
  sessionPda: PublicKey;
}

export function buildCreateSessionIx(
  args: CreateSessionArgs,
  accounts: CreateSessionAccounts,
): CreateSessionIxResult {
  if (args.sessionId.length !== 32) {
    throw new Error(`sessionId must be 32 bytes, got ${args.sessionId.length}`);
  }
  if (args.amountUsdc <= 0n || args.amountUsdc > 0xffffffffffffffffn) {
    throw new Error("amountUsdc out of u64 range");
  }

  const programId = accounts.programId ?? DEFAULT_PULSE_PROGRAM_ID;
  const [merchantPda] = derivePulseMerchantPda(accounts.authority, programId);
  const [sessionPda] = derivePulseSessionPda(merchantPda, args.sessionId, programId);

  const keys: AccountMeta[] = [
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: merchantPda, isSigner: false, isWritable: false },
    { pubkey: sessionPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // disc (8) + session_id (32) + amount_usdc (u64 LE, 8) + expires_at (i64 LE, 8) = 56
  const data = new Uint8Array(56);
  data.set(CREATE_SESSION_DISCRIMINATOR, 0);
  data.set(args.sessionId, 8);
  const view = new DataView(data.buffer);
  view.setBigUint64(40, args.amountUsdc, true);
  view.setBigInt64(48, args.expiresAt, true);

  const ix = new TransactionInstruction({
    keys,
    programId,
    data: Buffer.from(data),
  });

  return { ix, merchantPda, sessionPda };
}
