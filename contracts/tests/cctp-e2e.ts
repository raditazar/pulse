/**
 * CCTP V2 end-to-end test: Base Sepolia → Solana Devnet → Pulse split.
 *
 * # Status: SKELETON RUNNER (Phase 1.4)
 *
 * Script ini DESIGN-COMPLETE tapi sengaja tidak auto-execute leg EVM-nya. Reasons:
 *   1. Butuh EVM private key dengan saldo Base Sepolia ETH + USDC — owner harus
 *      explicit consent sebelum spend faucet funds dan submit on-chain tx.
 *   2. Butuh Anchor IDL dari `circlefin/solana-cctp-contracts/programs/v2` ter-build,
 *      yang depends pada CCTP repo build hijau di local. Itu manual setup yang lebih
 *      baik di-trigger oleh dev (lihat `SETUP.md` step 7).
 *
 * # Cara pakai (manual, setelah satisfy prerequisites)
 *
 * ```bash
 * # 1. Build CCTP V2 IDLs
 * cd /tmp/cctp-ref/programs/v2 && anchor build
 *
 * # 2. Set env vars (lihat .env.cctp.example dibikin di task ini)
 * export EVM_PRIVATE_KEY=0x...
 * export EVM_RPC_URL=https://sepolia.base.org
 * export SOLANA_RPC_URL=https://api.devnet.solana.com
 * export PULSE_PROGRAM_ID=2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF
 *
 * # 3. Run
 * pnpm tsx contracts/tests/cctp-e2e.ts
 * ```
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

import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import {
  CCTP_DOMAIN,
  EVM_TESTNET_CCTP_V2,
  encodeHookData,
  derivePulseVaultAuthority,
  pollAttestation,
  SOLANA_CCTP_V2_DEVNET,
} from "../../packages/solana/src/cctp";

interface E2EConfig {
  evmRpcUrl: string;
  evmPrivateKey: `0x${string}`;
  solanaRpcUrl: string;
  pulseProgramId: PublicKey;
  /** USDC base units yang akan ditransfer (default 1 USDC = 1_000_000). */
  amount: bigint;
}

function loadConfig(): E2EConfig {
  const required = [
    "EVM_PRIVATE_KEY",
    "EVM_RPC_URL",
    "SOLANA_RPC_URL",
    "PULSE_PROGRAM_ID",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `Missing env var ${key}. Lihat header file untuk daftar lengkap.`
      );
    }
  }
  return {
    evmRpcUrl: process.env.EVM_RPC_URL!,
    evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
    solanaRpcUrl: process.env.SOLANA_RPC_URL!,
    pulseProgramId: new PublicKey(process.env.PULSE_PROGRAM_ID!),
    amount: BigInt(process.env.AMOUNT_USDC_BASE_UNITS ?? "1000000"),
  };
}

async function step1_setupMockSession(
  cfg: E2EConfig,
  connection: Connection
): Promise<{ sessionId: PublicKey; merchant: PublicKey }> {
  // STUB: di-implement saat core program owner expose Merchant init dari core repo.
  // Untuk sekarang: ambil keypair statis sebagai mock session_id.
  console.log("[1/7] setup mock merchant + payment session …");
  void cfg;
  void connection;
  const sessionKp = Keypair.generate();
  console.log(`      session_id = ${sessionKp.publicKey.toBase58()}`);
  return {
    sessionId: sessionKp.publicKey,
    merchant: PublicKey.default,
  };
}

function step2_buildHookData(
  cfg: E2EConfig,
  sessionId: PublicKey,
  evmSender: `0x${string}`
): Uint8Array {
  console.log("[2/7] encoding 88-byte Pulse hook data …");
  const hook = encodeHookData({
    sessionId,
    sourceDomain: CCTP_DOMAIN.BASE_SEPOLIA,
    originalSender: evmSender,
    amount: cfg.amount,
  });
  console.log(`      hook_data hex = 0x${Buffer.from(hook).toString("hex")}`);
  return hook;
}

async function step3_depositForBurnWithHook(
  cfg: E2EConfig,
  hookData: Uint8Array,
  mintRecipient: PublicKey
): Promise<{ txHash: `0x${string}` }> {
  // STUB: implement dengan viem after adding dependency. Pseudocode:
  //
  //   const wallet = createWalletClient({ chain: baseSepolia, transport: http(cfg.evmRpcUrl), account: privateKeyToAccount(cfg.evmPrivateKey) });
  //   await wallet.writeContract({ address: EVM_TESTNET_CCTP_V2.usdc.baseSepolia, abi: ERC20_ABI, functionName: "approve", args: [EVM_TESTNET_CCTP_V2.tokenMessengerV2, cfg.amount] });
  //   const txHash = await wallet.writeContract({
  //     address: EVM_TESTNET_CCTP_V2.tokenMessengerV2 as `0x${string}`,
  //     abi: TOKEN_MESSENGER_V2_ABI,
  //     functionName: "depositForBurnWithHook",
  //     args: [
  //       cfg.amount,
  //       CCTP_DOMAIN.SOLANA,
  //       padHex(toHex(mintRecipient.toBytes()), { size: 32 }),
  //       EVM_TESTNET_CCTP_V2.usdc.baseSepolia,
  //       zeroAddress,                  // destinationCaller = anyone
  //       cfg.amount / 1000n,           // maxFee = 0.1%
  //       1000,                         // minFinalityThreshold
  //       toHex(hookData),
  //     ],
  //   });
  //
  console.log("[3/7] depositForBurnWithHook on Base Sepolia …");
  console.log(
    `      tokenMessengerV2 = ${EVM_TESTNET_CCTP_V2.tokenMessengerV2}`
  );
  console.log(`      mintRecipient   = ${mintRecipient.toBase58()}`);
  console.log(`      hookData.length = ${hookData.length}`);
  void cfg;
  throw new Error(
    "step3 not implemented: install viem dan complete EVM call sebelum running e2e"
  );
}

async function step4_pollAttestation(txHash: `0x${string}`) {
  console.log("[4/7] polling Iris attestation …");
  return pollAttestation(
    { srcDomain: CCTP_DOMAIN.BASE_SEPOLIA, txHash },
    {
      intervalMs: 3000,
      timeoutMs: 180_000,
      onTick: ({ elapsedMs, lastStatus }) => {
        console.log(`      … ${(elapsedMs / 1000).toFixed(1)}s | ${lastStatus}`);
      },
    }
  );
}

async function step5_receiveMessageOnSolana(
  cfg: E2EConfig,
  message: `0x${string}`,
  attestation: `0x${string}`,
  vaultAuthority: PublicKey
): Promise<string> {
  // STUB: pakai Anchor program client yang di-generate dari CCTP V2 IDL.
  //
  //   const mtIdl = require("/tmp/cctp-ref/target/idl/message_transmitter_v2.json");
  //   const mtProgram = new Program(mtIdl, SOLANA_CCTP_V2_DEVNET.messageTransmitterV2, provider);
  //   const sig = await mtProgram.methods.receiveMessage({ message: hexToBytes(message), attestation: hexToBytes(attestation) })
  //     .accounts({ ...derivedAccounts, receiver: SOLANA_CCTP_V2_DEVNET.tokenMessengerMinterV2 })
  //     .rpc();
  //
  console.log("[5/7] receiveMessage on Solana Devnet …");
  console.log(`      message      = ${message.slice(0, 20)}…`);
  console.log(`      attestation  = ${attestation.slice(0, 20)}…`);
  console.log(`      vaultAuthority = ${vaultAuthority.toBase58()}`);
  void cfg;
  throw new Error(
    "step5 not implemented: butuh Anchor IDL dari /tmp/cctp-ref ter-build"
  );
}

async function step6_callPulseHookHandler(
  cfg: E2EConfig,
  hookData: Uint8Array,
  vaultBump: number,
  session: PublicKey,
  merchant: PublicKey
): Promise<string> {
  // STUB: pakai Anchor program client dari `pulse_payment` IDL (akan di-generate
  // saat `anchor build` jalan dengan idl-build feature).
  //
  //   const pulseIdl = require("../target/idl/pulse_payment.json");
  //   const pulse = new Program(pulseIdl, cfg.pulseProgramId, provider);
  //   const sig = await pulse.methods.cctpHookHandler(Buffer.from(hookData), vaultBump)
  //     .accounts({ ... })
  //     .rpc();
  //
  console.log("[6/7] pulse_payment.cctp_hook_handler …");
  console.log(`      session=${session.toBase58()} merchant=${merchant.toBase58()}`);
  console.log(`      hookDataLen=${hookData.length} vaultBump=${vaultBump}`);
  void cfg;
  throw new Error("step6 not implemented: butuh pulse_payment IDL ter-generate");
}

async function step7_verifyBalances(
  cfg: E2EConfig,
  connection: Connection
): Promise<void> {
  console.log("[7/7] verifying merchant + platform USDC balances …");
  void cfg;
  void connection;
  throw new Error("step7 not implemented");
}

export async function main(): Promise<void> {
  const cfg = loadConfig();
  const connection = new Connection(cfg.solanaRpcUrl, "confirmed");

  // Solana Devnet sanity check.
  const slot = await connection.getSlot();
  console.log(`Solana Devnet slot = ${slot}`);
  console.log(`USDC mint (devnet) = ${SOLANA_CCTP_V2_DEVNET.usdcMint.toBase58()}`);

  const { sessionId, merchant } = await step1_setupMockSession(cfg, connection);
  const { vaultAuthority, bump: vaultBump } = derivePulseVaultAuthority(
    cfg.pulseProgramId,
    sessionId
  );

  const evmSender =
    "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
  const hookData = step2_buildHookData(cfg, sessionId, evmSender);

  const { txHash } = await step3_depositForBurnWithHook(
    cfg,
    hookData,
    vaultAuthority
  );
  const attestation = await step4_pollAttestation(txHash);

  const sig5 = await step5_receiveMessageOnSolana(
    cfg,
    attestation.message,
    attestation.attestation,
    vaultAuthority
  );
  console.log(`step5 sig = ${sig5}`);

  const sig6 = await step6_callPulseHookHandler(
    cfg,
    hookData,
    vaultBump,
    sessionId,
    merchant
  );
  console.log(`step6 sig = ${sig6}`);

  await step7_verifyBalances(cfg, connection);
  console.log("\n✅ CCTP E2E hijau.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("\n❌ E2E failed:", err);
    process.exit(1);
  });
}
