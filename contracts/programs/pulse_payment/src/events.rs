use anchor_lang::prelude::*;

#[event]
pub struct MerchantInitialized {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub primary_beneficiary: Pubkey,
    pub total_split_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct MerchantUpdated {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub primary_beneficiary: Pubkey,
    pub total_split_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct MerchantDeactivated {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SessionCreated {
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub amount_usdc: u64,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct PaymentExecuted {
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub paid_by: Pubkey,
    pub amount_usdc: u64,
    pub source_chain: Option<u32>,
    pub timestamp: i64,
}

/// Emit setelah cctp_hook_handler berhasil split USDC ke merchant + beneficiary.
#[event]
pub struct CrossChainPaymentExecuted {
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub source_domain: u32,
    pub source_sender: [u8; 20],
    pub amount_usdc: u64,
    pub primary_share: u64,
    pub secondary_share: u64,
    pub timestamp: i64,
}

/// Emit ketika LayerZero PaymentIntent diterima (Phase 2).
#[event]
pub struct LzPaymentIntentReceived {
    pub session: Pubkey,
    pub source_eid: u32,
    pub source_payer: [u8; 20],
    pub amount: u64,
    pub timestamp: i64,
}
