use anchor_lang::prelude::*;
use anchor_lang::solana_program::address_lookup_table::program::ID as ALT_PROGRAM_ID;
use oapp::endpoint::{instructions::RegisterOAppParams, ID as ENDPOINT_ID};

use crate::state::{LzReceiveTypesAccounts, Store};
use crate::{LZ_RECEIVE_TYPES_SEED, STORE_SEED};

#[derive(Accounts)]
#[instruction(params: InitStoreParams)]
pub struct InitStore<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = Store::SIZE,
        seeds = [STORE_SEED],
        bump
    )]
    pub store: Account<'info, Store>,
    #[account(
        init,
        payer = payer,
        space = LzReceiveTypesAccounts::SIZE,
        seeds = [LZ_RECEIVE_TYPES_SEED, &store.key().to_bytes()],
        bump
    )]
    pub lz_receive_types_accounts: Account<'info, LzReceiveTypesAccounts>,
    #[account(owner = ALT_PROGRAM_ID)]
    pub alt: Option<UncheckedAccount<'info>>,
    pub system_program: Program<'info, System>,
}

impl InitStore<'_> {
    pub fn apply(ctx: &mut Context<InitStore>, params: &InitStoreParams) -> Result<()> {
        ctx.accounts.store.admin = params.admin;
        ctx.accounts.store.bump = ctx.bumps.store;
        ctx.accounts.store.endpoint_program = params.endpoint;
        ctx.accounts.store.pulse_program = params.pulse_program;

        ctx.accounts.lz_receive_types_accounts.store = ctx.accounts.store.key();
        ctx.accounts.lz_receive_types_accounts.alt = ctx
            .accounts
            .alt
            .as_ref()
            .map(|a| a.key())
            .unwrap_or_default();
        ctx.accounts.lz_receive_types_accounts.bump = ctx.bumps.lz_receive_types_accounts;

        let register_params = RegisterOAppParams {
            delegate: ctx.accounts.store.admin,
        };
        let seeds: &[&[u8]] = &[STORE_SEED, &[ctx.accounts.store.bump]];
        oapp::endpoint_cpi::register_oapp(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            seeds,
            register_params,
        )?;

        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitStoreParams {
    pub admin: Pubkey,
    pub endpoint: Pubkey,
    pub pulse_program: Pubkey,
}
