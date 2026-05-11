use anchor_lang::prelude::*;
use oapp::{
    lz_receive_types_v2::{LzReceiveTypesV2Accounts, LZ_RECEIVE_TYPES_VERSION},
    LzReceiveParams, LZ_RECEIVE_TYPES_SEED as OAPP_LZ_RECEIVE_TYPES_SEED,
};

use crate::state::{LzReceiveTypesAccounts, Store};
use crate::STORE_SEED;

#[derive(Accounts)]
pub struct LzReceiveTypesInfo<'info> {
    #[account(seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(
        seeds = [OAPP_LZ_RECEIVE_TYPES_SEED, &store.key().to_bytes()],
        bump = lz_receive_types_accounts.bump
    )]
    pub lz_receive_types_accounts: Account<'info, LzReceiveTypesAccounts>,
}

impl LzReceiveTypesInfo<'_> {
    pub fn apply(
        ctx: &Context<LzReceiveTypesInfo>,
        _params: &LzReceiveParams,
    ) -> Result<(u8, LzReceiveTypesV2Accounts)> {
        let receive_types_account = &ctx.accounts.lz_receive_types_accounts;
        let required_accounts = if receive_types_account.alt == Pubkey::default() {
            vec![receive_types_account.store]
        } else {
            vec![receive_types_account.store, receive_types_account.alt]
        };
        Ok((
            LZ_RECEIVE_TYPES_VERSION,
            LzReceiveTypesV2Accounts { accounts: required_accounts },
        ))
    }
}
