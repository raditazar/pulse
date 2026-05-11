use anchor_lang::prelude::*;

use crate::errors::CoreError;
use crate::events::MerchantInitialized;
use crate::state::{validate_split_config, Merchant, SplitConfig};

#[derive(Accounts)]
pub struct InitializeMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Merchant::INIT_SPACE,
        seeds = [Merchant::SEED_PREFIX, authority.key().as_ref()],
        bump,
    )]
    pub merchant: Account<'info, Merchant>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeMerchant>,
    primary_beneficiary: Pubkey,
    split_beneficiaries: Vec<SplitConfig>,
    metadata_uri: String,
) -> Result<()> {
    let total_split_bps = validate_split_config(primary_beneficiary, &split_beneficiaries)?;
    require!(metadata_uri.len() <= 200, CoreError::MetadataUriTooLong);

    let merchant = &mut ctx.accounts.merchant;
    merchant.authority = ctx.accounts.authority.key();
    merchant.primary_beneficiary = primary_beneficiary;
    merchant.split_beneficiaries = split_beneficiaries;
    merchant.total_split_bps = total_split_bps;
    merchant.metadata_uri = metadata_uri;
    merchant.is_active = true;
    merchant.bump = ctx.bumps.merchant;

    emit!(MerchantInitialized {
        merchant: merchant.key(),
        authority: merchant.authority,
        primary_beneficiary,
        total_split_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
