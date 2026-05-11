use anchor_lang::prelude::*;
use oapp::{
    endpoint::{cpi::accounts::Clear, instructions::ClearParams, ConstructCPIContext, ID as ENDPOINT_ID},
    LzReceiveParams,
};

use crate::errors::LzError;
use crate::events::LzPaymentIntentReceived;
use crate::payload_codec::PulseLzPayload;
use crate::state::{PeerConfig, Store};
use crate::{PEER_SEED, STORE_SEED};

#[derive(Accounts)]
#[instruction(params: LzReceiveParams)]
pub struct LzReceive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(
        seeds = [PEER_SEED, &store.key().to_bytes(), &params.src_eid.to_be_bytes()],
        bump = peer.bump,
        constraint = params.sender == peer.peer_address @ LzError::PeerMismatch
    )]
    pub peer: Account<'info, PeerConfig>,
}

impl LzReceive<'_> {
    pub fn apply(ctx: &mut Context<LzReceive>, params: &LzReceiveParams) -> Result<()> {
        // 1. Endpoint::clear CPI — anti-replay.
        let store_seeds: &[&[u8]] = &[STORE_SEED, &[ctx.accounts.store.bump]];
        let accounts_for_clear = &ctx.remaining_accounts[0..Clear::MIN_ACCOUNTS_LEN];
        oapp::endpoint_cpi::clear(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            accounts_for_clear,
            store_seeds,
            ClearParams {
                receiver: ctx.accounts.store.key(),
                src_eid: params.src_eid,
                sender: params.sender,
                nonce: params.nonce,
                guid: params.guid,
                message: params.message.clone(),
            },
        )?;

        // 2. Decode + validate payload.
        let payload = PulseLzPayload::decode(&params.message)?;
        require!(payload.source_eid == params.src_eid, LzError::PayloadEidMismatch);

        // 3. Allowlist source EID — testnet only:
        //   40161 = Sepolia, 40231 = Arbitrum Sepolia, 40245 = Base Sepolia, 40168 = Solana Devnet (loopback test)
        let allowed = matches!(payload.source_eid, 40161 | 40231 | 40245 | 40168);
        require!(allowed, LzError::UnsupportedEid);

        // 4. Emit event — off-chain relayer Pulse pre-warm session di pulse_payment.
        let now = Clock::get()?.unix_timestamp;
        emit!(LzPaymentIntentReceived {
            session_id: payload.session_id,
            source_eid: payload.source_eid,
            source_payer: payload.payer,
            amount: payload.amount,
            guid: params.guid,
            nonce: params.nonce,
            timestamp: now,
        });

        Ok(())
    }
}
