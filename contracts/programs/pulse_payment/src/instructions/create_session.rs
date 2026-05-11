use anchor_lang::prelude::*;

use crate::errors::CoreError;
use crate::events::SessionCreated;
use crate::state::{Merchant, PaymentSession, SessionStatus};

#[derive(Accounts)]
#[instruction(session_id: [u8; 32])]
pub struct CreateSession<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [Merchant::SEED_PREFIX, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(
        init,
        payer = authority,
        space = 8 + PaymentSession::INIT_SPACE,
        seeds = [PaymentSession::SEED_PREFIX, merchant.key().as_ref(), &session_id],
        bump,
    )]
    pub session: Account<'info, PaymentSession>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSession>,
    session_id: [u8; 32],
    amount_usdc: u64,
    expires_at: i64,
) -> Result<()> {
    let merchant = &ctx.accounts.merchant;
    require!(merchant.is_active, CoreError::MerchantInactive);
    require!(amount_usdc > 0, CoreError::InvalidSessionAmount);

    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, CoreError::InvalidSessionExpiry);

    let session = &mut ctx.accounts.session;
    session.merchant = merchant.key();
    session.session_id = session_id;
    session.amount_usdc = amount_usdc;
    session.status = SessionStatus::Pending;
    session.created_at = now;
    session.expires_at = expires_at;
    session.paid_by = None;
    session.source_chain = None;
    session.bump = ctx.bumps.session;

    emit!(SessionCreated {
        session: session.key(),
        merchant: merchant.key(),
        amount_usdc,
        expires_at,
        timestamp: now,
    });

    Ok(())
}
