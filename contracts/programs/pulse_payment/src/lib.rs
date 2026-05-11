//! Pulse Payment program — split payment Solana NFC tap-to-pay.
//!
//! Modul cross-chain CCTP V2 di-handle di sini (`cross_chain/` + `instructions/cross_chain/`).
//! LayerZero V2 OApp (Phase 2) dipisah ke crate `pulse_lz_oapp/` di workspace yang sama supaya
//! dependency `oapp` git tidak menambah build time / risk untuk Phase 1.
//!
//! Core program (merchant lifecycle, payment session lifecycle, dan `execute_split_payment`)
//! sudah live di crate ini dan menjadi source of truth untuk integrasi backend/frontend
//! maupun stretch cross-chain flow.

use anchor_lang::prelude::*;

pub mod cross_chain;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use instructions::*;

declare_id!("2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF");

#[program]
pub mod pulse_payment {
    use super::*;

    pub fn initialize_merchant(
        ctx: Context<InitializeMerchant>,
        primary_beneficiary: Pubkey,
        split_beneficiaries: Vec<state::SplitConfig>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::initialize_merchant::handler(
            ctx,
            primary_beneficiary,
            split_beneficiaries,
            metadata_uri,
        )
    }

    pub fn update_merchant_split(
        ctx: Context<UpdateMerchantSplit>,
        primary_beneficiary: Pubkey,
        split_beneficiaries: Vec<state::SplitConfig>,
        metadata_uri: Option<String>,
    ) -> Result<()> {
        instructions::update_merchant_split::handler(
            ctx,
            primary_beneficiary,
            split_beneficiaries,
            metadata_uri,
        )
    }

    pub fn deactivate_merchant(ctx: Context<DeactivateMerchant>) -> Result<()> {
        instructions::deactivate_merchant::handler(ctx)
    }

    pub fn create_session(
        ctx: Context<CreateSession>,
        session_id: [u8; 32],
        amount_usdc: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_session::handler(ctx, session_id, amount_usdc, expires_at)
    }

    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        instructions::close_session::handler(ctx)
    }

    pub fn execute_split_payment<'info>(
        ctx: Context<'_, '_, 'info, 'info, ExecuteSplitPayment<'info>>,
    ) -> Result<()> {
        instructions::execute_split_payment::handler(ctx)
    }

    /// CCTP V2 hook handler — dipanggil setelah USDC ter-mint ke vault PDA.
    /// Lihat `instructions/cross_chain/cctp_hook.rs` untuk full flow.
    pub fn cctp_hook_handler<'info>(
        ctx: Context<'_, '_, 'info, 'info, CctpHookHandler<'info>>,
        hook_data_raw: Vec<u8>,
        vault_authority_bump: u8,
    ) -> Result<()> {
        instructions::cross_chain::cctp_hook::handler(ctx, hook_data_raw, vault_authority_bump)
    }
}
