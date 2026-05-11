/**
 * Builder untuk instruction `initialize_merchant` di program `pulse_payment`.
 *
 * Dipanggil sekali per merchant — saat onboarding — untuk init `Merchant` PDA
 * on-chain. Wajib SEBELUM `create_session` bisa jalan (PaymentSession PDA
 * derive dari merchant key).
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";

import { DEFAULT_PULSE_PROGRAM_ID, derivePulseMerchantPda } from "../pulse";

/** Anchor disc = `sha256("global:initialize_merchant")[..8]`. */
const INITIALIZE_MERCHANT_DISCRIMINATOR = Uint8Array.from([
  0x07, 0x5a, 0x4a, 0x26, 0x63, 0x6f, 0x8e, 0x4d,
]);

export interface SplitConfigArg {
  wallet: PublicKey;
  /** Basis points (0–10000). */
  bps: number;
  label: string;
}

export interface InitializeMerchantArgs {
  primaryBeneficiary: PublicKey;
  splitBeneficiaries: SplitConfigArg[];
  /** Free-form URI, max 200 chars (program-enforced). */
  metadataUri: string;
}

export interface InitializeMerchantAccounts {
  /** Merchant authority — sign tx + bayar rent Merchant account. */
  authority: PublicKey;
  programId?: PublicKey;
}

export interface InitializeMerchantIxResult {
  ix: TransactionInstruction;
  merchantPda: PublicKey;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function encodeString(value: string): Uint8Array {
  const utf8 = new TextEncoder().encode(value);
  const buf = new Uint8Array(4 + utf8.length);
  new DataView(buf.buffer).setUint32(0, utf8.length, true);
  buf.set(utf8, 4);
  return buf;
}

function encodeSplitConfig(cfg: SplitConfigArg): Uint8Array {
  if (cfg.bps < 0 || cfg.bps > 0xffff) {
    throw new Error(`SplitConfig.bps out of u16 range: ${cfg.bps}`);
  }
  const wallet = cfg.wallet.toBytes();
  const bps = new Uint8Array(2);
  new DataView(bps.buffer).setUint16(0, cfg.bps, true);
  const label = encodeString(cfg.label);
  return concatBytes(wallet, bps, label);
}

function encodeSplitVec(items: SplitConfigArg[]): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, items.length, true);
  return concatBytes(len, ...items.map(encodeSplitConfig));
}

export function buildInitializeMerchantIx(
  args: InitializeMerchantArgs,
  accounts: InitializeMerchantAccounts,
): InitializeMerchantIxResult {
  if (args.metadataUri.length > 200) {
    throw new Error(
      `metadataUri too long (${args.metadataUri.length} > 200)`,
    );
  }

  const programId = accounts.programId ?? DEFAULT_PULSE_PROGRAM_ID;
  const [merchantPda] = derivePulseMerchantPda(accounts.authority, programId);

  const data = concatBytes(
    INITIALIZE_MERCHANT_DISCRIMINATOR,
    args.primaryBeneficiary.toBytes(),
    encodeSplitVec(args.splitBeneficiaries),
    encodeString(args.metadataUri),
  );

  const keys: AccountMeta[] = [
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: merchantPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    keys,
    programId,
    data: Buffer.from(data),
  });

  return { ix, merchantPda };
}
