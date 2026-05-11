/**
 * Init Pulse LZ OApp Store PDA + register_oapp dengan LZ Endpoint Solana Devnet.
 *
 * Usage: pnpm exec tsx scripts/init-lz-store.ts
 */

import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

const PULSE_LZ_OAPP_PROGRAM_ID = new PublicKey(
  "AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8",
);
const PULSE_PAYMENT_PROGRAM_ID = new PublicKey(
  "2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF",
);
const LZ_ENDPOINT_PROGRAM_ID = new PublicKey(
  "76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6",
);

const STORE_SEED = Buffer.from("Store");
const LZ_RECEIVE_TYPES_SEED = Buffer.from("LzReceiveTypes");
const OAPP_SEED = Buffer.from("OApp");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function ixDiscriminator(name: string): Uint8Array {
  return Uint8Array.from(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

async function main() {
  const adminPath = process.env.ADMIN_KEYPAIR_PATH ?? "./.keys/pulse-deploy.json";
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

  const admin = loadKeypair(adminPath);
  const connection = new Connection(rpcUrl, "confirmed");

  // Derive PDAs.
  const [storePda, storeBump] = PublicKey.findProgramAddressSync(
    [STORE_SEED],
    PULSE_LZ_OAPP_PROGRAM_ID,
  );
  const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
    [LZ_RECEIVE_TYPES_SEED, storePda.toBytes()],
    PULSE_LZ_OAPP_PROGRAM_ID,
  );
  const [oappRegistryPda] = PublicKey.findProgramAddressSync(
    [OAPP_SEED, storePda.toBytes()],
    LZ_ENDPOINT_PROGRAM_ID,
  );
  const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
    [EVENT_AUTHORITY_SEED],
    LZ_ENDPOINT_PROGRAM_ID,
  );

  console.log("Pulse LZ OApp program:", PULSE_LZ_OAPP_PROGRAM_ID.toBase58());
  console.log("Admin:                ", admin.publicKey.toBase58());
  console.log("Store PDA:            ", storePda.toBase58(), `(bump ${storeBump})`);
  console.log("LzReceiveTypes PDA:   ", lzReceiveTypesPda.toBase58());
  console.log("OAppRegistry PDA:     ", oappRegistryPda.toBase58());
  console.log("EventAuthority PDA:   ", eventAuthorityPda.toBase58());

  // Check if already initialized.
  const existing = await connection.getAccountInfo(storePda);
  if (existing) {
    console.log(
      `\n⚠️  Store sudah ada (data length ${existing.data.length}). Skipping init.`,
    );
    return;
  }

  // Instruction data:
  //   discriminator (8) + InitStoreParams { admin(32), endpoint(32), pulse_program(32) }
  const disc = ixDiscriminator("init_store");
  const data = new Uint8Array(8 + 32 + 32 + 32);
  data.set(disc, 0);
  data.set(admin.publicKey.toBytes(), 8);
  data.set(LZ_ENDPOINT_PROGRAM_ID.toBytes(), 40);
  data.set(PULSE_PAYMENT_PROGRAM_ID.toBytes(), 72);

  // Main accounts (from pulse_lz_oapp::InitStore<'info>):
  //   payer, store, lz_receive_types_accounts, alt (optional), system_program
  // Untuk Option<Account>, placeholder = program's own ID (pulse_lz_oapp).
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: storePda, isSigner: false, isWritable: true },
    { pubkey: lzReceiveTypesPda, isSigner: false, isWritable: true },
    { pubkey: PULSE_LZ_OAPP_PROGRAM_ID, isSigner: false, isWritable: false }, // alt = None
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // Remaining accounts untuk register_oapp CPI (urut sesuai endpoint_cpi::register_oapp):
  //   0: endpoint program
  //   1: payer
  //   2: oapp = Store PDA (signer via seeds dari pulse_lz_oapp)
  //   3: oapp_registry PDA
  //   4: system_program
  //   5: event_authority PDA
  //   6: endpoint program (lagi, untuk emit_cpi)
  keys.push(
    { pubkey: LZ_ENDPOINT_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: storePda, isSigner: false, isWritable: false },
    { pubkey: oappRegistryPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthorityPda, isSigner: false, isWritable: false },
    { pubkey: LZ_ENDPOINT_PROGRAM_ID, isSigner: false, isWritable: false },
  );

  const ix = new TransactionInstruction({
    programId: PULSE_LZ_OAPP_PROGRAM_ID,
    keys,
    data: Buffer.from(data),
  });

  const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
  const tx = new Transaction().add(cuIx, ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
    commitment: "confirmed",
  });

  console.log("\n✅ init_store OK");
  console.log("Signature:", sig);
  console.log("Explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
}

main().catch((err) => {
  console.error("init_store failed:", err);
  process.exit(1);
});
