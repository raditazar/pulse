use anchor_lang::prelude::*;

/// Emit di akhir `lz_receive` ketika PaymentIntent dari EVM berhasil di-decode.
/// Trusted relayer Pulse (signer di `pulse_payment::PulseConfig.trusted_relayer`) subscribe
/// event ini dan memanggil `pulse_payment.execute_trusted_split` untuk settle session.
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
