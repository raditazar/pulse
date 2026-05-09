/**
 * Helpers untuk submit `MessageTransmitterV2.receive_message` di Solana Devnet setelah
 * attestation Circle siap. Tidak meng-include logic untuk Pulse `cctp_hook_handler`
 * (instruction kita sendiri) — itu di-handle oleh script terpisah karena butuh Anchor
 * IDL yang baru ter-generate.
 *
 * Yang di-cover di sini:
 * - Derive PDA seeds untuk Message Transmitter state, Used Nonces, Token Messenger Minter
 *   accounts yang dibutuhkan oleh receive_message
 * - Builder untuk `Instruction` siap dikirim
 *
 * Catatan: file ini PURE pubkey/seed math — tidak butuh @coral-xyz/anchor IDL.
 *   Caller bertanggung jawab mengisi accounts spesifik (Receiver program, Custody ATA,
 *   Recipient ATA, dll.). Lihat contracts/tests/cctp-e2e.ts untuk usage end-to-end.
 */

import { PublicKey, type TransactionInstruction } from "@solana/web3.js";

import { SOLANA_CCTP_V2_DEVNET } from "./addresses";

const MT_AUTHORITY_SEED = Buffer.from("message_transmitter_authority");
const MT_STATE_SEED = Buffer.from("message_transmitter");
const USED_NONCES_SEED = Buffer.from("used_nonces");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

export interface CctpReceiveMessagePdas {
  messageTransmitter: PublicKey;
  authorityPda: PublicKey;
  authorityBump: number;
  usedNonces: PublicKey;
  eventAuthority: PublicKey;
}

/**
 * Derive PDA accounts yang dibutuhkan untuk MessageTransmitterV2.receive_message di Solana Devnet.
 *
 * @param receiverProgram   Program yang jadi `recipient` di message body.
 *                          Untuk USDC mint → `tokenMessengerMinterV2`.
 *                          Untuk custom payload → bisa program kita sendiri (kalau kita pilih
 *                          jadi recipient — bukan strategi default Pulse).
 * @param sourceDomain      CCTP source domain id (mis. 6 untuk Base Sepolia).
 * @param nonce             Nonce dari attestation message.
 */
export function deriveReceiveMessagePdas(
  receiverProgram: PublicKey,
  sourceDomain: number,
  nonce: bigint
): CctpReceiveMessagePdas {
  const mtProgramId = SOLANA_CCTP_V2_DEVNET.messageTransmitterV2;

  const [messageTransmitter] = PublicKey.findProgramAddressSync(
    [MT_STATE_SEED],
    mtProgramId
  );

  const [authorityPda, authorityBump] = PublicKey.findProgramAddressSync(
    [MT_AUTHORITY_SEED, receiverProgram.toBuffer()],
    mtProgramId
  );

  // CCTP V2 used_nonces: PDA per (source_domain, nonce_bucket).
  // Bucket = floor(nonce / 6400) — replikasi konstanta `MAX_NONCES_PER_ACCOUNT` di Circle.
  const NONCES_PER_ACCOUNT = 6400n;
  const bucket = nonce / NONCES_PER_ACCOUNT;
  const sourceDomainBytes = Buffer.alloc(4);
  sourceDomainBytes.writeUInt32BE(sourceDomain, 0);
  const bucketBytes = Buffer.alloc(8);
  bucketBytes.writeBigUInt64BE(bucket, 0);

  const [usedNonces] = PublicKey.findProgramAddressSync(
    [USED_NONCES_SEED, sourceDomainBytes, bucketBytes],
    mtProgramId
  );

  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [EVENT_AUTHORITY_SEED],
    mtProgramId
  );

  return {
    messageTransmitter,
    authorityPda,
    authorityBump,
    usedNonces,
    eventAuthority,
  };
}

/**
 * Helper alias — derive vault PDA untuk Pulse session (mirror konstanta Rust
 * `VAULT_SEED_PREFIX`).
 */
export function derivePulseVaultAuthority(
  pulseProgramId: PublicKey,
  session: PublicKey
): { vaultAuthority: PublicKey; bump: number } {
  const [vaultAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), session.toBuffer()],
    pulseProgramId
  );
  return { vaultAuthority, bump };
}

/**
 * Stub untuk builder lengkap `MessageTransmitterV2.receive_message` instruction.
 *
 * Implementasi nyata membutuhkan deserialize attestation message di Solana side untuk
 * extract source_domain + nonce, plus assemble account list lengkap (custody ATA,
 * recipient ATA, local_token, token_pair, fee_recipient, dll.).
 *
 * Daripada copy-paste 100+ baris account assembly yang versionnya cepat berubah, lebih
 * benar generate via Anchor IDL setelah `anchor build` di reference repo:
 *
 *   git clone https://github.com/circlefin/solana-cctp-contracts /tmp/cctp-ref
 *   cd /tmp/cctp-ref/programs/v2 && anchor build
 *   # → IDL di target/idl/message_transmitter_v2.json
 *
 * Lalu pakai @coral-xyz/anchor `Program.methods.receiveMessage(...)` di test script.
 *
 * Saat E2E test runner di-implement (Phase 1.4), file ini akan di-extend untuk wrap
 * Anchor program client.
 */
export function buildReceiveMessageInstruction(): TransactionInstruction {
  throw new Error(
    "buildReceiveMessageInstruction: not implemented. Pakai Anchor IDL dari /tmp/cctp-ref untuk testnet — lihat contracts/tests/cctp-e2e.ts"
  );
}
