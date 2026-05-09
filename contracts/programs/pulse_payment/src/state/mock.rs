//! Mock Merchant + PaymentSession state untuk independent CCTP integration testing.
//!
//! ⚠️ Mock ini akan di-replace oleh implementasi resmi dari core-program owner. Field signature
//! dan PDA seeds dikunci di sini supaya cross-chain code tidak perlu refactor saat merge.
//!
//! Kontrak antar-modul (sudah disepakati):
//! - `Merchant` PDA seeds: `["merchant", owner.key().as_ref()]`
//! - `PaymentSession` PDA seeds: `["session", merchant.key().as_ref(), &session_id]`
//! - `internal_execute_split(...)` adalah helper crate-private yang di sini kita stub-kan jadi
//!   actual SPL transfer dari vault → merchant ATA + platform ATA. Implementasi nyata punya
//!   logic yang lebih lengkap (multi-beneficiary, fee accounting, dll.).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::CrossChainError;

/// Status PaymentSession lifecycle.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum SessionStatus {
    Pending,
    Settled,
    Expired,
    Refunded,
}

#[account]
#[derive(InitSpace)]
pub struct Merchant {
    /// Owner wallet (signer at init).
    pub owner: Pubkey,
    /// USDC ATA milik merchant — destinasi share utama.
    pub merchant_usdc_ata: Pubkey,
    /// Platform/organisasi USDC ATA — destinasi platform fee.
    pub platform_usdc_ata: Pubkey,
    /// Platform fee dalam basis points (e.g. 1000 = 10%). Range 0..=10_000.
    pub platform_fee_bps: u16,
    /// Bump untuk Merchant PDA.
    pub bump: u8,
}

impl Merchant {
    pub const SEED_PREFIX: &'static [u8] = b"merchant";
}

#[account]
#[derive(InitSpace)]
pub struct PaymentSession {
    /// Merchant yang punya session ini.
    pub merchant: Pubkey,
    /// 32-byte session id (random, di-generate off-chain saat NFC tap).
    pub session_id: [u8; 32],
    /// Total USDC yang di-charge (base unit, 6 decimals).
    pub amount_usdc: u64,
    /// Status lifecycle.
    pub status: SessionStatus,
    /// Source chain — `None` = native Solana payment, `Some(domain_id)` = CCTP cross-chain
    /// dari domain X. Untuk LayerZero, kita pakai EID + offset 100_000 supaya tidak collide
    /// dengan CCTP domain (CCTP domains < 100, LZ EIDs > 30_000).
    pub source_chain: Option<u32>,
    /// Unix timestamp expiry (detik).
    pub expires_at: i64,
    /// Bump untuk session PDA.
    pub bump: u8,
}

impl PaymentSession {
    pub const SEED_PREFIX: &'static [u8] = b"session";

    pub fn is_pending(&self) -> bool {
        self.status == SessionStatus::Pending
    }
}

/// Vault PDA seed — temporary holding ATA per session.
pub const VAULT_SEED_PREFIX: &[u8] = b"vault";

/// Mock implementasi `internal_execute_split`. Saat core-program merge, file ini akan diganti
/// dengan import `pulse_payment::core::internal_execute_split` yang real. Signature DIJAGA SAMA.
///
/// Behaviour mock:
/// - Transfer `amount_usdc * (10_000 - platform_fee_bps) / 10_000` ke `merchant_usdc_ata`
/// - Transfer sisanya ke `platform_usdc_ata`
/// - Source PDA = `program_usdc_vault`, signed dengan vault seeds
///
/// Returns (merchant_share, platform_share) untuk event emission.
pub fn internal_execute_split<'info>(
    merchant: &Account<'info, Merchant>,
    session: &Account<'info, PaymentSession>,
    program_usdc_vault: &Account<'info, TokenAccount>,
    vault_authority: &AccountInfo<'info>,
    merchant_usdc_ata: &Account<'info, TokenAccount>,
    platform_usdc_ata: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    vault_authority_bump: u8,
) -> Result<(u64, u64)> {
    let amount = session.amount_usdc;

    // Defensive math — Anchor 0.31 sudah enable overflow-checks via Cargo.toml release profile.
    let platform_share: u64 = (amount as u128)
        .checked_mul(merchant.platform_fee_bps as u128)
        .and_then(|v| v.checked_div(10_000))
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(CrossChainError::VaultBalanceInsufficient)?;
    let merchant_share = amount
        .checked_sub(platform_share)
        .ok_or(CrossChainError::VaultBalanceInsufficient)?;

    require_keys_eq!(
        program_usdc_vault.owner,
        vault_authority.key(),
        CrossChainError::InvalidVaultAuthority
    );
    require!(
        program_usdc_vault.amount >= amount,
        CrossChainError::VaultBalanceInsufficient
    );
    require_keys_eq!(
        merchant_usdc_ata.key(),
        merchant.merchant_usdc_ata,
        CrossChainError::InvalidVaultAuthority
    );
    require_keys_eq!(
        platform_usdc_ata.key(),
        merchant.platform_usdc_ata,
        CrossChainError::InvalidVaultAuthority
    );

    let session_key = session.key();
    let seeds: &[&[u8]] = &[
        VAULT_SEED_PREFIX,
        session_key.as_ref(),
        &[vault_authority_bump],
    ];
    let signer_seeds = &[seeds];

    // Leg 1: vault → merchant
    if merchant_share > 0 {
        let cpi_accounts = Transfer {
            from: program_usdc_vault.to_account_info(),
            to: merchant_usdc_ata.to_account_info(),
            authority: vault_authority.clone(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, merchant_share)?;
    }

    // Leg 2: vault → platform
    if platform_share > 0 {
        let cpi_accounts = Transfer {
            from: program_usdc_vault.to_account_info(),
            to: platform_usdc_ata.to_account_info(),
            authority: vault_authority.clone(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, platform_share)?;
    }

    Ok((merchant_share, platform_share))
}
