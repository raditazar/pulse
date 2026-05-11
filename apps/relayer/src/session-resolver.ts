/**
 * Resolve `PaymentSession` PDA + `Merchant` PDA dari `session_id` raw (32 bytes).
 *
 * Strategi (devnet, minim-state):
 *   1. Cari semua `PaymentSession` account via getProgramAccounts dengan filter
 *      `dataSize` + `memcmp` pada offset session_id field.
 *   2. Setelah dapat session, baca `merchant` pubkey dari account data, lalu fetch
 *      `Merchant` (juga via getAccountInfo).
 *
 * Untuk efisiensi production: index session_id → PDA via DB di action-api. Implementasi
 * di sini cukup untuk hackathon throughput.
 */

import { Connection, PublicKey } from "@solana/web3.js";

const PAYMENT_SESSION_DISCRIMINATOR = Uint8Array.from([
  // sha256("account:PaymentSession")[..8]
  0x36, 0x1a, 0x1b, 0xb3, 0x34, 0x39, 0x38, 0x15,
]);

export interface ResolvedSession {
  sessionPda: PublicKey;
  merchantPda: PublicKey;
  amountUsdc: bigint;
  status: number; // 0=Pending,1=Paid,2=Expired,3=Refunded
  expiresAt: bigint;
}

/**
 * Pakai memcmp filter pada offset 8 (setelah discriminator) — `merchant: Pubkey` (32 bytes)
 * lalu offset 40 — `session_id: [u8;32]` — tapi merchant tidak kita tahu duluan, jadi pakai
 * session_id sebagai filter primary.
 *
 * PaymentSession layout (Anchor):
 *   discriminator (8) | merchant (32) | session_id (32) | amount_usdc (8) | status (1) | ...
 */
export async function findSessionBySessionId(
  connection: Connection,
  programId: PublicKey,
  sessionId: Uint8Array,
): Promise<ResolvedSession | null> {
  if (sessionId.length !== 32) {
    throw new Error("sessionId must be 32 bytes");
  }

  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      // memcmp pada offset 0 — discriminator
      {
        memcmp: { offset: 0, bytes: bufferToBase58(Buffer.from(PAYMENT_SESSION_DISCRIMINATOR)) },
      },
      // memcmp pada offset 40 — session_id (8 disc + 32 merchant)
      {
        memcmp: { offset: 40, bytes: bufferToBase58(Buffer.from(sessionId)) },
      },
    ],
  });

  if (accounts.length === 0) return null;
  if (accounts.length > 1) {
    throw new Error(`ambiguous session_id: ${accounts.length} matches`);
  }

  const { pubkey, account } = accounts[0]!;
  const data = account.data;
  const merchantPda = new PublicKey(data.subarray(8, 40));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const amountUsdc = view.getBigUint64(72, true); // 8 disc + 32 merch + 32 sid = 72
  const status = data[80]!;
  // status (1) + created_at i64 (8) + expires_at i64 (8)
  const expiresAt = view.getBigInt64(89, true);

  return { sessionPda: pubkey, merchantPda, amountUsdc, status, expiresAt };
}

function bufferToBase58(buf: Buffer): string {
  // pakai PublicKey untuk base58 encoding (Solana convention untuk memcmp filter)
  // Untuk buffer 32-byte ini valid; kalau bukan 32-byte, fallback ke bs58 manual.
  if (buf.length === 32) {
    return new PublicKey(buf).toBase58();
  }
  // Mini bs58 (digunakan untuk discriminator 8 bytes)
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(0);
  for (const byte of buf) value = value * 256n + BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)]! + out;
    value /= 58n;
  }
  for (const byte of buf) {
    if (byte === 0) out = "1" + out;
    else break;
  }
  return out;
}

/**
 * Decode Merchant account. Layout:
 *   discriminator (8) | authority (32) | primary_beneficiary (32) | vec_len (4)
 *   | split_beneficiaries [SplitConfig; vec_len]
 *     SplitConfig = wallet(32) + bps(2) + label(string: 4 + len)
 *   | total_split_bps (2) | metadata_uri (string) | is_active (1) | bump (1)
 */
export interface MerchantData {
  authority: PublicKey;
  primaryBeneficiary: PublicKey;
  splitBeneficiaries: { wallet: PublicKey; bps: number; label: string }[];
  totalSplitBps: number;
  isActive: boolean;
}

export async function fetchMerchant(
  connection: Connection,
  merchantPda: PublicKey,
): Promise<MerchantData> {
  const acc = await connection.getAccountInfo(merchantPda);
  if (!acc) throw new Error(`merchant account not found: ${merchantPda.toBase58()}`);
  const data = acc.data;
  let offset = 8; // skip disc
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const primaryBeneficiary = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const vecLen = view.getUint32(offset, true);
  offset += 4;

  const splitBeneficiaries: MerchantData["splitBeneficiaries"] = [];
  for (let i = 0; i < vecLen; i++) {
    const wallet = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const bps = view.getUint16(offset, true);
    offset += 2;
    const labelLen = view.getUint32(offset, true);
    offset += 4;
    const label = data.subarray(offset, offset + labelLen).toString("utf8");
    offset += labelLen;
    splitBeneficiaries.push({ wallet, bps, label });
  }

  const totalSplitBps = view.getUint16(offset, true);
  offset += 2;
  // Skip metadata_uri (string) — not needed for IX building.
  const metadataLen = view.getUint32(offset, true);
  offset += 4 + metadataLen;
  const isActive = data[offset] === 1;

  return { authority, primaryBeneficiary, splitBeneficiaries, totalSplitBps, isActive };
}
