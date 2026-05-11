//! `cctp_hook_handler` — instruksi yang dipanggil SETELAH CCTP `receive_message` mint USDC
//! ke `program_usdc_vault` PDA. Tugasnya: validasi → split → settle session.
//!
//! ## Flow lengkap (Base Sepolia → Solana Devnet)
//!
//! 1. User di Base Sepolia call `TokenMessengerV2.depositForBurnWithHook(...)` dengan:
//!    - `amount = session.amount_usdc`
//!    - `destinationDomain = 5` (Solana)
//!    - `mintRecipient = program_usdc_vault PDA` (32-byte right-padded)
//!    - `burnToken = USDC@BaseSepolia`
//!    - `destinationCaller = 0x0` (anyone can complete)
//!    - `hookData = PulseHookData encoded (88 bytes)`
//! 2. Circle attestation service witness burn event.
//! 3. Off-chain relayer (atau user sendiri) fetch attestation dari Iris API,
//!    lalu submit `MessageTransmitterV2.receive_message(message, attestation)` di Solana.
//! 4. `receive_message` CPI ke TokenMessengerMinterV2 → mint USDC ke `program_usdc_vault`.
//! 5. Off-chain relayer call `pulse_payment.cctp_hook_handler(hook_data, vault_authority_bump)`
//!    dengan PaymentSession + Merchant + ATA accounts.
//! 6. Handler decode hook_data, validate session+vault, panggil `internal_execute_split`,
//!    set session.status = Paid, emit event.
//!
//! ## Mengapa SEPARATE instruction (bukan langsung CPI dari MessageTransmitter)?
//! Recipient di CCTP V2 receive_message untuk USDC transfer adalah `token_messenger_minter_v2`
//! (immutable). Untuk mendapat hook callback langsung, kita harus jadi recipient program — yang
//! berarti kita kehilangan auto-mint USDC. Design ini memilih: standar CCTP mint flow tetap
//! dipakai, hook diproses oleh instruction kita sendiri yang validasi via vault balance +
//! optional CCTP used_nonce account constraint.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::cross_chain::{cctp_addresses, hook_data::PulseHookData};
use crate::errors::CrossChainError;
use crate::events::CrossChainPaymentExecuted;
use crate::state::{
    self, Merchant, PaymentSession, SessionStatus, VAULT_SEED_PREFIX,
};

#[derive(Accounts)]
#[instruction(hook_data_raw: Vec<u8>, vault_authority_bump: u8)]
pub struct CctpHookHandler<'info> {
    /// Setiap orang boleh complete CCTP message — typically relayer/payer. Bayar TX fee + ATA rent.
    #[account(mut)]
    pub completer: Signer<'info>,

    /// Merchant PDA sumber-of-truth untuk beneficiary split config.
    #[account(
        seeds = [Merchant::SEED_PREFIX, merchant.authority.as_ref()],
        bump = merchant.bump,
    )]
    pub merchant: Account<'info, Merchant>,

    /// PaymentSession yang akan di-settle. Bumps + seeds harus match.
    #[account(
        mut,
        seeds = [
            PaymentSession::SEED_PREFIX,
            merchant.key().as_ref(),
            &session.session_id,
        ],
        bump = session.bump,
        constraint = session.merchant == merchant.key() @ CrossChainError::HookSessionMismatch,
    )]
    pub session: Account<'info, PaymentSession>,

    /// Authority PDA untuk vault — derive dari ["vault", session.key()] dengan bump dipasok.
    /// CHECK: PDA derivation diverifikasi via seeds; tidak punya data sendiri.
    #[account(
        seeds = [VAULT_SEED_PREFIX, session.key().as_ref()],
        bump = vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// USDC mint — dipin ke konstanta devnet. Saat feature `mainnet` di-enable, akan poin ke
    /// mainnet USDC; tapi feature itu sengaja TIDAK akan di-enable dalam scope task ini.
    #[account(address = cctp_addresses::usdc_mint::ID @ CrossChainError::InvalidVaultMint)]
    pub usdc_mint: Account<'info, Mint>,

    /// Vault USDC ATA — owned by vault_authority PDA. Sudah di-mint USDC oleh CCTP.
    /// `init_if_needed` aman di sini karena ATA address fully derived (associated_token convention).
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub program_usdc_vault: Account<'info, TokenAccount>,

    /// Primary beneficiary destination ATA. Pre-create idempotent via init_if_needed.
    #[account(
        init_if_needed,
        payer = completer,
        associated_token::mint = usdc_mint,
        associated_token::authority = primary_beneficiary,
    )]
    pub primary_beneficiary_ata: Account<'info, TokenAccount>,

    /// CHECK: primary beneficiary pubkey disimpan di Merchant state.
    #[account(address = merchant.primary_beneficiary)]
    pub primary_beneficiary: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, CctpHookHandler<'info>>,
    hook_data_raw: Vec<u8>,
    vault_authority_bump: u8,
) -> Result<()> {
    // --- 1. Decode + validate hook_data ---
    let hook = PulseHookData::try_from_slice(&hook_data_raw)?;
    require!(
        cctp_addresses::domains::is_accepted(hook.source_domain),
        CrossChainError::UnsupportedSourceDomain
    );

    // --- 2. session_id consistency: hook_data.session_id == session PDA's session_id ---
    let session = &mut ctx.accounts.session;
    require!(
        hook.session_id == session.session_id,
        CrossChainError::HookSessionMismatch
    );

    // --- 3. Anti-replay + expiry guard ---
    require!(session.is_pending(), CrossChainError::SessionNotPending);
    let now = Clock::get()?.unix_timestamp;
    require!(now <= session.expires_at, CrossChainError::SessionExpired);

    // --- 4. Vault balance check (re-checked di internal_execute_split, di sini explicit) ---
    require!(
        ctx.accounts.program_usdc_vault.amount >= session.amount_usdc,
        CrossChainError::VaultBalanceInsufficient
    );

    // --- 5. Primary beneficiary ATA address sanity ---
    let expected_merchant_ata = associated_token::get_associated_token_address(
        &ctx.accounts.primary_beneficiary.key(),
        &ctx.accounts.usdc_mint.key(),
    );
    require_keys_eq!(
        ctx.accounts.primary_beneficiary_ata.key(),
        expected_merchant_ata,
        CrossChainError::InvalidVaultAuthority
    );

    require!(
        ctx.remaining_accounts.len() == ctx.accounts.merchant.split_beneficiaries.len(),
        CrossChainError::InvalidVaultAuthority
    );

    for (idx, split) in ctx.accounts.merchant.split_beneficiaries.iter().enumerate() {
        let ata_info = &ctx.remaining_accounts[idx];
        let expected = associated_token::get_associated_token_address(
            &split.wallet,
            &ctx.accounts.usdc_mint.key(),
        );
        require_keys_eq!(ata_info.key(), expected, CrossChainError::InvalidVaultAuthority);
    }

    // --- 6. Execute split via shared helper ---
    let session_key = session.key();
    let vault_seeds: &[&[u8]] = &[
        VAULT_SEED_PREFIX,
        session_key.as_ref(),
        &[vault_authority_bump],
    ];
    let signer_seeds = &[vault_seeds];

    let shares = state::internal_execute_split(
        &ctx.accounts.merchant,
        session,
        &ctx.accounts.program_usdc_vault,
        &ctx.accounts.vault_authority.to_account_info(),
        &ctx.accounts.primary_beneficiary_ata,
        ctx.remaining_accounts,
        &ctx.accounts.token_program,
        Some(signer_seeds),
    )?;
    let primary_share = shares.first().copied().unwrap_or(0);
    let secondary_share = shares.get(1).copied().unwrap_or(0);

    // --- 7. Mark session as settled + record source_chain ---
    session.status = SessionStatus::Paid;
    session.source_chain = Some(hook.source_domain);
    session.paid_by = None;

    // --- 8. Emit event ---
    emit!(CrossChainPaymentExecuted {
        session: session.key(),
        merchant: ctx.accounts.merchant.key(),
        source_domain: hook.source_domain,
        source_sender: hook.original_sender,
        amount_usdc: session.amount_usdc,
        primary_share,
        secondary_share,
        timestamp: now,
    });

    Ok(())
}
