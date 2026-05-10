//! Pulse LayerZero V2 OApp — receives PaymentIntent dari peer EVM (Base Sepolia, Arbitrum
//! Sepolia, dll.) dan pre-warm `PaymentSession` di program `pulse_payment` via CPI / event.
//!
//! Standalone program (program ID terpisah dari `pulse_payment`) supaya:
//! 1. Dependency `oapp` git tidak menyentuh build path Phase 1.
//! 2. LayerZero standard practice — OApp punya program ID dedicated.
//!
//! Untuk M0 Phase 2: `lz_receive` cukup decode payload + emit `LzPaymentIntentReceived` event.
//! Off-chain relayer/indexer Pulse pick up event ini dan pre-warm session via instruksi
//! `pulse_payment` standar. CPI direct ke `pulse_payment` di-defer sampai core program merge
//! supaya tidak coupling tight ke mock state.

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
