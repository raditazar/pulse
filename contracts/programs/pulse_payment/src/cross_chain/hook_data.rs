//! Pulse CCTP hook data layout.
//!
//! Encoding (88 bytes total, big-endian seperti EVM ABI raw bytes):
//!
//! | offset | size | field          | catatan                                          |
//! |--------|------|----------------|--------------------------------------------------|
//! | 0      | 32   | session_id     | random 32-byte id dari PaymentSession            |
//! | 32     | 4    | source_domain  | CCTP domain id (u32 BE)                          |
//! | 36     | 20   | original_sender| EVM address user (untuk display + analytics)     |
//! | 56     | 8    | amount         | u64 BE — sanity check vs vault.amount_usdc       |
//! | 64     | 24   | nonce          | u192 BE — anti-replay tag, tidak diverifikasi    |
//! |        |      |                |   on-chain (cukup untuk audit/log)               |
//!
//! Encoder TypeScript counterpart: `packages/solana/src/cctp/encode-hook.ts`

use crate::errors::CrossChainError;
use anchor_lang::prelude::*;

pub const HOOK_DATA_LEN: usize = 88;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PulseHookData {
    pub session_id: [u8; 32],
    pub source_domain: u32,
    pub original_sender: [u8; 20],
    pub amount: u64,
    pub nonce_tag: [u8; 24],
}

impl PulseHookData {
    pub fn try_from_slice(raw: &[u8]) -> Result<Self> {
        require_eq!(
            raw.len(),
            HOOK_DATA_LEN,
            CrossChainError::InvalidHookDataLength
        );

        let mut session_id = [0u8; 32];
        session_id.copy_from_slice(&raw[0..32]);

        let mut domain_buf = [0u8; 4];
        domain_buf.copy_from_slice(&raw[32..36]);
        let source_domain = u32::from_be_bytes(domain_buf);

        let mut original_sender = [0u8; 20];
        original_sender.copy_from_slice(&raw[36..56]);

        let mut amount_buf = [0u8; 8];
        amount_buf.copy_from_slice(&raw[56..64]);
        let amount = u64::from_be_bytes(amount_buf);

        let mut nonce_tag = [0u8; 24];
        nonce_tag.copy_from_slice(&raw[64..88]);

        Ok(Self {
            session_id,
            source_domain,
            original_sender,
            amount,
            nonce_tag,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_decode_known_payload() {
        let mut raw = [0u8; HOOK_DATA_LEN];
        raw[0..32].copy_from_slice(&[7u8; 32]);
        raw[32..36].copy_from_slice(&6u32.to_be_bytes()); // base sepolia
        raw[36..56].copy_from_slice(&[0xab; 20]);
        raw[56..64].copy_from_slice(&1_000_000u64.to_be_bytes());
        raw[64..88].copy_from_slice(&[0xfe; 24]);

        let h = PulseHookData::try_from_slice(&raw).unwrap();
        assert_eq!(h.session_id, [7u8; 32]);
        assert_eq!(h.source_domain, 6);
        assert_eq!(h.amount, 1_000_000);
    }

    #[test]
    fn rejects_bad_length() {
        let raw = vec![0u8; 87];
        assert!(PulseHookData::try_from_slice(&raw).is_err());
    }
}
