/**
 * Helper untuk build instruction `execute_trusted_split` di program `pulse_payment`.
 *
 * Catatan: ini SDK low-level — encode discriminator + args secara manual. Begitu IDL
 * Anchor diregenerasi dari Rust source baru, pertimbangkan migrate ke Anchor TS client
 * untuk type safety penuh.
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  type AccountMeta,
} from "@solana/web3.js";

import { derivePulseConfigPda, derivePulseMerchantPda } from "../pulse";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/**
 * Anchor discriminator untuk instruction `execute_trusted_split` =
 * `sha256("global:execute_trusted_split")[..8]`.
 *
 * Hardcoded di sini supaya SDK tidak butuh dependency `@coral-xyz/anchor`. Pre-computed
 * sekali via:
 *   `crypto.createHash("sha256").update("global:execute_trusted_split").digest().slice(0,8)`
 */
const EXECUTE_TRUSTED_SPLIT_DISCRIMINATOR = Uint8Array.from([
  0x03, 0xf1, 0xd5, 0xd9, 0xcd, 0x02, 0x2a, 0xba,
]);

export interface ExecuteTrustedSplitArgs {
  sourceEid: number;
  sourcePayer: Uint8Array; // 20 bytes EVM address
  amountUsdc: bigint;
}

export interface ExecuteTrustedSplitAccounts {
  relayer: PublicKey;
  merchantAuthority: PublicKey;
  session: PublicKey;
  usdcMint: PublicKey;
  relayerUsdcAta: PublicKey;
  primaryBeneficiary: PublicKey;
  primaryBeneficiaryAta: PublicKey;
  /** ATAs dari semua secondary beneficiary, urut sama dengan `Merchant.split_beneficiaries`. */
  splitBeneficiaryAtas: PublicKey[];
  programId: PublicKey;
}

/**
 * Build `TransactionInstruction` untuk `execute_trusted_split`. Tx ini di-sign oleh
 * relayer (yang juga = `config.trusted_relayer`).
 */
export function buildExecuteTrustedSplitIx(
  args: ExecuteTrustedSplitArgs,
  accounts: ExecuteTrustedSplitAccounts,
): TransactionInstruction {
  if (args.sourcePayer.length !== 20) {
    throw new Error("sourcePayer must be 20 bytes (EVM address)");
  }
  if (args.amountUsdc < 0n || args.amountUsdc > 0xffffffffffffffffn) {
    throw new Error("amountUsdc out of u64 range");
  }
  if (args.sourceEid < 0 || args.sourceEid > 0xffffffff) {
    throw new Error("sourceEid out of u32 range");
  }

  const [config] = derivePulseConfigPda(accounts.programId);
  const [merchant] = derivePulseMerchantPda(accounts.merchantAuthority, accounts.programId);

  const keys: AccountMeta[] = [
    { pubkey: accounts.relayer, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: merchant, isSigner: false, isWritable: false },
    { pubkey: accounts.session, isSigner: false, isWritable: true },
    { pubkey: accounts.usdcMint, isSigner: false, isWritable: false },
    { pubkey: accounts.relayerUsdcAta, isSigner: false, isWritable: true },
    { pubkey: accounts.primaryBeneficiaryAta, isSigner: false, isWritable: true },
    { pubkey: accounts.primaryBeneficiary, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // Remaining accounts: split beneficiary ATAs (writable, not signer).
  for (const ata of accounts.splitBeneficiaryAtas) {
    keys.push({ pubkey: ata, isSigner: false, isWritable: true });
  }

  // Encode data: discriminator (8) + source_eid (u32 LE) + source_payer (20) + amount (u64 LE).
  const data = new Uint8Array(8 + 4 + 20 + 8);
  data.set(EXECUTE_TRUSTED_SPLIT_DISCRIMINATOR, 0);
  const view = new DataView(data.buffer);
  view.setUint32(8, args.sourceEid, true); // Anchor borsh = little-endian
  data.set(args.sourcePayer, 12);
  view.setBigUint64(32, args.amountUsdc, true);

  return new TransactionInstruction({
    keys,
    programId: accounts.programId,
    data: Buffer.from(data),
  });
}
