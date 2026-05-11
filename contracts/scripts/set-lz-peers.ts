/**
 * Set peer config di pulse_lz_oapp untuk Base Sepolia + Arb Sepolia.
 *
 * Usage: pnpm exec tsx scripts/set-lz-peers.ts
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

const PULSE_LZ_OAPP_PROGRAM_ID = new PublicKey(
  "AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8",
);
const STORE_SEED = Buffer.from("Store");
const PEER_SEED = Buffer.from("Peer");

const PEERS: Array<{ eid: number; evmAddress: string; label: string }> = [
  { eid: 40245, evmAddress: "0xcead105d5c0612f314d2fb25a630663dfc9c522a", label: "Base Sepolia" },
  { eid: 40231, evmAddress: "0xd977ad033490ef42db9e3b8fc294425369b5a15a", label: "Arb Sepolia" },
];

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function ixDiscriminator(name: string): Uint8Array {
  return Uint8Array.from(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8),
  );
}

function evmAddressToBytes32(addr: string): Uint8Array {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) throw new Error("bad evm addr: " + addr);
  const out = new Uint8Array(32);
  // EVM convention: left-pad ke 32 bytes (right-aligned 20 bytes).
  out.set(Buffer.from(hex, "hex"), 12);
  return out;
}

function encodeSetPeerConfigData(remoteEid: number, peerBytes32: Uint8Array): Uint8Array {
  // discriminator (8) + remote_eid (u32 LE = 4) + enum variant tag (u8 = 0 untuk PeerAddress) + [u8;32]
  const disc = ixDiscriminator("set_peer_config");
  const data = new Uint8Array(8 + 4 + 1 + 32);
  data.set(disc, 0);
  const view = new DataView(data.buffer);
  view.setUint32(8, remoteEid, true);
  data[12] = 0; // enum variant 0 = PeerAddress
  data.set(peerBytes32, 13);
  return data;
}

async function main() {
  const adminPath = process.env.ADMIN_KEYPAIR_PATH ?? "./.keys/pulse-deploy.json";
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const admin = loadKeypair(adminPath);
  const connection = new Connection(rpcUrl, "confirmed");

  const [storePda] = PublicKey.findProgramAddressSync([STORE_SEED], PULSE_LZ_OAPP_PROGRAM_ID);
  console.log("Store PDA:", storePda.toBase58(), "\nAdmin:", admin.publicKey.toBase58(), "\n");

  for (const peer of PEERS) {
    const eidBytes = Buffer.alloc(4);
    eidBytes.writeUInt32BE(peer.eid, 0);
    const [peerPda] = PublicKey.findProgramAddressSync(
      [PEER_SEED, storePda.toBytes(), eidBytes],
      PULSE_LZ_OAPP_PROGRAM_ID,
    );
    const peerBytes32 = evmAddressToBytes32(peer.evmAddress);

    const ix = new TransactionInstruction({
      programId: PULSE_LZ_OAPP_PROGRAM_ID,
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: peerPda, isSigner: false, isWritable: true },
        { pubkey: storePda, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(encodeSetPeerConfigData(peer.eid, peerBytes32)),
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
      commitment: "confirmed",
    });
    console.log(`✅ ${peer.label} (EID ${peer.eid}) → peer ${peer.evmAddress}`);
    console.log(`   PeerConfig: ${peerPda.toBase58()}`);
    console.log(`   Sig: ${sig}\n`);
  }
}

main().catch((err) => {
  console.error("set-lz-peers failed:", err);
  process.exit(1);
});
