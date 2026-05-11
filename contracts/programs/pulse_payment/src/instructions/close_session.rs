use anchor_lang::prelude::*;

use crate::errors::CoreError;
use crate::state::{Merchant, PaymentSession, SessionStatus};

#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [Merchant::SEED_PREFIX, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(
        mut,
        close = authority,
        seeds = [PaymentSession::SEED_PREFIX, merchant.key().as_ref(), &session.session_id],
        bump = session.bump,
        constraint = session.merchant == merchant.key() @ CoreError::Unauthorized,
    )]
    pub session: Account<'info, PaymentSession>,
}

pub fn handler(ctx: Context<CloseSession>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let session = &mut ctx.accounts.session;

    if session.status == SessionStatus::Pending {
        require!(now > session.expires_at, CoreError::SessionNotPending);
        session.status = SessionStatus::Expired;
    }

    Ok(())
}
