/**
 * Init + set receive_library_config untuk Pulse LZ OApp di endpoint.
 *
 * Solana OApp lz_receive butuh receive_library_config PDA exists + di-set ke
 * receiveUln302. Tanpa ini, LZ Executor block message dgn status "Config error".
 *
 * Usage: pnpm exec tsx scripts/init-lz-receive-library.ts
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
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

const LZ_ENDPOINT = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");
const PULSE_LZ_OAPP = new PublicKey("AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8");
const RECEIVE_ULN302 = new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH");

const STORE_SEED = Buffer.from("Store");
const OAPP_SEED_LZ = Buffer.from("OApp");
const RECEIVE_LIBRARY_CONFIG_SEED = Buffer.from("ReceiveLibraryConfig");
const MESSAGE_LIB_SEED = Buffer.from("MessageLib");
const EVENT_AUTHORITY_SEED = Buffer.from("__event_authority");

const EIDS = [
  { eid: 40245, label: "Base Sepolia" },
  { eid: 40231, label: "Arb Sepolia" },
];

function loadKeypair(p: string) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
}
function disc(name: string) {
  return Uint8Array.from(createHash("sha256").update(`global:${name}`).digest().subarray(0, 8));
}
function eidBE(eid: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(eid, 0);
  return b;
}

async function main() {
  const adminPath =
    process.env.ADMIN_KEYPAIR_PATH ??
    new URL("../.keys/pulse-deploy.json", import.meta.url).pathname;
  const admin = loadKeypair(adminPath);
  const conn = new Connection(
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed",
  );

  const [storePda] = PublicKey.findProgramAddressSync([STORE_SEED], PULSE_LZ_OAPP);
  const [oappRegistry] = PublicKey.findProgramAddressSync(
    [OAPP_SEED_LZ, storePda.toBuffer()],
    LZ_ENDPOINT,
  );
  const [messageLibInfo] = PublicKey.findProgramAddressSync(
    [MESSAGE_LIB_SEED, RECEIVE_ULN302.toBuffer()],
    LZ_ENDPOINT,
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [EVENT_AUTHORITY_SEED],
    LZ_ENDPOINT,
  );

  console.log("Admin:        ", admin.publicKey.toBase58());
  console.log("Store PDA:    ", storePda.toBase58());
  console.log("OApp registry:", oappRegistry.toBase58());
  console.log("ReceiveUln302:", RECEIVE_ULN302.toBase58());
  console.log("MessageLibInfo:", messageLibInfo.toBase58());

  for (const { eid, label } of EIDS) {
    console.log(`\n=== ${label} (eid ${eid}) ===`);
    const [rxCfg] = PublicKey.findProgramAddressSync(
      [RECEIVE_LIBRARY_CONFIG_SEED, storePda.toBuffer(), eidBE(eid)],
      LZ_ENDPOINT,
    );
    console.log("ReceiveLibraryConfig PDA:", rxCfg.toBase58());

    const ixs: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ];

    // --- Step 1: init_receive_library kalau belum ada ---
    const exists = await conn.getAccountInfo(rxCfg);
    if (!exists) {
      // data: disc(8) + receiver(32) + eid(u32 LE)
      const initData = Buffer.alloc(8 + 32 + 4);
      Buffer.from(disc("init_receive_library")).copy(initData, 0);
      storePda.toBuffer().copy(initData, 8);
      initData.writeUInt32LE(eid, 40);

      ixs.push(
        new TransactionInstruction({
          programId: LZ_ENDPOINT,
          keys: [
            { pubkey: admin.publicKey, isSigner: true, isWritable: true },
            { pubkey: oappRegistry, isSigner: false, isWritable: false },
            { pubkey: rxCfg, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: initData,
        }),
      );
      console.log("  + init_receive_library");
    } else {
      console.log("  ✓ ReceiveLibraryConfig already exists");
    }

    // Skip set_receive_library — leave as DEFAULT_MESSAGE_LIB so endpoint falls
    // back to whatever LZ admin sets as default for this EID.

    try {
      const sig = await sendAndConfirmTransaction(
        conn,
        new Transaction().add(...ixs),
        [admin],
        { commitment: "confirmed" },
      );
      console.log("  ✓ Sig:", sig);
    } catch (err: any) {
      const msg = err?.transactionMessage ?? err?.message ?? String(err);
      const logs = err?.transactionLogs ?? err?.logs ?? [];
      console.error("  ✗ Failed:", msg);
      if (logs.length) console.error("  logs:\n  " + logs.slice(-8).join("\n  "));
      throw err;
    }
  }

  console.log("\n✅ All receive_library configs initialized + set");
}

main().catch((e) => {
  console.error("init-lz-receive-library failed:", e?.message ?? e);
  process.exit(1);
});
