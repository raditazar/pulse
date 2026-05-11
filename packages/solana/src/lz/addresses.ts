/**
 * LayerZero V2 testnet addresses untuk Pulse.
 *
 * LZ Endpoint Solana program ID di-fetch dari LZ deployments file. Source of truth:
 * https://docs.layerzero.network/v2/deployments/chains/solana-testnet
 *
 * Update: ganti `LZ_ENDPOINT_SOLANA_DEVNET_PLACEHOLDER` dengan PublicKey real saat
 * Phase 2 deploy. Sampai itu di-set, init_store akan gagal di CPI register_oapp.
 */

import { PublicKey } from "@solana/web3.js";

export const PULSE_LZ_OAPP_PROGRAM_ID = new PublicKey(
  "AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8"
);

export const LZ_EID = {
  SOLANA_DEVNET: 40168,
  ETH_SEPOLIA: 40161,
  ARB_SEPOLIA: 40231,
  BASE_SEPOLIA: 40245,
} as const;

export type LzEid = (typeof LZ_EID)[keyof typeof LZ_EID];

/**
 * LayerZero V2 Endpoint program ID — Solana Testnet (Devnet).
 * Source: lz-devtools metadata `solana-testnet.json` (eid 40168, version 2).
 * Cross-verified vs https://docs.layerzero.network/v2/deployments/chains/solana-testnet.
 */
export const LZ_ENDPOINT_SOLANA_DEVNET = new PublicKey(
  "76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"
);

/**
 * Companion LZ V2 deployment addresses untuk Solana Testnet — dipakai saat
 * konfigurasi DVN/Executor di `set_peer_config` enforced options.
 */
export const LZ_SOLANA_TESTNET_DEPLOYMENT = {
  endpointV2: LZ_ENDPOINT_SOLANA_DEVNET,
  executor: new PublicKey("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn"),
  executorPda: new PublicKey("AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK"),
  sendUln302: new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
  receiveUln302: new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
  dvn: new PublicKey("HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW"),
  pricefeed: new PublicKey("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
  blockedMessagelib: new PublicKey("2XrYqmhBMPJgDsb4SVbjV1PnJBprurd5bzRCkHwiFCJB"),
} as const;

export const PULSE_LZ_PDA_SEEDS = {
  STORE: Buffer.from("Store"),
  PEER: Buffer.from("Peer"),
  LZ_RECEIVE_TYPES: Buffer.from("LzReceiveTypes"),
} as const;

/**
 * Derive Store PDA untuk Pulse LZ OApp. Matches Rust seed `[STORE_SEED]`.
 */
export function deriveStorePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PULSE_LZ_PDA_SEEDS.STORE],
    PULSE_LZ_OAPP_PROGRAM_ID
  );
}

/**
 * Derive Peer PDA untuk source EID tertentu.
 * Matches Rust: `[PEER_SEED, store.key().to_bytes(), src_eid.to_be_bytes()]`.
 */
export function derivePeerPda(store: PublicKey, srcEid: number): [PublicKey, number] {
  const eidBytes = Buffer.alloc(4);
  eidBytes.writeUInt32BE(srcEid, 0);
  return PublicKey.findProgramAddressSync(
    [PULSE_LZ_PDA_SEEDS.PEER, store.toBuffer(), eidBytes],
    PULSE_LZ_OAPP_PROGRAM_ID
  );
}

/**
 * Derive LzReceiveTypesAccounts PDA. Executor LZ baca PDA ini sebagai prerequisite.
 */
export function deriveLzReceiveTypesPda(store: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PULSE_LZ_PDA_SEEDS.LZ_RECEIVE_TYPES, store.toBuffer()],
    PULSE_LZ_OAPP_PROGRAM_ID
  );
}
