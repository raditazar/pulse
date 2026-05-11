use anchor_lang::prelude::*;

use crate::events::MerchantDeactivated;
use crate::state::Merchant;

#[derive(Accounts)]
pub struct DeactivateMerchant<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [Merchant::SEED_PREFIX, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
}

pub fn handler(ctx: Context<DeactivateMerchant>) -> Result<()> {
    let merchant = &mut ctx.accounts.merchant;
    merchant.is_active = false;

    emit!(MerchantDeactivated {
        merchant: merchant.key(),
        authority: merchant.authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
