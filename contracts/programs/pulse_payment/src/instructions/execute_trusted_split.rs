//! `execute_trusted_split` — entry point untuk trusted off-chain relayer.
//!
//! ## Konteks
//!
//! Pulse cross-chain flow (LayerZero V2 + trusted relayer):
//!   1. User di EVM (Base Sepolia / Arb Sepolia) call `PulseSender.pay(sessionId, amount)`.
//!   2. `PulseSender` transfer mock USDC dari user, encode `PulseLzPayload` (64 bytes),
//!      `_lzSend` ke Solana peer (`pulse_lz_oapp`).
//!   3. LZ Executor relay → `pulse_lz_oapp.lz_receive` decode payload, emit
//!      `LzPaymentIntentReceived` event. **Tidak ada token movement di sini.**
//!   4. Off-chain relayer (signer = `PulseConfig.trusted_relayer`) baca event,
//!      panggil instruction ini dengan USDC dari treasury ATA milik relayer.
//!   5. Instruction validasi merchant + session + amount, lalu pakai `internal_execute_split`
//!      dengan relayer ATA sebagai sumber dana (signer = relayer wallet, bukan PDA).
//!
//! ## Mengapa relayer pegang treasury, bukan vault PDA?
//!
//! Mock USDC di EVM tidak benar-benar dibridge ke Solana — ini "trusted layer" yang
//! menjembatani intent (EVM-burn) dengan settlement on-Solana. Relayer treasury pre-funded
//! dengan devnet USDC; rekonsiliasi off-chain (akumulasi mock USDC di kontrak EVM)
//! menjadi tanggung jawab operator Pulse.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::{CoreError, CrossChainError};
use crate::events::TrustedSplitExecuted;
use crate::state::{
    self, Merchant, PaymentSession, PulseConfig, SessionStatus, ACCEPTED_SOURCE_EIDS,
};

#[derive(Accounts)]
pub struct ExecuteTrustedSplit<'info> {
    /// Trusted relayer — harus match `config.trusted_relayer`. Bayar tx fee + ATA rent
    /// jika `primary_beneficiary_ata` belum ada.
    #[account(mut)]
    pub relayer: Signer<'info>,

    /// Global PulseConfig PDA — di-validate via seed.
    #[account(
        seeds = [PulseConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = config.trusted_relayer == relayer.key() @ CrossChainError::UnauthorizedRelayer,
    )]
    pub config: Account<'info, PulseConfig>,

    #[account(
        seeds = [Merchant::SEED_PREFIX, merchant.authority.as_ref()],
        bump = merchant.bump,
    )]
    pub merchant: Account<'info, Merchant>,

    #[account(
        mut,
        seeds = [
            PaymentSession::SEED_PREFIX,
            merchant.key().as_ref(),
            &session.session_id,
        ],
        bump = session.bump,
        constraint = session.merchant == merchant.key() @ CoreError::Unauthorized,
    )]
    pub session: Account<'info, PaymentSession>,

    /// USDC mint (devnet) — di-pin ke mint primary beneficiary ATA.
    #[account(address = primary_beneficiary_ata.mint)]
    pub usdc_mint: Account<'info, Mint>,

    /// Source-of-funds: ATA milik relayer.
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = relayer,
    )]
    pub relayer_usdc_ata: Account<'info, TokenAccount>,

    /// Destination primary — idempotent create-if-needed.
    #[account(
        init_if_needed,
        payer = relayer,
        associated_token::mint = usdc_mint,
        associated_token::authority = primary_beneficiary,
    )]
    pub primary_beneficiary_ata: Account<'info, TokenAccount>,

    /// CHECK: di-validate via `merchant.primary_beneficiary` address constraint.
    #[account(address = merchant.primary_beneficiary)]
    pub primary_beneficiary: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, ExecuteTrustedSplit<'info>>,
    source_eid: u32,
    source_payer: [u8; 20],
    amount_usdc: u64,
) -> Result<()> {
    // --- 1. Merchant + session lifecycle guard ---
    require!(ctx.accounts.merchant.is_active, CoreError::MerchantInactive);
    require!(ctx.accounts.session.is_pending(), CoreError::SessionNotPending);

    let now = Clock::get()?.unix_timestamp;
    require!(now <= ctx.accounts.session.expires_at, CoreError::SessionExpired);

    // --- 2. Source EID allowlist ---
    require!(
        ACCEPTED_SOURCE_EIDS.contains(&source_eid),
        CrossChainError::UnsupportedSourceEid
    );

    // --- 3. Amount sanity vs session ---
    require!(
        amount_usdc == ctx.accounts.session.amount_usdc,
        CrossChainError::AmountMismatch
    );

    // --- 4. Relayer ATA mint sanity ---
    require_keys_eq!(
        ctx.accounts.relayer_usdc_ata.mint,
        ctx.accounts.usdc_mint.key(),
        CrossChainError::RelayerMintMismatch
    );
    require!(
        ctx.accounts.relayer_usdc_ata.amount >= amount_usdc,
        CrossChainError::RelayerBalanceInsufficient
    );

    // --- 5. ATA address sanity (primary + secondary) ---
    let expected_primary_ata = associated_token::get_associated_token_address(
        &ctx.accounts.primary_beneficiary.key(),
        &ctx.accounts.usdc_mint.key(),
    );
    require_keys_eq!(
        ctx.accounts.primary_beneficiary_ata.key(),
        expected_primary_ata,
        CoreError::InvalidBeneficiaryAta
    );

    require!(
        ctx.remaining_accounts.len() == ctx.accounts.merchant.split_beneficiaries.len(),
        CoreError::InvalidBeneficiaryAccountCount
    );
    for (idx, split) in ctx.accounts.merchant.split_beneficiaries.iter().enumerate() {
        let ata_info = &ctx.remaining_accounts[idx];
        let expected = associated_token::get_associated_token_address(
            &split.wallet,
            &ctx.accounts.usdc_mint.key(),
        );
        require_keys_eq!(ata_info.key(), expected, CoreError::InvalidBeneficiaryAta);
    }

    // --- 6. Execute split — source authority = relayer signer ---
    let shares = state::internal_execute_split(
        &ctx.accounts.merchant,
        &ctx.accounts.session,
        &ctx.accounts.relayer_usdc_ata,
        &ctx.accounts.relayer.to_account_info(),
        &ctx.accounts.primary_beneficiary_ata,
        ctx.remaining_accounts,
        &ctx.accounts.token_program,
        None,
    )?;
    let primary_share = shares.first().copied().unwrap_or(0);
    let secondary_share = shares.iter().skip(1).sum::<u64>();

    // --- 7. Settle session ---
    let session = &mut ctx.accounts.session;
    session.status = SessionStatus::Paid;
    session.source_chain = Some(source_eid);
    session.paid_by = None;

    // --- 8. Event ---
    emit!(TrustedSplitExecuted {
        session: session.key(),
        merchant: ctx.accounts.merchant.key(),
        relayer: ctx.accounts.relayer.key(),
        source_eid,
        source_payer,
        amount_usdc,
        primary_share,
        secondary_share,
        timestamp: now,
    });

    Ok(())
}
