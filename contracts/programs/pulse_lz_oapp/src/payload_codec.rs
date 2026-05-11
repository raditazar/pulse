//! `PulseLzPayload` codec — fixed 64-byte BE layout. EVM side encode dengan `abi.encodePacked`
//! atau `bytes.concat` mirror-style.
//!
//! Layout:
//! | offset | size | field         |
//! |--------|------|---------------|
//! | 0      | 32   | session_id    |
//! | 32     | 8    | amount (u64)  |
//! | 40     | 20   | payer (EVM)   |
//! | 60     | 4    | source_eid    |

use anchor_lang::prelude::*;

use crate::errors::LzError;

pub const PULSE_LZ_PAYLOAD_LEN: usize = 64;

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize)]
pub struct PulseLzPayload {
    pub session_id: [u8; 32],
    pub amount: u64,
    pub payer: [u8; 20],
    pub source_eid: u32,
}

impl PulseLzPayload {
    pub fn decode(buf: &[u8]) -> Result<Self> {
        require!(buf.len() == PULSE_LZ_PAYLOAD_LEN, LzError::PayloadInvalidLength);

        let mut session_id = [0u8; 32];
        session_id.copy_from_slice(&buf[0..32]);

        let amount = u64::from_be_bytes(
            buf[32..40].try_into().map_err(|_| error!(LzError::PayloadInvalidLength))?,
        );

        let mut payer = [0u8; 20];
        payer.copy_from_slice(&buf[40..60]);

        let source_eid = u32::from_be_bytes(
            buf[60..64].try_into().map_err(|_| error!(LzError::PayloadInvalidLength))?,
        );

        Ok(Self { session_id, amount, payer, source_eid })
    }

    pub fn encode(&self) -> [u8; PULSE_LZ_PAYLOAD_LEN] {
        let mut buf = [0u8; PULSE_LZ_PAYLOAD_LEN];
        buf[0..32].copy_from_slice(&self.session_id);
        buf[32..40].copy_from_slice(&self.amount.to_be_bytes());
        buf[40..60].copy_from_slice(&self.payer);
        buf[60..64].copy_from_slice(&self.source_eid.to_be_bytes());
        buf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let p = PulseLzPayload {
            session_id: [0x55; 32],
            amount: 9_999_999,
            payer: [0xCD; 20],
            source_eid: 40_245,
        };
        let bytes = p.encode();
        assert_eq!(bytes.len(), PULSE_LZ_PAYLOAD_LEN);
        let decoded = PulseLzPayload::decode(&bytes).unwrap();
        assert_eq!(decoded.session_id, p.session_id);
        assert_eq!(decoded.amount, p.amount);
        assert_eq!(decoded.payer, p.payer);
        assert_eq!(decoded.source_eid, p.source_eid);
    }

    #[test]
    fn rejects_wrong_size() {
        assert!(PulseLzPayload::decode(&[0u8; 63]).is_err());
        assert!(PulseLzPayload::decode(&[0u8; 65]).is_err());
    }
}
