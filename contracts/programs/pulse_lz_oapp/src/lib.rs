//! Pulse LayerZero V2 OApp — receives PaymentIntent dari peer EVM (Base Sepolia, Arbitrum
//! Sepolia) untuk Pulse cross-chain settlement.
//!
//! Standalone program (program ID terpisah dari `pulse_payment`) supaya:
//! 1. Dependency `oapp` git tidak menyentuh build path program inti.
//! 2. LayerZero best practice — OApp punya program ID dedicated.
//!
//! ## Trusted-relayer model
//!
//! `lz_receive` **tidak** menggerakkan token. Tugasnya hanya:
//!   1. Validasi peer (sender match `PeerConfig.peer_address`)
//!   2. CPI `endpoint::clear` (anti-replay)
//!   3. Decode 64-byte `PulseLzPayload`
//!   4. Emit `LzPaymentIntentReceived`
//!
//! Off-chain relayer Pulse (signer key disimpan di `pulse_payment::PulseConfig.trusted_relayer`)
//! men-subscribe event ini, lalu memanggil `pulse_payment.execute_trusted_split` yang melakukan
//! transfer USDC sebenarnya dari treasury relayer ke beneficiary ATAs.
//!
//! Pemisahan ini intentional: LayerZero menjamin authenticity payload; trust untuk settlement
//! di-isolate ke single signer yang bisa dirotasi via `pulse_payment::set_trusted_relayer`.

use anchor_lang::prelude::*;
use oapp::{
    endpoint::MessagingFee,
    lz_receive_types_v2::{LzReceiveTypesV2Accounts, LzReceiveTypesV2Result},
    LzReceiveParams,
};

pub mod errors;
pub mod events;
pub mod instructions;
pub mod payload_codec;
pub mod state;

use instructions::*;

declare_id!("AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8");

pub const STORE_SEED: &[u8] = b"Store";
pub const PEER_SEED: &[u8] = b"Peer";
pub const LZ_RECEIVE_TYPES_SEED: &[u8] = b"LzReceiveTypes";

#[program]
pub mod pulse_lz_oapp {
    use super::*;

    /// Initialize OApp Store + LzReceiveTypes PDA + register dengan LZ Endpoint.
    /// Front-runnable — siapapun yang call pertama jadi admin. Production: tambah access control
    /// (mis. require admin == upgrade authority).
    pub fn init_store(mut ctx: Context<InitStore>, params: InitStoreParams) -> Result<()> {
        InitStore::apply(&mut ctx, &params)
    }

    /// Admin-only: register peer EVM untuk source EID tertentu.
    pub fn set_peer_config(
        mut ctx: Context<SetPeerConfig>,
        params: SetPeerConfigParams,
    ) -> Result<()> {
        SetPeerConfig::apply(&mut ctx, &params)
    }

    /// Public: handler untuk LayerZero incoming message. Dipanggil oleh Executor LZ.
    pub fn lz_receive(mut ctx: Context<LzReceive>, params: LzReceiveParams) -> Result<()> {
        LzReceive::apply(&mut ctx, &params)
    }

    /// Public: returns execution plan untuk Executor V2 (set akun + ALT + instruksi sequence).
    pub fn lz_receive_types_v2(
        ctx: Context<LzReceiveTypesV2>,
        params: LzReceiveParams,
    ) -> Result<LzReceiveTypesV2Result> {
        LzReceiveTypesV2::apply(&ctx, &params)
    }

    /// Public: versioning info untuk Executor LZ — return (version=2, accounts).
    pub fn lz_receive_types_info(
        ctx: Context<LzReceiveTypesInfo>,
        params: LzReceiveParams,
    ) -> Result<(u8, LzReceiveTypesV2Accounts)> {
        LzReceiveTypesInfo::apply(&ctx, &params)
    }
}
