use anchor_lang::prelude::*;

/// Pulse LZ OApp error codes — range 6200-6299 (terpisah dari pulse_payment 6100-6199).
#[error_code]
pub enum LzError {
    #[msg("Payload size invalid (expected exactly 64 bytes)")]
    PayloadInvalidLength = 6200,

    #[msg("Payload source_eid tidak match dengan params.src_eid dari Endpoint")]
    PayloadEidMismatch = 6201,

    #[msg("Sender bytes32 tidak match dengan registered peer untuk EID ini")]
    PeerMismatch = 6202,

    #[msg("Source EID tidak ada di allowlist (Sepolia / Base Sepolia / Arbitrum Sepolia)")]
    UnsupportedEid = 6203,
}
