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
//!    set session.status = Settled, emit event.
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

    /// Merchant PDA — di-validate via has_one ke kedua ATA destinasi di mock.
    /// Untuk hackathon mock: kita tidak panggil has_one (karena Merchant baru sebatas mock).
    /// Saat core-program merge, ganti ke `Account<'info, pulse_payment::core::Merchant>` plus
    /// `has_one = merchant_usdc_ata` & `has_one = platform_usdc_ata`.
    #[account(
        seeds = [Merchant::SEED_PREFIX, merchant.owner.as_ref()],
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

    /// Merchant destination USDC ATA. Pre-create idempotent via init_if_needed.
    #[account(
        init_if_needed,
        payer = completer,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant_owner,
    )]
    pub merchant_usdc_ata: Account<'info, TokenAccount>,

    /// CHECK: hanya dipakai sebagai authority untuk merchant ATA derivation; identity-checked via merchant.owner.
    #[account(address = merchant.owner)]
    pub merchant_owner: UncheckedAccount<'info>,

    /// Platform USDC ATA — pre-existing (di-set saat init Merchant).
    #[account(
        mut,
        address = merchant.platform_usdc_ata @ CrossChainError::InvalidVaultAuthority,
    )]
    pub platform_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CctpHookHandler>,
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

    // --- 5. Merchant ATA address sanity ---
    let expected_merchant_ata = associated_token::get_associated_token_address(
        &ctx.accounts.merchant_owner.key(),
        &ctx.accounts.usdc_mint.key(),
    );
    require_keys_eq!(
        ctx.accounts.merchant_usdc_ata.key(),
        expected_merchant_ata,
        CrossChainError::InvalidVaultAuthority
    );

    // --- 6. Execute split via shared helper ---
    let (merchant_share, platform_share) = state::internal_execute_split(
        &ctx.accounts.merchant,
        session,
        &ctx.accounts.program_usdc_vault,
        &ctx.accounts.vault_authority.to_account_info(),
        &ctx.accounts.merchant_usdc_ata,
        &ctx.accounts.platform_usdc_ata,
        &ctx.accounts.token_program,
        vault_authority_bump,
    )?;

    // --- 7. Mark session as settled + record source_chain ---
    session.status = SessionStatus::Settled;
    session.source_chain = Some(hook.source_domain);

    // --- 8. Emit event ---
    emit!(CrossChainPaymentExecuted {
        session: session.key(),
        merchant: ctx.accounts.merchant.key(),
        source_domain: hook.source_domain,
        source_sender: hook.original_sender,
        amount_usdc: session.amount_usdc,
        merchant_share,
        platform_share,
        timestamp: now,
    });

    Ok(())
}
