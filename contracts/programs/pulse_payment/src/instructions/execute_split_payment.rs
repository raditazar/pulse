use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::CoreError;
use crate::events::PaymentExecuted;
use crate::state::{internal_execute_split, Merchant, PaymentSession, SessionStatus};

#[derive(Accounts)]
pub struct ExecuteSplitPayment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [Merchant::SEED_PREFIX, merchant.authority.as_ref()],
        bump = merchant.bump,
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(
        mut,
        seeds = [PaymentSession::SEED_PREFIX, merchant.key().as_ref(), &session.session_id],
        bump = session.bump,
        constraint = session.merchant == merchant.key() @ CoreError::Unauthorized,
    )]
    pub session: Account<'info, PaymentSession>,
    #[account(mut)]
    pub payer_usdc_ata: Account<'info, TokenAccount>,
    #[account(
        address = payer_usdc_ata.mint
    )]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = primary_beneficiary,
    )]
    pub primary_beneficiary_ata: Account<'info, TokenAccount>,
    /// CHECK: authority validation by Merchant state + ATA derivation above.
    #[account(address = merchant.primary_beneficiary)]
    pub primary_beneficiary: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, ExecuteSplitPayment<'info>>,
) -> Result<()> {
    require!(ctx.accounts.merchant.is_active, CoreError::MerchantInactive);
    require!(ctx.accounts.session.is_pending(), CoreError::SessionNotPending);

    let now = Clock::get()?.unix_timestamp;
    require!(now <= ctx.accounts.session.expires_at, CoreError::SessionExpired);

    for (idx, split) in ctx.accounts.merchant.split_beneficiaries.iter().enumerate() {
        let ata_info = ctx
            .remaining_accounts
            .get(idx)
            .ok_or(CoreError::InvalidBeneficiaryAccountCount)?;
        let expected = associated_token::get_associated_token_address(&split.wallet, &ctx.accounts.usdc_mint.key());
        require_keys_eq!(ata_info.key(), expected, CoreError::InvalidBeneficiaryAta);
    }
    require!(
        ctx.remaining_accounts.len() == ctx.accounts.merchant.split_beneficiaries.len(),
        CoreError::InvalidBeneficiaryAccountCount
    );

    internal_execute_split(
        &ctx.accounts.merchant,
        &ctx.accounts.session,
        &ctx.accounts.payer_usdc_ata,
        &ctx.accounts.payer.to_account_info(),
        &ctx.accounts.primary_beneficiary_ata,
        ctx.remaining_accounts,
        &ctx.accounts.token_program,
        None,
    )?;

    let session = &mut ctx.accounts.session;
    session.status = SessionStatus::Paid;
    session.paid_by = Some(ctx.accounts.payer.key());
    session.source_chain = None;

    emit!(PaymentExecuted {
        session: session.key(),
        merchant: ctx.accounts.merchant.key(),
        paid_by: ctx.accounts.payer.key(),
        amount_usdc: session.amount_usdc,
        source_chain: None,
        timestamp: now,
    });

    Ok(())
}
