/**
 * Simulator settle Solana side (bypass LZ delivery).
 *
 * Untuk validate flow `execute_trusted_split` tanpa dependency LZ V2 receive config
 * yang masih BLOCKED (config error, default receive library belum ter-resolve di LZ Solana
 * V2 testnet). Skenario:
 *   1. Baca event `PaymentIntentSent` dari EVM tx hash yang sudah ada.
 *   2. Decode sessionId/amount/payer/srcEid.
 *   3. Resolve PaymentSession PDA di Solana (sudah Pending).
 *   4. Fetch Merchant data, derive ATA primary + split.
 *   5. Call `execute_trusted_split` dengan relayer keypair.
 *   6. Verify session.status = Paid + balance changes.
 *
 * Usage:
 *   PAY_TX_HASH=0x... pnpm exec tsx scripts/simulate-trusted-split.ts
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createPublicClient,
  http,
  decodeEventLog,
  type Hex,
  formatUnits,
} from "viem";
import { baseSepolia } from "viem/chains";

const SOLANA_RPC = "https://api.devnet.solana.com";
const PULSE_PAYMENT = new PublicKey("2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const PULSE_SENDER_BASE = "0xcead105d5c0612f314d2fb25a630663dfc9c522a" as const;

const MERCHANT_SEED = Buffer.from("merchant");
const SESSION_SEED = Buffer.from("session");
const CONFIG_SEED = Buffer.from("pulse-config");

const PAY_SENT_EVENT_ABI = [
  {
    type: "event",
    name: "PaymentIntentSent",
    inputs: [
      { name: "sessionId", type: "bytes32", indexed: true },
      { name: "dstEid", type: "uint32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "guid", type: "bytes32", indexed: false },
      { name: "nonce", type: "uint64", indexed: false },
    ],
  },
] as const;

const PAYMENT_SESSION_DISC = Uint8Array.from([
  0x36, 0x1a, 0x1b, 0xb3, 0x34, 0x39, 0x38, 0x15,
]);
const EXECUTE_TRUSTED_SPLIT_DISC = Uint8Array.from([
  0x03, 0xf1, 0xd5, 0xd9, 0xcd, 0x02, 0x2a, 0xba,
]);

function loadKeypair(p: string) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
}

function pubkeyToBase58Bs58Filter(buf: Buffer): string {
  if (buf.length === 32) return new PublicKey(buf).toBase58();
  // Generic bs58 encoder for 8-byte discriminator
  const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(0);
  for (const byte of buf) value = value * 256n + BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = ALPHA[Number(value % 58n)]! + out;
    value /= 58n;
  }
  for (const byte of buf) {
    if (byte === 0) out = "1" + out;
    else break;
  }
  return out;
}

async function findSessionBySessionId(
  connection: Connection,
  sessionId: Uint8Array,
) {
  const accounts = await connection.getProgramAccounts(PULSE_PAYMENT, {
    filters: [
      { memcmp: { offset: 0, bytes: pubkeyToBase58Bs58Filter(Buffer.from(PAYMENT_SESSION_DISC)) } },
      { memcmp: { offset: 40, bytes: pubkeyToBase58Bs58Filter(Buffer.from(sessionId)) } },
    ],
  });
  if (accounts.length === 0) return null;
  if (accounts.length > 1) throw new Error("ambiguous session_id");
  const { pubkey, account } = accounts[0]!;
  const data = account.data;
  const merchantPda = new PublicKey(data.subarray(8, 40));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const amountUsdc = view.getBigUint64(72, true);
  const status = data[80]!;
  return { sessionPda: pubkey, merchantPda, amountUsdc, status };
}

async function fetchMerchant(connection: Connection, merchantPda: PublicKey) {
  const acc = await connection.getAccountInfo(merchantPda);
  if (!acc) throw new Error("merchant not found");
  const data = acc.data;
  let offset = 8;
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const primary = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const vecLen = view.getUint32(offset, true);
  offset += 4;
  const splits: { wallet: PublicKey; bps: number; label: string }[] = [];
  for (let i = 0; i < vecLen; i++) {
    const wallet = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const bps = view.getUint16(offset, true);
    offset += 2;
    const labelLen = view.getUint32(offset, true);
    offset += 4;
    const label = data.subarray(offset, offset + labelLen).toString("utf8");
    offset += labelLen;
    splits.push({ wallet, bps, label });
  }
  return { authority, primaryBeneficiary: primary, splitBeneficiaries: splits };
}

async function main() {
  const payTxHash = process.env.PAY_TX_HASH as Hex | undefined;
  if (!payTxHash) throw new Error("PAY_TX_HASH env required");

  const conn = new Connection(SOLANA_RPC, "confirmed");
  const relayer = loadKeypair(
    new URL("../.keys/pulse-relayer.json", import.meta.url).pathname,
  );
  console.log("Relayer:", relayer.publicKey.toBase58());

  // === 1. Fetch EVM tx receipt + decode event ===
  console.log("\n[1] Reading pay tx receipt:", payTxHash);
  const evmClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const receipt = await evmClient.getTransactionReceipt({ hash: payTxHash });
  console.log("    Block:", receipt.blockNumber, "Status:", receipt.status);

  let event: any = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== PULSE_SENDER_BASE.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: PAY_SENT_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PaymentIntentSent") {
        event = decoded.args;
        break;
      }
    } catch {}
  }
  if (!event) throw new Error("PaymentIntentSent event not found in tx logs");

  console.log("    sessionId:", event.sessionId);
  console.log("    payer:    ", event.payer);
  console.log("    amount:   ", formatUnits(event.amount, 6), "USDC");
  console.log("    dstEid:   ", event.dstEid);

  // === 2. Resolve PaymentSession PDA ===
  console.log("\n[2] Resolving PaymentSession PDA");
  const sessionIdBytes = Uint8Array.from(Buffer.from(event.sessionId.slice(2), "hex"));
  const resolved = await findSessionBySessionId(conn, sessionIdBytes);
  if (!resolved) throw new Error("Session not found on Solana");
  console.log("    Session PDA:", resolved.sessionPda.toBase58());
  console.log("    Merchant PDA:", resolved.merchantPda.toBase58());
  console.log(
    "    Status: ",
    ["Pending", "Paid", "Expired", "Refunded"][resolved.status] ?? "?",
  );
  console.log("    Amount: ", formatUnits(resolved.amountUsdc, 6));

  if (resolved.status === 1) {
    console.log("\n⚠️  Session already Paid — nothing to do");
    return;
  }
  if (resolved.amountUsdc !== event.amount) {
    throw new Error(
      `Amount mismatch: session=${resolved.amountUsdc} event=${event.amount}`,
    );
  }

  // === 3. Fetch Merchant + derive accounts ===
  console.log("\n[3] Fetching merchant + deriving accounts");
  const merchant = await fetchMerchant(conn, resolved.merchantPda);
  console.log(
    "    Primary beneficiary:",
    merchant.primaryBeneficiary.toBase58(),
  );
  console.log("    Split beneficiaries:");
  merchant.splitBeneficiaries.forEach((s, i) =>
    console.log(`      [${i}] ${s.wallet.toBase58()} bps=${s.bps} label=${s.label}`),
  );

  const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PULSE_PAYMENT);
  const relayerUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, relayer.publicKey);
  const primaryAta = getAssociatedTokenAddressSync(USDC_MINT, merchant.primaryBeneficiary);
  const splitAtas = merchant.splitBeneficiaries.map((s) =>
    getAssociatedTokenAddressSync(USDC_MINT, s.wallet),
  );

  // Snapshot balances
  const balBefore = {
    relayer: (await getAccount(conn, relayerUsdcAta)).amount,
    primary: (await getAccount(conn, primaryAta)).amount,
    splits: await Promise.all(
      splitAtas.map(async (a) => (await getAccount(conn, a)).amount),
    ),
  };
  console.log("\n[4] Balance snapshot sebelum settle:");
  console.log("    Relayer treasury:", formatUnits(balBefore.relayer, 6));
  console.log("    Primary:         ", formatUnits(balBefore.primary, 6));
  balBefore.splits.forEach((b, i) =>
    console.log(`    Split[${i}]:        ${formatUnits(b, 6)}`),
  );

  // === 5. Build & send execute_trusted_split ix ===
  console.log("\n[5] Calling execute_trusted_split...");

  // data: disc + source_eid(u32 LE) + source_payer(20) + amount(u64 LE)
  const ixData = Buffer.alloc(8 + 4 + 20 + 8);
  Buffer.from(EXECUTE_TRUSTED_SPLIT_DISC).copy(ixData, 0);
  ixData.writeUInt32LE(event.dstEid, 8); // wait — dstEid (Solana eid 40168) is dst, not source
  // Source EID = SRC eid at EVM (40245 for Base Sepolia) — we need to detect from chain.
  // Looking at PulseSender, srcEid = endpoint.eid() at deploy = 40245.
  ixData.writeUInt32LE(40245, 8);
  Buffer.from(event.payer.slice(2), "hex").copy(ixData, 12);
  ixData.writeBigUInt64LE(event.amount, 32);

  const keys = [
    { pubkey: relayer.publicKey, isSigner: true, isWritable: true },
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: resolved.merchantPda, isSigner: false, isWritable: false },
    { pubkey: resolved.sessionPda, isSigner: false, isWritable: true },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: relayerUsdcAta, isSigner: false, isWritable: true },
    { pubkey: primaryAta, isSigner: false, isWritable: true },
    { pubkey: merchant.primaryBeneficiary, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  for (const a of splitAtas)
    keys.push({ pubkey: a, isSigner: false, isWritable: true });

  const ix = new TransactionInstruction({
    programId: PULSE_PAYMENT,
    keys,
    data: ixData,
  });

  try {
    const sig = await sendAndConfirmTransaction(
      conn,
      new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ix,
      ),
      [relayer],
      { commitment: "confirmed" },
    );
    console.log("    ✓ Sig:", sig);
    console.log(
      "    Explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet",
    );
  } catch (err: any) {
    const logs = err?.transactionLogs ?? err?.logs ?? [];
    console.error("    ✗ Failed:", err?.message ?? err);
    if (logs.length) console.error("    " + logs.slice(-15).join("\n    "));
    throw err;
  }

  // === 6. Verify ===
  console.log("\n[6] Verify settle");
  const balAfter = {
    relayer: (await getAccount(conn, relayerUsdcAta)).amount,
    primary: (await getAccount(conn, primaryAta)).amount,
    splits: await Promise.all(
      splitAtas.map(async (a) => (await getAccount(conn, a)).amount),
    ),
  };
  console.log("    Relayer treasury:", formatUnits(balAfter.relayer, 6),
    " (delta", formatUnits(balBefore.relayer - balAfter.relayer, 6) + ")");
  console.log("    Primary:         ", formatUnits(balAfter.primary, 6),
    " (delta +" + formatUnits(balAfter.primary - balBefore.primary, 6) + ")");
  balAfter.splits.forEach((b, i) =>
    console.log(`    Split[${i}]:        ${formatUnits(b, 6)} (delta +${formatUnits(b - balBefore.splits[i]!, 6)})`),
  );

  const sessionAfter = await findSessionBySessionId(conn, sessionIdBytes);
  console.log(
    "\n    Final session status:",
    ["Pending", "Paid", "Expired", "Refunded"][sessionAfter?.status ?? -1] ?? "?",
  );

  if (sessionAfter?.status === 1) {
    console.log("\n✅ E2E SIMULATION (manual relay) PASSED");
  } else {
    console.log("\n⚠️  Session bukan Paid setelah settle");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("\nsimulate-trusted-split failed:", err?.message ?? err);
  process.exit(1);
});
