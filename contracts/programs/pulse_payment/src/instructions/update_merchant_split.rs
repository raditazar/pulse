use anchor_lang::prelude::*;

use crate::errors::CoreError;
use crate::events::MerchantUpdated;
use crate::state::{validate_split_config, Merchant, SplitConfig};

#[derive(Accounts)]
pub struct UpdateMerchantSplit<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [Merchant::SEED_PREFIX, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
}

pub fn handler(
    ctx: Context<UpdateMerchantSplit>,
    primary_beneficiary: Pubkey,
    split_beneficiaries: Vec<SplitConfig>,
    metadata_uri: Option<String>,
) -> Result<()> {
    let total_split_bps = validate_split_config(primary_beneficiary, &split_beneficiaries)?;

    let merchant = &mut ctx.accounts.merchant;
    merchant.primary_beneficiary = primary_beneficiary;
    merchant.split_beneficiaries = split_beneficiaries;
    merchant.total_split_bps = total_split_bps;
    if let Some(uri) = metadata_uri {
        require!(uri.len() <= 200, CoreError::MetadataUriTooLong);
        merchant.metadata_uri = uri;
    }

    emit!(MerchantUpdated {
        merchant: merchant.key(),
        authority: merchant.authority,
        primary_beneficiary,
        total_split_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
