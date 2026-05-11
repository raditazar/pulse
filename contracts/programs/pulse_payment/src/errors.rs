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

/// Trusted-relayer / cross-chain error codes — range 6100-6199.
///
/// Pulse cross-chain saat ini memakai model **trusted off-chain relayer**:
///   - EVM (Base/Arb Sepolia) → LayerZero V2 → Solana `pulse_lz_oapp` (emit event)
///   - Off-chain relayer (signer key di `PulseConfig.trusted_relayer`) baca event
///   - Relayer call `pulse_payment.execute_trusted_split` dgn USDC dari treasury-nya
///
/// CCTP dihapus dari scope karena memakai mock USDC sendiri di sisi EVM.
#[error_code]
pub enum CrossChainError {
    #[msg("Signer bukan trusted relayer yang terdaftar di PulseConfig")]
    UnauthorizedRelayer = 6100,

    #[msg("PulseConfig PDA belum di-initialize — admin perlu call init_config dulu")]
    ConfigNotInitialized = 6101,

    #[msg("Hanya admin PulseConfig yang dapat memperbarui trusted relayer")]
    UnauthorizedAdmin = 6102,

    #[msg("LayerZero source EID tidak masuk allowlist Pulse (40161/40231/40245)")]
    UnsupportedSourceEid = 6103,

    #[msg("Amount cross-chain tidak match dengan PaymentSession.amount_usdc")]
    AmountMismatch = 6104,

    #[msg("Relayer USDC ATA balance kurang dari amount yang akan didistribusikan")]
    RelayerBalanceInsufficient = 6105,

    #[msg("Relayer USDC ATA mint berbeda dengan USDC mint yang di-resolve dari beneficiary ATA")]
    RelayerMintMismatch = 6106,
}
