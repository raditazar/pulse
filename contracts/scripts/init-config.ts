/**
 * Init PulseConfig PDA — one-shot setelah pulse_payment di-upgrade.
 *
 * Usage:
 *   pnpm exec tsx scripts/init-config.ts
 *
 * Env:
 *   ADMIN_KEYPAIR_PATH (default: ./.keys/pulse-deploy.json)
 *   RELAYER_KEYPAIR_PATH (default: ./.keys/pulse-relayer.json)
 *   SOLANA_RPC_URL (default: https://api.devnet.solana.com)
 */

import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

const PROGRAM_ID = new PublicKey("2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF");
const PULSE_CONFIG_SEED = Buffer.from("pulse-config");

function loadKeypair(path: string): Keypair {
  const arr = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function anchorIxDiscriminator(name: string): Uint8Array {
  return Uint8Array.from(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

async function main() {
  const adminPath = process.env.ADMIN_KEYPAIR_PATH ?? "./.keys/pulse-deploy.json";
  const relayerPath = process.env.RELAYER_KEYPAIR_PATH ?? "./.keys/pulse-relayer.json";
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

  const admin = loadKeypair(adminPath);
  const relayer = loadKeypair(relayerPath);
  const connection = new Connection(rpcUrl, "confirmed");

  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [PULSE_CONFIG_SEED],
    PROGRAM_ID,
  );

  console.log("Pulse Payment program:", PROGRAM_ID.toBase58());
  console.log("Admin:                ", admin.publicKey.toBase58());
  console.log("Trusted relayer:      ", relayer.publicKey.toBase58());
  console.log("PulseConfig PDA:      ", configPda.toBase58(), `(bump ${configBump})`);

  const existing = await connection.getAccountInfo(configPda);
  if (existing) {
    console.log("\n⚠️  PulseConfig sudah ada (data length", existing.data.length, "). Skipping init.");
    console.log("Untuk update trusted_relayer, panggil set_trusted_relayer instead.");
    return;
  }

  // Discriminator (8) + trusted_relayer (32) = 40 bytes
  const disc = anchorIxDiscriminator("init_config");
  const data = new Uint8Array(40);
  data.set(disc, 0);
  data.set(relayer.publicKey.toBytes(), 8);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
    commitment: "confirmed",
  });
  console.log("\n✅ init_config OK");
  console.log("Signature:", sig);
  console.log("Explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
}

main().catch((err) => {
  console.error("init_config failed:", err);
  process.exit(1);
});
