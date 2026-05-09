//! Pulse Payment program — split payment Solana NFC tap-to-pay.
//!
//! Modul cross-chain (CCTP V2 + LayerZero V2 OApp) dipisah ke `cross_chain/` dan
//! `instructions/cross_chain/`. Core program (Merchant init, payment session lifecycle,
//! `execute_split_payment`) dikerjakan oleh teman di workspace berbeda — di repo ini
//! kita pakai mock di `state/mock.rs` supaya CCTP integration bisa di-test independen.

use anchor_lang::prelude::*;

pub mod cross_chain;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use instructions::*;

declare_id!("Gh2NP3fBQfdARCkTerXx8vzgEY1yFhH5ApM8v79rj8d2");

#[program]
pub mod pulse_payment {
    use super::*;

    /// Placeholder — diganti oleh teman kerjasama dengan core init Merchant + Session.
    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// CCTP V2 hook handler — dipanggil setelah USDC ter-mint ke vault PDA.
    /// Lihat `instructions/cross_chain/cctp_hook.rs` untuk full flow.
    pub fn cctp_hook_handler(
        ctx: Context<CctpHookHandler>,
        hook_data_raw: Vec<u8>,
        vault_authority_bump: u8,
    ) -> Result<()> {
        instructions::cross_chain::cctp_hook::handler(ctx, hook_data_raw, vault_authority_bump)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
