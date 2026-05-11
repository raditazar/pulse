use anchor_lang::prelude::*;

use crate::errors::CrossChainError;
use crate::events::TrustedRelayerUpdated;
use crate::state::PulseConfig;

#[derive(Accounts)]
pub struct SetTrustedRelayer<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [PulseConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = config.admin == admin.key() @ CrossChainError::UnauthorizedAdmin,
    )]
    pub config: Account<'info, PulseConfig>,
}

pub fn handler(ctx: Context<SetTrustedRelayer>, new_relayer: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let previous = config.trusted_relayer;
    config.trusted_relayer = new_relayer;

    emit!(TrustedRelayerUpdated {
        config: config.key(),
        admin: config.admin,
        previous_relayer: previous,
        new_relayer,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
