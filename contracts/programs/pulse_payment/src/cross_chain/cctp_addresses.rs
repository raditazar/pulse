//! CCTP V2 Solana program IDs + USDC mint constants.
//!
//! ⚠️ PER 2026-05-09: Circle deploy CCTP V2 dengan **program ID yang sama** di mainnet & devnet
//! (lihat `/tmp/cctp-ref/programs/v2/Anchor.toml` baris `[programs.localnet]` dan `[programs.devnet]`).
//! Yang membedakan keduanya hanya state account (registry, RemoteTokenMessenger, TokenPair, dll.)
//! yang punya konfigurasi domain berbeda. Karena itu konstanta program ID di sini single-set,
//! tapi USDC mint dan domain ID yang dipakai TETAP wajib di-guard ke devnet di config.ts.

use anchor_lang::prelude::*;

/// Circle CCTP V2 — MessageTransmitterV2 program.
/// Source: <https://github.com/circlefin/solana-cctp-contracts/blob/main/programs/v2/Anchor.toml>
pub mod message_transmitter_v2 {
    use super::*;
    declare_id!("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC");
}

/// Circle CCTP V2 — TokenMessengerMinterV2 program.
pub mod token_messenger_minter_v2 {
    use super::*;
    declare_id!("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
}

/// USDC mint pada Solana Devnet.
/// Source: <https://faucet.circle.com> + Circle docs.
#[cfg(not(feature = "mainnet"))]
pub mod usdc_mint {
    use super::*;
    declare_id!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
}

/// USDC mint pada Solana Mainnet — SENGAJA tidak di-export di builds default.
/// Hanya tersedia kalau feature `mainnet` di-enable secara eksplisit (yang TIDAK
/// boleh terjadi di scope task cross-chain ini).
#[cfg(feature = "mainnet")]
pub mod usdc_mint {
    use super::*;
    declare_id!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

/// CCTP domain IDs (testnet ↔ mainnet sama).
pub mod domains {
    pub const SOLANA: u32 = 5;
    pub const ETH_SEPOLIA: u32 = 0;
    pub const AVAX_FUJI: u32 = 1;
    pub const ARB_SEPOLIA: u32 = 3;
    pub const BASE_SEPOLIA: u32 = 6;

    /// Allowlist source domains yang diterima cctp_hook_handler. Solana sendiri
    /// (`SOLANA`) excluded — tidak ada use case Solana → Solana via CCTP.
    pub const ACCEPTED_SOURCE_DOMAINS: &[u32] =
        &[ETH_SEPOLIA, AVAX_FUJI, ARB_SEPOLIA, BASE_SEPOLIA];

    pub fn is_accepted(domain: u32) -> bool {
        ACCEPTED_SOURCE_DOMAINS.contains(&domain)
    }
}
