use anchor_lang::prelude::*;

#[error_code]
pub enum CoreError {
    #[msg("Total split basis points must equal 10000")]
    InvalidSplitTotal = 6000,

    #[msg("Too many split beneficiaries")]
    TooManyBeneficiaries = 6001,

    #[msg("Duplicate beneficiary wallet detected")]
    DuplicateBeneficiary = 6002,

    #[msg("Merchant is inactive")]
    MerchantInactive = 6003,

    #[msg("Payment amount must be greater than zero")]
    InvalidSessionAmount = 6004,

    #[msg("Session expiry must be in the future")]
    InvalidSessionExpiry = 6005,

    #[msg("Metadata URI is too long")]
    MetadataUriTooLong = 6006,

    #[msg("Session is not pending")]
    SessionNotPending = 6007,

    #[msg("Session already expired")]
    SessionExpired = 6008,

    #[msg("Unauthorized authority")]
    Unauthorized = 6009,

    #[msg("Beneficiary ATA count does not match merchant split config")]
    InvalidBeneficiaryAccountCount = 6010,

    #[msg("Beneficiary ATA is invalid or does not match expected owner/mint")]
    InvalidBeneficiaryAta = 6011,

    #[msg("Split math overflowed")]
    SplitMathOverflow = 6012,

    #[msg("Source token balance is insufficient")]
    SourceBalanceInsufficient = 6013,
}

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
