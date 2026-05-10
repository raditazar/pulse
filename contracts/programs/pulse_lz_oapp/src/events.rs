use anchor_lang::prelude::*;

/// Emit di akhir `lz_receive` ketika PaymentIntent dari EVM berhasil di-decode.
/// Off-chain indexer Pulse subscribe event ini dan trigger pre-warm session di program
/// `pulse_payment` (atau show "incoming payment" di merchant dashboard).
#[event]
pub struct LzPaymentIntentReceived {
    pub session_id: [u8; 32],
    pub source_eid: u32,
    pub source_payer: [u8; 20],
    pub amount: u64,
    pub guid: [u8; 32],
    pub nonce: u64,
    pub timestamp: i64,
}
