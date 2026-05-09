use anchor_lang::prelude::*;

/// Emit setelah cctp_hook_handler berhasil split USDC ke merchant + beneficiary.
#[event]
pub struct CrossChainPaymentExecuted {
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub source_domain: u32,
    pub source_sender: [u8; 20],
    pub amount_usdc: u64,
    pub merchant_share: u64,
    pub platform_share: u64,
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
