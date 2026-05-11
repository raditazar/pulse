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

/// Emit setelah relayer trusted berhasil meng-execute split USDC cross-chain.
/// Source funds: ATA treasury milik relayer (`PulseConfig.trusted_relayer`).
#[event]
pub struct TrustedSplitExecuted {
    pub session: Pubkey,
    pub merchant: Pubkey,
    pub relayer: Pubkey,
    pub source_eid: u32,
    pub source_payer: [u8; 20],
    pub amount_usdc: u64,
    pub primary_share: u64,
    pub secondary_share: u64,
    pub timestamp: i64,
}

#[event]
pub struct PulseConfigInitialized {
    pub config: Pubkey,
    pub admin: Pubkey,
    pub trusted_relayer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TrustedRelayerUpdated {
    pub config: Pubkey,
    pub admin: Pubkey,
    pub previous_relayer: Pubkey,
    pub new_relayer: Pubkey,
    pub timestamp: i64,
}
