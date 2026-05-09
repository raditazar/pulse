use anchor_lang::prelude::*;

/// Pulse cross-chain error codes — range 6100-6199 (per task division dengan core-program owner).
#[error_code]
pub enum CrossChainError {
    #[msg("Hook data length invalid (expected 88 bytes: session_id 32 + source_domain 4 + sender 20 + amount 8 + nonce 24)")]
    InvalidHookDataLength = 6100,

    #[msg("Hook data session_id does not match provided PaymentSession PDA")]
    HookSessionMismatch = 6101,

    #[msg("Hook data source_domain not in allowlist (Sepolia/Base Sepolia/Arbitrum Sepolia/Avalanche Fuji)")]
    UnsupportedSourceDomain = 6102,

    #[msg("USDC vault balance below session.amount_usdc — message tidak ter-mint atau salah recipient")]
    VaultBalanceInsufficient = 6103,

    #[msg("PaymentSession sudah tidak Pending — kemungkinan replay")]
    SessionNotPending = 6104,

    #[msg("PaymentSession sudah expired berdasarkan unix timestamp on-chain")]
    SessionExpired = 6105,

    #[msg("Vault account bukan ATA yang dimiliki vault_authority PDA")]
    InvalidVaultAuthority = 6106,

    #[msg("Vault token mint bukan USDC devnet yang diharapkan")]
    InvalidVaultMint = 6107,

    #[msg("CCTP message_transmitter_v2 used_nonce account tidak owned by program resmi")]
    InvalidCctpAttestation = 6108,

    #[msg("Cluster runtime guard: instruksi cross-chain hanya boleh devnet, tapi terdeteksi mainnet")]
    MainnetForbidden = 6109,

    #[msg("LayerZero peer EID belum di-set untuk source chain ini")]
    LzPeerNotSet = 6110,

    #[msg("LayerZero payload gagal di-deserialize (Borsh)")]
    LzPayloadInvalid = 6111,
}
