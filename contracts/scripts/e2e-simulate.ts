/**
 * End-to-end simulasi Pulse cross-chain (tanpa UI):
 *   1. (Solana) initialize_merchant — admin = relayer key (2xXqfLb), primary beneficiary + 1 split
 *   2. (Solana) create_session — generate session_id random, amount 1 USDC
 *   3. (EVM Base Sepolia) MockUSDC.faucet → approve → PulseSender.pay
 *   4. Poll PaymentSession sampai status = Paid (oleh relayer di terminal lain)
 *   5. Verify balance USDC primary + split beneficiary
 *
 * Pre-req: relayer harus running (`pnpm --filter @pulse/relayer dev`) di terminal lain.
 *
 * Usage: pnpm exec tsx scripts/e2e-simulate.ts
 */

import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { config as dotenv } from "dotenv";

dotenv({ path: new URL("../../evm/.env", import.meta.url).pathname });

// ====================== CONSTANTS ======================
const SOLANA_RPC = "https://api.devnet.solana.com";
const PULSE_PAYMENT_PROGRAM_ID = new PublicKey(
  "2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF",
);
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

const MERCHANT_SEED = Buffer.from("merchant");
const SESSION_SEED = Buffer.from("session");
const PULSE_CONFIG_SEED = Buffer.from("pulse-config");

const BASE_SEPOLIA_EID = 40245;
const MOCK_USDC_BASE = "0xd680cb01b6288de4a8ad197511816ede6c646ebe" as const;
const PULSE_SENDER_BASE = "0xcead105d5c0612f314d2fb25a630663dfc9c522a" as const;

// ====================== HELPERS ======================
function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))),
  );
}

function ixDisc(name: string): Uint8Array {
  return Uint8Array.from(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

function log(stage: string, msg: string) {
  console.log(`\n[${stage}] ${msg}`);
}

// ====================== SOLANA IX BUILDERS ======================
function buildInitializeMerchantIx(
  authority: PublicKey,
  primaryBeneficiary: PublicKey,
  splitBeneficiaries: { wallet: PublicKey; bps: number; label: string }[],
  metadataUri: string,
): TransactionInstruction {
  const [merchant] = PublicKey.findProgramAddressSync(
    [MERCHANT_SEED, authority.toBytes()],
    PULSE_PAYMENT_PROGRAM_ID,
  );

  // Encode Vec<SplitConfig>: vec_len (u32 LE) + items
  // SplitConfig: wallet(32) + bps(u16 LE) + label(string: u32 LE len + utf8 bytes)
  const items: Buffer[] = [];
  for (const s of splitBeneficiaries) {
    const labelBytes = Buffer.from(s.label, "utf8");
    const item = Buffer.alloc(32 + 2 + 4 + labelBytes.length);
    s.wallet.toBuffer().copy(item, 0);
    item.writeUInt16LE(s.bps, 32);
    item.writeUInt32LE(labelBytes.length, 34);
    labelBytes.copy(item, 38);
    items.push(item);
  }
  const vecLen = Buffer.alloc(4);
  vecLen.writeUInt32LE(splitBeneficiaries.length, 0);
  const splitsBytes = Buffer.concat([vecLen, ...items]);

  // metadata_uri: string (u32 LE len + utf8 bytes)
  const metaBytes = Buffer.from(metadataUri, "utf8");
  const metaLen = Buffer.alloc(4);
  metaLen.writeUInt32LE(metaBytes.length, 0);
  const metaPart = Buffer.concat([metaLen, metaBytes]);

  const data = Buffer.concat([
    Buffer.from(ixDisc("initialize_merchant")),
    primaryBeneficiary.toBuffer(), // 32
    splitsBytes,
    metaPart,
  ]);

  return new TransactionInstruction({
    programId: PULSE_PAYMENT_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildCreateSessionIx(
  authority: PublicKey,
  sessionId: Uint8Array,
  amountUsdc: bigint,
  expiresAt: number,
): { ix: TransactionInstruction; session: PublicKey; merchant: PublicKey } {
  const [merchant] = PublicKey.findProgramAddressSync(
    [MERCHANT_SEED, authority.toBytes()],
    PULSE_PAYMENT_PROGRAM_ID,
  );
  const [session] = PublicKey.findProgramAddressSync(
    [SESSION_SEED, merchant.toBytes(), Buffer.from(sessionId)],
    PULSE_PAYMENT_PROGRAM_ID,
  );

  // data: disc + session_id (32) + amount_usdc (u64 LE) + expires_at (i64 LE)
  const data = Buffer.alloc(8 + 32 + 8 + 8);
  Buffer.from(ixDisc("create_session")).copy(data, 0);
  Buffer.from(sessionId).copy(data, 8);
  data.writeBigUInt64LE(amountUsdc, 40);
  data.writeBigInt64LE(BigInt(expiresAt), 48);

  const ix = new TransactionInstruction({
    programId: PULSE_PAYMENT_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: merchant, isSigner: false, isWritable: false },
      { pubkey: session, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return { ix, session, merchant };
}

// ====================== EVM ABI ======================
const ERC20_FAUCET_ABI = [
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "ownerMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const SENDER_ABI = [
  {
    name: "pay",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "dstEid", type: "uint32" },
      { name: "sessionId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "options", type: "bytes" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "guid", type: "bytes32" },
          { name: "nonce", type: "uint64" },
          {
            name: "fee",
            type: "tuple",
            components: [
              { name: "nativeFee", type: "uint256" },
              { name: "lzTokenFee", type: "uint256" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "quotePay",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dstEid", type: "uint32" },
      { name: "sessionId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "options", type: "bytes" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
    ],
  },
] as const;

// ====================== MAIN ======================
async function main() {
  console.log("=========================================");
  console.log("  Pulse Cross-Chain E2E Simulation");
  console.log("=========================================");

  // --- Load wallets ---
  const adminPath =
    process.env.ADMIN_KEYPAIR_PATH ??
    new URL("../.keys/pulse-deploy.json", import.meta.url).pathname;
  const relayerPath =
    process.env.RELAYER_KEYPAIR_PATH ??
    new URL("../.keys/pulse-relayer.json", import.meta.url).pathname;
  const evmPk = process.env.PRIVATE_KEY as Hex | undefined;
  if (!evmPk) throw new Error("PRIVATE_KEY missing in evm/.env");

  const admin = loadKeypair(adminPath); // 4QmgvsUC — merchant authority (untuk demo)
  const relayer = loadKeypair(relayerPath); // 2xXqfLb — trusted relayer + primary beneficiary
  const evmAccount = privateKeyToAccount(evmPk);

  console.log("\nWallets:");
  console.log("  Admin / Merchant authority:", admin.publicKey.toBase58());
  console.log("  Primary beneficiary:       ", relayer.publicKey.toBase58());
  console.log("  EVM payer:                 ", evmAccount.address);

  const connection = new Connection(SOLANA_RPC, "confirmed");

  // ============================================================
  // STAGE 1: Initialize merchant (skip kalau sudah ada)
  // ============================================================
  log("STAGE 1", "Initialize merchant (atau skip kalau sudah ada)");

  const [merchantPda] = PublicKey.findProgramAddressSync(
    [MERCHANT_SEED, admin.publicKey.toBytes()],
    PULSE_PAYMENT_PROGRAM_ID,
  );
  console.log("  Merchant PDA:", merchantPda.toBase58());

  const merchantInfo = await connection.getAccountInfo(merchantPda);
  let secondaryBeneficiary: PublicKey;
  let primaryBeneficiary: PublicKey;
  if (merchantInfo) {
    console.log("  ✓ Merchant already exists, reusing");
    // PaymentSession layout: disc(8) + authority(32) + primary(32) + vec_len(4) + split[0].wallet(32) ...
    primaryBeneficiary = new PublicKey(merchantInfo.data.subarray(40, 72));
    secondaryBeneficiary = new PublicKey(merchantInfo.data.subarray(76, 108));
    console.log("  Existing primary:  ", primaryBeneficiary.toBase58());
    console.log("  Existing secondary:", secondaryBeneficiary.toBase58());
  } else {
    // First time — generate fresh secondary keypair untuk demo split.
    const fresh = Keypair.generate();
    secondaryBeneficiary = fresh.publicKey;
    primaryBeneficiary = relayer.publicKey;
    console.log("  Secondary beneficiary (fresh):", secondaryBeneficiary.toBase58());
    const initIx = buildInitializeMerchantIx(
      admin.publicKey,
      relayer.publicKey,
      [{ wallet: secondaryBeneficiary, bps: 2_000, label: "platform" }],
      "https://pulse.dev/test-merchant",
    );
    const sig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(initIx),
      [admin],
      { commitment: "confirmed" },
    );
    console.log("  ✓ Merchant initialized, sig:", sig);
  }

  // ============================================================
  // STAGE 2: Create session
  // ============================================================
  log("STAGE 2", "Create payment session");

  const sessionId = randomBytes(32);
  const sessionIdHex = "0x" + sessionId.toString("hex");
  const amountUsdc = parseUnits("1", 6); // 1 USDC = 1_000_000 base units
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 30; // 30 menit

  const { ix: createSessionIx, session: sessionPda } = buildCreateSessionIx(
    admin.publicKey,
    new Uint8Array(sessionId),
    amountUsdc,
    expiresAt,
  );

  const sessionSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createSessionIx),
    [admin],
    { commitment: "confirmed" },
  );
  console.log("  Session ID hex:", sessionIdHex);
  console.log("  Session PDA:   ", sessionPda.toBase58());
  console.log("  Amount:        ", formatUnits(amountUsdc, 6), "USDC");
  console.log("  Expires at:    ", new Date(expiresAt * 1000).toISOString());
  console.log("  Sig:           ", sessionSig);

  // ============================================================
  // STAGE 3: Ensure beneficiary ATAs exist (relayer perlu transfer ke sini)
  // ============================================================
  log("STAGE 3", "Pastikan beneficiary USDC ATAs exist");

  const primaryAta = getAssociatedTokenAddressSync(USDC_MINT, relayer.publicKey);
  const secondaryAta = getAssociatedTokenAddressSync(USDC_MINT, secondaryBeneficiary);

  const ataIxs: TransactionInstruction[] = [];
  for (const [owner, ata] of [
    [relayer.publicKey, primaryAta],
    [secondaryBeneficiary, secondaryAta],
  ] as const) {
    const info = await connection.getAccountInfo(ata);
    if (!info) {
      ataIxs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          admin.publicKey,
          ata,
          owner,
          USDC_MINT,
        ),
      );
      console.log(`  + Creating ATA ${ata.toBase58()} for ${owner.toBase58()}`);
    } else {
      console.log(`  ✓ ATA exists ${ata.toBase58()}`);
    }
  }
  if (ataIxs.length) {
    const sig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(...ataIxs),
      [admin],
      { commitment: "confirmed" },
    );
    console.log("  ATA(s) created, sig:", sig);
  }

  // Snapshot balances before
  const primaryBefore = await getAccount(connection, primaryAta);
  const secondaryBefore = await getAccount(connection, secondaryAta);
  console.log("\nBalance USDC sebelum settle:");
  console.log("  Primary:  ", formatUnits(primaryBefore.amount, 6));
  console.log("  Secondary:", formatUnits(secondaryBefore.amount, 6));

  const relayerAta = getAssociatedTokenAddressSync(USDC_MINT, relayer.publicKey);
  const relayerBefore = await getAccount(connection, relayerAta);
  console.log("  Relayer treasury (sumber dana):", formatUnits(relayerBefore.amount, 6));

  // ============================================================
  // STAGE 4: EVM — faucet → approve → pay
  // ============================================================
  log("STAGE 4", "EVM Base Sepolia: faucet → approve → pay");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org"),
  });
  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org"),
  });

  // 4a. Faucet (skip kalau sudah cukup)
  const evmUsdcBalance = (await publicClient.readContract({
    address: MOCK_USDC_BASE,
    abi: ERC20_FAUCET_ABI,
    functionName: "balanceOf",
    args: [evmAccount.address],
  })) as bigint;
  console.log("  pmUSDC balance:", formatUnits(evmUsdcBalance, 6));

  if (evmUsdcBalance < amountUsdc) {
    console.log("  Calling faucet for", formatUnits(amountUsdc, 6), "pmUSDC...");
    let topUpHash: Hex | null = null;
    try {
      topUpHash = await walletClient.writeContract({
        address: MOCK_USDC_BASE,
        abi: ERC20_FAUCET_ABI,
        functionName: "faucet",
        args: [amountUsdc],
      });
      console.log("  ✓ Faucet tx:", topUpHash);
    } catch (e: any) {
      console.log("  ⚠ Faucet failed (cooldown), trying ownerMint fallback...");
      try {
        topUpHash = await walletClient.writeContract({
          address: MOCK_USDC_BASE,
          abi: ERC20_FAUCET_ABI,
          functionName: "ownerMint",
          args: [evmAccount.address, amountUsdc],
        });
        console.log("  ✓ ownerMint tx:", topUpHash);
      } catch (e2: any) {
        console.error("  ✗ ownerMint also failed:", e2?.shortMessage ?? e2?.message);
        throw e2;
      }
    }
    await publicClient.waitForTransactionReceipt({ hash: topUpHash! });
    const balAfter = (await publicClient.readContract({
      address: MOCK_USDC_BASE,
      abi: ERC20_FAUCET_ABI,
      functionName: "balanceOf",
      args: [evmAccount.address],
    })) as bigint;
    console.log("  Balance after top-up:", formatUnits(balAfter, 6), "pmUSDC");
  }

  // 4b. Approve — selalu re-approve karena allowance bisa stale di RPC node berbeda.
  const approveHash = await walletClient.writeContract({
    address: MOCK_USDC_BASE,
    abi: ERC20_FAUCET_ABI,
    functionName: "approve",
    args: [PULSE_SENDER_BASE, amountUsdc],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("  ✓ Approve tx:", approveHash);

  // Poll sampai RPC mengembalikan allowance baru (mitigasi propagation lag Base Sepolia public RPC).
  for (let i = 0; i < 10; i++) {
    const a = (await publicClient.readContract({
      address: MOCK_USDC_BASE,
      abi: ERC20_FAUCET_ABI,
      functionName: "allowance",
      args: [evmAccount.address, PULSE_SENDER_BASE],
    })) as bigint;
    if (a >= amountUsdc) {
      console.log("  Allowance confirmed:", formatUnits(a, 6));
      break;
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }

  // 4c. Quote fee
  const fee = (await publicClient.readContract({
    address: PULSE_SENDER_BASE,
    abi: SENDER_ABI,
    functionName: "quotePay",
    args: [BASE_SEPOLIA_EID === 40245 ? 40168 : 40168, sessionIdHex as Hex, amountUsdc, "0x"],
  })) as { nativeFee: bigint; lzTokenFee: bigint };
  console.log("  LZ native fee quote:", formatUnits(fee.nativeFee, 18), "ETH");

  // 4d. Pay (overpay 20% supaya tidak underpay karena gas estimasi)
  const valueToSend = (fee.nativeFee * 12n) / 10n;
  console.log("  Calling pay() with value:", formatUnits(valueToSend, 18), "ETH...");
  const payHash = await walletClient.writeContract({
    address: PULSE_SENDER_BASE,
    abi: SENDER_ABI,
    functionName: "pay",
    args: [40168, sessionIdHex as Hex, amountUsdc, "0x"],
    value: valueToSend,
  });
  const payReceipt = await publicClient.waitForTransactionReceipt({ hash: payHash });
  console.log("  ✓ Pay tx:", payHash);
  console.log("  Block:    ", payReceipt.blockNumber);
  console.log(
    "  LayerZero Scan: https://testnet.layerzeroscan.com/tx/" + payHash,
  );

  // ============================================================
  // STAGE 5: Poll Solana untuk session.status = Paid
  // ============================================================
  log("STAGE 5", "Polling PaymentSession sampai status = Paid (max 5 menit)");
  console.log("  Pastikan relayer sedang running: `pnpm --filter @pulse/relayer dev`");

  const maxWaitMs = 5 * 60 * 1_000;
  const startMs = Date.now();
  let settled = false;
  let attempts = 0;
  while (Date.now() - startMs < maxWaitMs) {
    attempts++;
    const acc = await connection.getAccountInfo(sessionPda);
    if (acc) {
      // PaymentSession layout: disc(8) + merchant(32) + session_id(32) + amount_usdc(u64) + status(u8)
      const status = acc.data[80];
      const statusName = ["Pending", "Paid", "Expired", "Refunded"][status ?? -1] ?? "?";
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      process.stdout.write(
        `\r  [${String(attempts).padStart(3)}] ${elapsed}s — status: ${statusName}            `,
      );
      if (status === 1) {
        settled = true;
        console.log("\n  ✓ Session PAID");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 4_000));
  }

  if (!settled) {
    console.log("\n  ✗ Timeout — session belum settle dalam 5 menit");
    console.log("    Periksa: (a) relayer running? (b) LZ Executor delay? (c) error di log relayer?");
    process.exit(2);
  }

  // ============================================================
  // STAGE 6: Verify balances
  // ============================================================
  log("STAGE 6", "Verify balances setelah settle");

  const primaryAfter = await getAccount(connection, primaryAta);
  const secondaryAfter = await getAccount(connection, secondaryAta);
  const relayerAfter = await getAccount(connection, relayerAta);

  const primaryDelta = primaryAfter.amount - primaryBefore.amount;
  const secondaryDelta = secondaryAfter.amount - secondaryBefore.amount;
  const relayerDelta = relayerBefore.amount - relayerAfter.amount;

  console.log("\nDelta balances:");
  console.log("  Primary ATA delta:  ", formatUnits(primaryDelta, 6), "USDC");
  console.log("  Secondary ATA delta:", formatUnits(secondaryDelta, 6), "USDC");
  console.log("  Relayer ATA delta:  ", formatUnits(-relayerDelta, 6), "USDC");

  const expectedSecondary = (amountUsdc * 2000n) / 10000n; // 0.2 USDC
  const expectedPrimaryShare = amountUsdc - expectedSecondary; // 0.8 USDC
  const primaryIsRelayer = primaryBeneficiary.equals(relayer.publicKey);

  let pass = true;
  if (secondaryDelta !== expectedSecondary) {
    console.log(
      "  ✗ Secondary should receive",
      formatUnits(expectedSecondary, 6),
      "USDC; got",
      formatUnits(secondaryDelta, 6),
    );
    pass = false;
  } else {
    console.log("  ✓ Secondary received", formatUnits(secondaryDelta, 6), "USDC (20%)");
  }

  if (primaryIsRelayer) {
    // Same ATA: 0.8 keluar lalu masuk lagi (no-op) — net hanya -0.2 untuk secondary.
    const expectedNetRelayer = -expectedSecondary;
    if (primaryDelta !== expectedNetRelayer) {
      console.log(
        "  ✗ Relayer/Primary ATA net delta should be",
        formatUnits(expectedNetRelayer, 6),
        "(primary==relayer, only secondary leaks out); got",
        formatUnits(primaryDelta, 6),
      );
      pass = false;
    } else {
      console.log(
        "  ✓ Primary==relayer same ATA, net delta",
        formatUnits(primaryDelta, 6),
        "USDC (secondary share leaks out, primary share = self-transfer no-op)",
      );
    }
  } else {
    if (primaryDelta !== expectedPrimaryShare) {
      console.log(
        "  ✗ Primary should receive",
        formatUnits(expectedPrimaryShare, 6),
        "USDC; got",
        formatUnits(primaryDelta, 6),
      );
      pass = false;
    } else {
      console.log("  ✓ Primary received", formatUnits(primaryDelta, 6), "USDC (80%)");
    }
    const expectedRelayerNet = -amountUsdc;
    if (relayerDelta !== amountUsdc) {
      console.log(
        "  ✗ Relayer treasury should -",
        formatUnits(amountUsdc, 6),
        "USDC; got",
        formatUnits(relayerDelta, 6),
      );
      pass = false;
    }
  }

  if (pass) {
    console.log("\n✅ E2E SIMULATION PASSED — cross-chain settle berhasil");
    console.log(
      "   EVM pay → relayer listener (auto) → execute_trusted_split → session Paid",
    );
  } else {
    console.log("\n⚠️  Settle terjadi tapi balance tidak sesuai expectation");
    process.exit(3);
  }
}

main().catch((err) => {
  console.error("\nE2E failed:", err);
  process.exit(1);
});
