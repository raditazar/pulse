//! Pulse Payment program — split payment Solana NFC tap-to-pay.
//!
//! ## Modules
//!
//! - **Core**: merchant lifecycle, payment session lifecycle, `execute_split_payment`
//!   (single-chain Solana → Solana flow yang dipakai oleh checkout PWA).
//! - **Trusted cross-chain layer**: `init_config` + `set_trusted_relayer` mengatur global
//!   `PulseConfig` PDA. `execute_trusted_split` adalah entry point relayer off-chain yang
//!   menyelesaikan payment yang berasal dari EVM (Base/Arb Sepolia) via LayerZero V2.
//!
//! LayerZero V2 OApp Solana sendiri ada di crate terpisah `pulse_lz_oapp/` — ia hanya
//! decode payload + emit event. Trust boundary di-enforce oleh `PulseConfig.trusted_relayer`.

use anchor_lang::prelude::*;

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

    /// Inisialisasi PulseConfig PDA (admin + trusted relayer). One-shot per cluster.
    pub fn init_config(ctx: Context<InitConfig>, trusted_relayer: Pubkey) -> Result<()> {
        instructions::init_config::handler(ctx, trusted_relayer)
    }

    /// Update trusted relayer. Hanya admin di PulseConfig yang boleh memanggil.
    pub fn set_trusted_relayer(
        ctx: Context<SetTrustedRelayer>,
        new_relayer: Pubkey,
    ) -> Result<()> {
        instructions::set_trusted_relayer::handler(ctx, new_relayer)
    }

    /// Trusted relayer entry point untuk settle PaymentSession yang berasal dari EVM
    /// via LayerZero V2. Lihat `instructions/execute_trusted_split.rs` untuk full flow.
    pub fn execute_trusted_split<'info>(
        ctx: Context<'_, '_, 'info, 'info, ExecuteTrustedSplit<'info>>,
        source_eid: u32,
        source_payer: [u8; 20],
        amount_usdc: u64,
    ) -> Result<()> {
        instructions::execute_trusted_split::handler(ctx, source_eid, source_payer, amount_usdc)
    }
}
