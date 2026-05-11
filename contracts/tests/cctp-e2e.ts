/**
 * CCTP V2 end-to-end test: Base Sepolia → Solana Devnet → vault PDA.
 *
 * # Status
 * Phase 1.4 — fully runnable (devnet only).
 *
 * # What it proves
 * 1. EVM-side `depositForBurnWithHook` di Base Sepolia bekerja dengan Pulse hook data 88B.
 * 2. Iris attestation sandbox return signed message dalam ~30 detik.
 * 3. `MessageTransmitterV2.receiveMessage` di Solana Devnet ber-CPI ke
 *    `TokenMessengerMinterV2.handleReceiveFinalizedMessage` dan mint USDC ke vault PDA ATA.
 *
 * # What it does NOT prove (yet)
 * - `pulse_payment.cctp_hook_handler` end-to-end — itu butuh on-chain Merchant + PaymentSession,
 *   yang init-instructionnya masih scope core-program owner. Test ini generate session_id
 *   random (no on-chain session) dan mint USDC ke vault ATA-nya. Hook handler unit-tested di
 *   sisi Rust, jadi gap E2E hanya integration glue.
 *
 * # Prerequisites
 * - Solana Devnet wallet di `contracts/.keys/pulse-deploy.json` dengan ≥0.05 SOL untuk rent.
 * - Base Sepolia wallet (EVM_PRIVATE_KEY) dengan ETH (gas) + USDC sufficient untuk burn.
 * - Env vars di `contracts/.env`:
 *     SOLANA_RPC_URL=https://api.devnet.solana.com
 *     PULSE_PROGRAM_ID=2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF
 *     EVM_RPC_URL=https://sepolia.base.org
 *     EVM_PRIVATE_KEY=0x...
 *     AMOUNT_USDC_BASE_UNITS=1000000   # 1 USDC
 *
 * # Run
 *   pnpm tsx contracts/tests/cctp-e2e.ts
 *
 * # Flow
 *   1. Setup mock Merchant + PaymentSession di Solana Devnet
 *   2. Encode hook_data (88 bytes) untuk session_id + Base Sepolia domain
 *   3. Call `TokenMessengerV2.depositForBurnWithHook` di Base Sepolia (EVM)
 *   4. Poll Iris API sandbox untuk attestation (~13-30 detik)
 *   5. Submit `MessageTransmitterV2.receive_message` di Solana Devnet
 *      → CPI ke TokenMessengerMinterV2 → mint USDC ke vault PDA
 *   6. Submit `pulse_payment.cctp_hook_handler(hook_data, vault_bump)` di Solana
 *      → split USDC ke merchant + platform ATA
 *   7. Verify saldo ATA matches expected merchant_share + platform_share
 *
 * # Catatan implementasi
 * - EVM side pakai `viem` (pinning ke `^2.x` saat dependency ditambah).
 * - Solana side pakai `@coral-xyz/anchor` v0.32 dengan IDL CCTP-V2 + Pulse.
 * - Helper internal kita re-export dari `@pulse/solana/cctp`.
 */

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Agent, fetch as undiciFetch } from "undici";

// Indonesian ISP "Internet Positif" hijacks DNS port 53 untuk certain hosts (termasuk
// circle.com → returned `internetpositif.id`). Bypass: DNS-over-HTTPS via Cloudflare
// untuk Iris hosts saja, scoped via custom undici Agent — biar host lain (Solana RPC,
// Base Sepolia RPC) tetap pakai default resolver tanpa side-effects.

const dohCache = new Map<string, string>();

async function dohLookup(hostname: string): Promise<string> {
  const cached = dohCache.get(hostname);
  if (cached) return cached;
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) throw new Error(`DoH lookup failed for ${hostname}: HTTP ${res.status}`);
  const json = (await res.json()) as { Answer?: Array<{ data: string; type: number }> };
  const a = json.Answer?.find((r) => r.type === 1);
  if (!a) throw new Error(`No A record for ${hostname} via DoH`);
  dohCache.set(hostname, a.data);
  return a.data;
}

// Custom fetch yang khusus dipakai untuk Iris API (bypass DNS hijack).
// Undici 8 calls lookup dengan `{ all: true }` — callback HARUS return array.
const irisAgent = new Agent({
  connect: {
    lookup: ((hostname: string, options: { all?: boolean }, callback: any) => {
      dohLookup(hostname)
        .then((addr) => {
          if (options?.all) {
            callback(null, [{ address: addr, family: 4 }]);
          } else {
            callback(null, addr, 4);
          }
        })
        .catch((err) => callback(err));
    }) as never,
  },
});

const irisFetch: typeof fetch = ((input: any, init?: any) =>
  undiciFetch(input, { ...init, dispatcher: irisAgent }) as unknown as Promise<Response>) as typeof fetch;

import { AnchorProvider, Program, BN, Wallet, type Idl } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  toHex,
  zeroHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import {
  CCTP_DOMAIN,
  EVM_TESTNET_CCTP_V2,
  encodeHookData,
  pollAttestation,
  SOLANA_CCTP_V2_DEVNET,
  derivePulseVaultAuthority,
} from "../../packages/solana/src/cctp";

// ============================================================
// Config
// ============================================================

interface E2EConfig {
  evmRpcUrl: string;
  evmPrivateKey: `0x${string}`;
  solanaRpcUrl: string;
  pulseProgramId: PublicKey;
  amount: bigint;
  solanaKeypairPath: string;
}

function loadEnv() {
  // Load .env if present. Try contracts/.env relative to repo root OR cwd.
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "contracts/.env"),
    resolve(__dirname, "../.env"),
  ];
  let content: string | null = null;
  for (const path of candidates) {
    try {
      content = readFileSync(path, "utf-8");
      break;
    } catch {
      continue;
    }
  }
  try {
    if (content === null) throw new Error("no .env");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env optional — fall back to process env.
  }
}

function loadConfig(): E2EConfig {
  loadEnv();
  const required = ["EVM_PRIVATE_KEY", "EVM_RPC_URL", "SOLANA_RPC_URL", "PULSE_PROGRAM_ID"];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var ${key}`);
  }
  return {
    evmRpcUrl: process.env.EVM_RPC_URL!,
    evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
    solanaRpcUrl: process.env.SOLANA_RPC_URL!,
    pulseProgramId: new PublicKey(process.env.PULSE_PROGRAM_ID!),
    amount: BigInt(process.env.AMOUNT_USDC_BASE_UNITS ?? "1000000"),
    solanaKeypairPath:
      process.env.SOLANA_KEYPAIR_PATH ?? resolve(__dirname, "../.keys/pulse-deploy.json"),
  };
}

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ============================================================
// Helpers
// ============================================================

const MT_AUTHORITY_SEED = Buffer.from("message_transmitter_authority");
const MT_STATE_SEED = Buffer.from("message_transmitter");
const USED_NONCE_SEED = Buffer.from("used_nonce");
const TOKEN_MESSENGER_SEED = Buffer.from("token_messenger");
const TOKEN_MINTER_SEED = Buffer.from("token_minter");
const LOCAL_TOKEN_SEED = Buffer.from("local_token");
const REMOTE_TOKEN_MESSENGER_SEED = Buffer.from("remote_token_messenger");
const TOKEN_PAIR_SEED = Buffer.from("token_pair");
const CUSTODY_SEED = Buffer.from("custody");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

function findPda(
  programId: PublicKey,
  seeds: (Buffer | Uint8Array | string)[]
): { publicKey: PublicKey; bump: number } {
  const seedBuffers = seeds.map((s) =>
    typeof s === "string" ? Buffer.from(s) : Buffer.from(s)
  );
  const [publicKey, bump] = PublicKey.findProgramAddressSync(seedBuffers, programId);
  return { publicKey, bump };
}

function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

/**
 * Decode 32-byte event nonce dari raw CCTP message.
 * Layout V2: nonce di offset 12, length 32 bytes.
 */
function decodeEventNonceFromMessageV2(messageHex: string): Buffer {
  const message = hexToBytes(messageHex);
  return message.subarray(12, 12 + 32);
}

/**
 * Convert solana PublicKey ke bytes32 hex untuk EVM mintRecipient field.
 */
function pubkeyToBytes32Hex(pk: PublicKey): `0x${string}` {
  return toHex(pk.toBytes()) as `0x${string}`;
}

// ============================================================
// Steps
// ============================================================

async function step1_setupVaultPda(
  cfg: E2EConfig,
  connection: Connection,
  payer: Keypair
): Promise<{
  sessionId: PublicKey;
  vaultAuthority: PublicKey;
  vaultBump: number;
  vaultAta: PublicKey;
}> {
  console.log("\n[1/6] derive vault PDA + create vault USDC ATA");
  const sessionKp = Keypair.generate();
  const sessionId = sessionKp.publicKey;
  const { vaultAuthority, bump: vaultBump } = derivePulseVaultAuthority(
    cfg.pulseProgramId,
    sessionId
  );
  const vaultAta = await getAssociatedTokenAddress(
    SOLANA_CCTP_V2_DEVNET.usdcMint,
    vaultAuthority,
    true // allow PDA owner
  );

  console.log(`      sessionId      = ${sessionId.toBase58()}`);
  console.log(`      vaultAuthority = ${vaultAuthority.toBase58()} (bump=${vaultBump})`);
  console.log(`      vaultAta       = ${vaultAta.toBase58()}`);

  // Create the ATA if it doesn't exist (rent ~0.002 SOL).
  const info = await connection.getAccountInfo(vaultAta);
  if (info === null) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        vaultAta,
        vaultAuthority,
        SOLANA_CCTP_V2_DEVNET.usdcMint
      )
    );
    const sig = await connection.sendTransaction(tx, [payer]);
    await connection.confirmTransaction(sig, "confirmed");
    console.log(`      ATA created    = ${sig}`);
  } else {
    console.log("      ATA exists already");
  }

  return { sessionId, vaultAuthority, vaultBump, vaultAta };
}

function step2_buildHookData(
  cfg: E2EConfig,
  sessionId: PublicKey,
  evmSender: `0x${string}`
): Uint8Array {
  console.log("\n[2/6] encode 88-byte Pulse hook data");
  const hook = encodeHookData({
    sessionId,
    sourceDomain: CCTP_DOMAIN.BASE_SEPOLIA,
    originalSender: evmSender,
    amount: cfg.amount,
  });
  console.log(`      hook hex   = 0x${Buffer.from(hook).toString("hex")}`);
  console.log(`      length     = ${hook.length} bytes`);
  return hook;
}

const TOKEN_MESSENGER_V2_ABI = parseAbi([
  "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData) public",
]);
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
]);

async function step3_depositForBurnWithHook(
  cfg: E2EConfig,
  hookData: Uint8Array,
  vaultAta: PublicKey
): Promise<{ txHash: `0x${string}` }> {
  console.log("\n[3/6] depositForBurnWithHook on Base Sepolia");
  const account = privateKeyToAccount(cfg.evmPrivateKey);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(cfg.evmRpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(cfg.evmRpcUrl),
  });

  const usdc = EVM_TESTNET_CCTP_V2.usdc.baseSepolia as `0x${string}`;
  const tokenMessenger = EVM_TESTNET_CCTP_V2.tokenMessengerV2 as `0x${string}`;

  console.log(`      EVM sender = ${account.address}`);
  console.log(`      USDC       = ${usdc}`);
  console.log(`      messenger  = ${tokenMessenger}`);

  // Check allowance, approve if insufficient.
  const currentAllowance = (await publicClient.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, tokenMessenger],
  } as never)) as bigint;

  if (currentAllowance < cfg.amount) {
    console.log(`      approving ${cfg.amount} USDC base units…`);
    const approveHash = await wallet.writeContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [tokenMessenger, cfg.amount],
    } as never);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`      approve tx = ${approveHash}`);
  } else {
    console.log("      allowance sufficient");
  }

  // depositForBurnWithHook
  const mintRecipient = pubkeyToBytes32Hex(vaultAta);
  const maxFee = cfg.amount / 1000n; // 0.1%
  const minFinalityThreshold = 1000;

  // Fetch fresh nonce from chain ("pending" — count incl. pending txs).
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });
  console.log(`      using nonce = ${nonce}`);

  const txHash = await wallet.writeContract({
    address: tokenMessenger,
    abi: TOKEN_MESSENGER_V2_ABI,
    functionName: "depositForBurnWithHook",
    args: [
      cfg.amount,
      CCTP_DOMAIN.SOLANA,
      mintRecipient,
      usdc,
      zeroHash,
      maxFee,
      minFinalityThreshold,
      toHex(hookData),
    ],
    nonce,
  } as never);
  console.log(`      burn tx    = ${txHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`Base Sepolia burn tx reverted: ${txHash}`);
  }
  console.log(`      block      = ${receipt.blockNumber}`);
  return { txHash };
}

async function step4_pollAttestation(txHash: `0x${string}`) {
  console.log("\n[4/6] poll Iris attestation (DoH bypass aktif untuk circle.com)");
  return pollAttestation(
    { srcDomain: CCTP_DOMAIN.BASE_SEPOLIA, txHash },
    {
      intervalMs: 3000,
      timeoutMs: 240_000,
      onTick: ({ elapsedMs, lastStatus }) => {
        process.stdout.write(`\r      ${(elapsedMs / 1000).toFixed(1)}s | ${lastStatus}        `);
      },
    },
    irisFetch
  ).then((res) => {
    console.log(`\n      attestation ready, message hex prefix=${res.message.slice(0, 18)}…`);
    return res;
  });
}

async function step5_receiveOnSolana(
  cfg: E2EConfig,
  connection: Connection,
  payer: Keypair,
  message: `0x${string}`,
  attestation: `0x${string}`
): Promise<{ sig: string; recipientAta: PublicKey }> {
  console.log("\n[5/6] receiveMessage on Solana Devnet");
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: "confirmed",
  });
  const mtIdl = JSON.parse(
    readFileSync(resolve(__dirname, "idl/message_transmitter_v2.json"), "utf-8")
  ) as Idl;
  const tmmIdl = JSON.parse(
    readFileSync(resolve(__dirname, "idl/token_messenger_minter_v2.json"), "utf-8")
  ) as Idl;
  const mtProgram = new Program(mtIdl, provider);
  const tmmProgram = new Program(tmmIdl, provider);

  const usdcMint = SOLANA_CCTP_V2_DEVNET.usdcMint;
  const remoteDomainStr = String(CCTP_DOMAIN.BASE_SEPOLIA);
  const remoteUsdcHex = EVM_TESTNET_CCTP_V2.usdc.baseSepolia;
  const remoteTokenKey = new PublicKey(
    Buffer.concat([Buffer.alloc(12), hexToBytes(remoteUsdcHex)])
  );

  const nonce = decodeEventNonceFromMessageV2(message);

  // Derive PDAs (mirror /tmp/cctp-ref/examples/v2/utilsV2.ts:getReceiveMessagePdasV2).
  const tokenMessenger = findPda(tmmProgram.programId, [TOKEN_MESSENGER_SEED]);
  const messageTransmitter = findPda(mtProgram.programId, [MT_STATE_SEED]);
  const tokenMinter = findPda(tmmProgram.programId, [TOKEN_MINTER_SEED]);
  const localToken = findPda(tmmProgram.programId, [LOCAL_TOKEN_SEED, usdcMint.toBuffer()]);
  const remoteTokenMessengerKey = findPda(tmmProgram.programId, [
    REMOTE_TOKEN_MESSENGER_SEED,
    Buffer.from(remoteDomainStr),
  ]);
  const tokenPair = findPda(tmmProgram.programId, [
    TOKEN_PAIR_SEED,
    Buffer.from(remoteDomainStr),
    remoteTokenKey.toBuffer(),
  ]);
  const custodyTokenAccount = findPda(tmmProgram.programId, [CUSTODY_SEED, usdcMint.toBuffer()]);
  const authorityPda = findPda(mtProgram.programId, [
    MT_AUTHORITY_SEED,
    tmmProgram.programId.toBuffer(),
  ]).publicKey;
  const tokenMessengerEventAuthority = findPda(tmmProgram.programId, [EVENT_AUTHORITY_SEED]);
  const usedNonce = findPda(mtProgram.programId, [USED_NONCE_SEED, nonce]).publicKey;

  // Fetch fee_recipient from token_messenger account.
  const tmAccount = (await (tmmProgram.account as any).tokenMessenger.fetch(
    tokenMessenger.publicKey
  )) as { feeRecipient: PublicKey };
  const feeRecipientTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    tmAccount.feeRecipient
  );

  // Recipient ATA = vault ATA we created earlier. Decode from message body? Actually, the
  // message itself encodes the mintRecipient. CCTP V2 receives uses the recipient stored
  // in the message. Pass our derived vault ATA — same as we encoded in EVM.
  const messageBuf = hexToBytes(message);
  // In CCTP V2 message body, mintRecipient is at offset 152 (after header+body type+amount
  // for token transfer). Easier path: re-derive from sessionId we just used.
  // Rather than parse the message, we trust the EVM-side encoding.

  // Recipient ATA — we passed mintRecipient = vaultAta dari EVM. Decode from message body.
  // Body offset: header is 148 bytes (CCTP V2). Body for burn: version(4)+burnToken(32)+
  //   mintRecipient(32)+amount(32)+messageSender(32). mintRecipient di offset 148+4+32 = 184.
  const mintRecipientBytes = messageBuf.subarray(184, 184 + 32);
  const recipientAta = new PublicKey(mintRecipientBytes);

  console.log(`      nonce        = 0x${nonce.toString("hex")}`);
  console.log(`      usedNonce    = ${usedNonce.toBase58()}`);
  console.log(`      recipientAta = ${recipientAta.toBase58()}`);

  const accountMetas = [
    { isSigner: false, isWritable: false, pubkey: tokenMessenger.publicKey },
    { isSigner: false, isWritable: false, pubkey: remoteTokenMessengerKey.publicKey },
    { isSigner: false, isWritable: true, pubkey: tokenMinter.publicKey },
    { isSigner: false, isWritable: true, pubkey: localToken.publicKey },
    { isSigner: false, isWritable: false, pubkey: tokenPair.publicKey },
    { isSigner: false, isWritable: true, pubkey: feeRecipientTokenAccount },
    { isSigner: false, isWritable: true, pubkey: recipientAta },
    { isSigner: false, isWritable: true, pubkey: custodyTokenAccount.publicKey },
    { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
    { isSigner: false, isWritable: false, pubkey: tokenMessengerEventAuthority.publicKey },
    { isSigner: false, isWritable: false, pubkey: tmmProgram.programId },
  ];

  // Build instruction (don't .rpc() yet — need ALT to fit in 1232 byte limit).
  const ix = await (mtProgram.methods as any)
    .receiveMessage({
      message: messageBuf,
      attestation: hexToBytes(attestation),
    })
    .accounts({
      payer: payer.publicKey,
      caller: payer.publicKey,
      authorityPda,
      messageTransmitter: messageTransmitter.publicKey,
      usedNonce,
      receiver: tmmProgram.programId,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(accountMetas)
    .instruction();

  // Create ephemeral ALT for static accounts. Legacy tx exceeds 1232 bytes karena
  // 20+ accounts × 32 bytes = 640+ bytes overhead; ALT compress jadi 1 byte index per account.
  const recentSlot = (await connection.getSlot("finalized"));
  const [createAltIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot,
  });
  console.log(`      ALT address  = ${altAddress.toBase58()} (slot ${recentSlot})`);

  // Static accounts to put into ALT — semua kecuali payer + signer-only + writable args.
  const altKeys = [
    authorityPda,
    messageTransmitter.publicKey,
    usedNonce,
    tmmProgram.programId,
    SystemProgram.programId,
    tokenMessenger.publicKey,
    remoteTokenMessengerKey.publicKey,
    tokenMinter.publicKey,
    localToken.publicKey,
    tokenPair.publicKey,
    feeRecipientTokenAccount,
    recipientAta,
    custodyTokenAccount.publicKey,
    TOKEN_PROGRAM_ID,
    tokenMessengerEventAuthority.publicKey,
  ];
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altAddress,
    addresses: altKeys,
  });

  // Submit ALT creation + extension in one tx.
  const altTx = new Transaction().add(createAltIx, extendIx);
  const altSig = await connection.sendTransaction(altTx, [payer]);
  await connection.confirmTransaction(altSig, "confirmed");
  console.log(`      ALT tx       = ${altSig}`);

  // ALT activation needs ≥1 slot warmup. Wait for blockhash to advance.
  await new Promise((res) => setTimeout(res, 3000));

  const altAccount = (await connection.getAddressLookupTable(altAddress)).value;
  if (!altAccount) throw new Error("ALT not found post-create");

  // Build versioned tx with ALT.
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message([altAccount]);

  const vtx = new VersionedTransaction(messageV0);
  vtx.sign([payer]);

  const txBytes = vtx.serialize().length;
  console.log(`      v0 tx size   = ${txBytes} bytes`);

  const sig = await connection.sendTransaction(vtx, { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");

  console.log(`      receive tx   = ${sig}`);
  return { sig, recipientAta };
}

async function step6_verifyVaultBalance(
  connection: Connection,
  vaultAta: PublicKey,
  expected: bigint
): Promise<void> {
  console.log("\n[6/6] verify vault USDC balance");
  const ata = await getAccount(connection, vaultAta);
  console.log(`      vault USDC = ${ata.amount} (expected ≥ ${expected - expected / 1000n})`);
  // Allow 0.1% fee tolerance (CCTP fee).
  if (ata.amount < expected - expected / 1000n) {
    throw new Error(
      `Vault balance too low: got ${ata.amount}, expected ≥ ${expected - expected / 1000n}`
    );
  }
}

// ============================================================
// Main
// ============================================================

export async function main(): Promise<void> {
  const cfg = loadConfig();
  const connection = new Connection(cfg.solanaRpcUrl, "confirmed");
  const payer = loadKeypair(cfg.solanaKeypairPath);

  console.log("CCTP V2 E2E — Base Sepolia → Solana Devnet");
  console.log(`  payer (Solana) = ${payer.publicKey.toBase58()}`);
  console.log(`  USDC mint      = ${SOLANA_CCTP_V2_DEVNET.usdcMint.toBase58()}`);
  console.log(`  amount         = ${cfg.amount} base units (${Number(cfg.amount) / 1e6} USDC)`);

  const slot = await connection.getSlot();
  console.log(`  Solana slot    = ${slot}`);

  const { sessionId, vaultAta } = await step1_setupVaultPda(cfg, connection, payer);

  const evmAccount = privateKeyToAccount(cfg.evmPrivateKey);
  const hookData = step2_buildHookData(cfg, sessionId, evmAccount.address);

  // Resume mode: kalau BURN_TX_HASH di-set, skip step3 (USDC burn) dan langsung
  // poll attestation. Berguna untuk re-run jaringan flaky atau debug step 5/6.
  let txHash: `0x${string}`;
  const resumeBurn = process.env.BURN_TX_HASH;
  if (resumeBurn) {
    console.log(`\n[3/6] SKIPPED — resuming with BURN_TX_HASH=${resumeBurn}`);
    txHash = resumeBurn as `0x${string}`;
  } else {
    ({ txHash } = await step3_depositForBurnWithHook(cfg, hookData, vaultAta));
  }
  const att = await step4_pollAttestation(txHash);
  const { recipientAta } = await step5_receiveOnSolana(
    cfg,
    connection,
    payer,
    att.message,
    att.attestation
  );
  await step6_verifyVaultBalance(connection, recipientAta, cfg.amount);

  console.log("\n✅ CCTP E2E hijau — vault PDA telah menerima USDC dari Base Sepolia.");
  console.log("   Catatan: pulse_payment.cctp_hook_handler tidak di-test E2E (butuh init");
  console.log("   Merchant + PaymentSession dari core program). Logic sudah unit-tested di Rust.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("\n❌ E2E failed:", err);
    process.exit(1);
  });
}
