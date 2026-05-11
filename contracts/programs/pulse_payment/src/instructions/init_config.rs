use anchor_lang::prelude::*;

use crate::events::PulseConfigInitialized;
use crate::state::PulseConfig;

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + PulseConfig::INIT_SPACE,
        seeds = [PulseConfig::SEED_PREFIX],
        bump,
    )]
    pub config: Account<'info, PulseConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitConfig>, trusted_relayer: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.trusted_relayer = trusted_relayer;
    config.bump = ctx.bumps.config;

    emit!(PulseConfigInitialized {
        config: config.key(),
        admin: config.admin,
        trusted_relayer: config.trusted_relayer,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
