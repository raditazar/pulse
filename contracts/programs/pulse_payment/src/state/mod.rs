use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::CoreError;

pub const MAX_SPLIT_BENEFICIARIES: usize = 4;
pub const MAX_SPLIT_LABEL_LEN: usize = 32;
pub const MAX_METADATA_URI_LEN: usize = 200;
pub const VAULT_SEED_PREFIX: &[u8] = b"vault";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace)]
pub struct SplitConfig {
    pub wallet: Pubkey,
    pub bps: u16,
    #[max_len(MAX_SPLIT_LABEL_LEN)]
    pub label: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum SessionStatus {
    Pending,
    Paid,
    Expired,
    Refunded,
}

#[account]
#[derive(InitSpace)]
pub struct Merchant {
    pub authority: Pubkey,
    pub primary_beneficiary: Pubkey,
    #[max_len(MAX_SPLIT_BENEFICIARIES)]
    pub split_beneficiaries: Vec<SplitConfig>,
    pub total_split_bps: u16,
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub is_active: bool,
    pub bump: u8,
}

impl Merchant {
    pub const SEED_PREFIX: &'static [u8] = b"merchant";

    pub fn total_recipients(&self) -> usize {
        1 + self.split_beneficiaries.len()
    }
}

#[account]
#[derive(InitSpace)]
pub struct PaymentSession {
    pub merchant: Pubkey,
    pub session_id: [u8; 32],
    pub amount_usdc: u64,
    pub status: SessionStatus,
    pub created_at: i64,
    pub expires_at: i64,
    pub paid_by: Option<Pubkey>,
    pub source_chain: Option<u32>,
    pub bump: u8,
}

impl PaymentSession {
    pub const SEED_PREFIX: &'static [u8] = b"session";

    pub fn is_pending(&self) -> bool {
        self.status == SessionStatus::Pending
    }
}

pub fn validate_split_config(
    primary_beneficiary: Pubkey,
    split_beneficiaries: &[SplitConfig],
) -> Result<u16> {
    require!(
        split_beneficiaries.len() <= MAX_SPLIT_BENEFICIARIES,
        CoreError::TooManyBeneficiaries
    );

    let mut wallets = Vec::with_capacity(1 + split_beneficiaries.len());
    wallets.push(primary_beneficiary);

    let mut total_bps: u32 = 0;
    for split in split_beneficiaries {
        require!(!wallets.contains(&split.wallet), CoreError::DuplicateBeneficiary);
        wallets.push(split.wallet);
        total_bps = total_bps
            .checked_add(split.bps as u32)
            .ok_or(CoreError::InvalidSplitTotal)?;
    }

    require!(total_bps <= 10_000, CoreError::InvalidSplitTotal);

    Ok(10_000)
}

pub fn internal_execute_split<'info>(
    merchant: &Account<'info, Merchant>,
    session: &Account<'info, PaymentSession>,
    source_token_account: &Account<'info, TokenAccount>,
    source_authority: &AccountInfo<'info>,
    primary_beneficiary_ata: &Account<'info, TokenAccount>,
    extra_beneficiary_atas: &'info [AccountInfo<'info>],
    token_program: &Program<'info, Token>,
    signer_seeds: Option<&[&[&[u8]]]> ,
) -> Result<Vec<u64>> {
    require!(
        extra_beneficiary_atas.len() == merchant.split_beneficiaries.len(),
        CoreError::InvalidBeneficiaryAccountCount
    );

    require_keys_eq!(
        primary_beneficiary_ata.owner,
        merchant.primary_beneficiary,
        CoreError::InvalidBeneficiaryAta
    );

    let amount = session.amount_usdc;
    require!(source_token_account.amount >= amount, CoreError::SourceBalanceInsufficient);

    let mut distributed: u64 = 0;
    let mut shares = Vec::with_capacity(merchant.total_recipients());

    for (idx, split) in merchant.split_beneficiaries.iter().enumerate() {
        let ata_info = &extra_beneficiary_atas[idx];
        let ata: Account<'info, TokenAccount> = Account::try_from(ata_info)?;
        require_keys_eq!(ata.owner, split.wallet, CoreError::InvalidBeneficiaryAta);
        require_keys_eq!(ata.mint, source_token_account.mint, CoreError::InvalidBeneficiaryAta);

        let share: u64 = (amount as u128)
            .checked_mul(split.bps as u128)
            .and_then(|v| v.checked_div(10_000))
            .and_then(|v| u64::try_from(v).ok())
            .ok_or(CoreError::SplitMathOverflow)?;

        if share > 0 {
            transfer_from_source(
                source_token_account,
                &ata.to_account_info(),
                source_authority,
                token_program,
                signer_seeds,
                share,
            )?;
        }

        distributed = distributed
            .checked_add(share)
            .ok_or(CoreError::SplitMathOverflow)?;
        shares.push(share);
    }

    let primary_share = amount
        .checked_sub(distributed)
        .ok_or(CoreError::SplitMathOverflow)?;

    require_keys_eq!(
        primary_beneficiary_ata.mint,
        source_token_account.mint,
        CoreError::InvalidBeneficiaryAta
    );
    if primary_share > 0 {
        transfer_from_source(
            source_token_account,
            &primary_beneficiary_ata.to_account_info(),
            source_authority,
            token_program,
            signer_seeds,
            primary_share,
        )?;
    }

    shares.insert(0, primary_share);
    Ok(shares)
}

fn transfer_from_source<'info>(
    source_token_account: &Account<'info, TokenAccount>,
    destination: &AccountInfo<'info>,
    source_authority: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    signer_seeds: Option<&[&[&[u8]]]> ,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: source_token_account.to_account_info(),
        to: destination.clone(),
        authority: source_authority.clone(),
    };

    let cpi_ctx = match signer_seeds {
        Some(seeds) => CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, seeds),
        None => CpiContext::new(token_program.to_account_info(), cpi_accounts),
    };
    token::transfer(cpi_ctx, amount)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_split_total_and_uniqueness() {
        let primary = Pubkey::new_unique();
        let splits = vec![
            SplitConfig {
                wallet: Pubkey::new_unique(),
                bps: 3_000,
                label: "platform".into(),
            },
            SplitConfig {
                wallet: Pubkey::new_unique(),
                bps: 7_000,
                label: "ops".into(),
            },
        ];
        assert_eq!(validate_split_config(primary, &splits).unwrap(), 10_000);
    }

    #[test]
    fn rejects_duplicate_wallets() {
        let dup = Pubkey::new_unique();
        let splits = vec![
            SplitConfig {
                wallet: dup,
                bps: 5_000,
                label: "a".into(),
            },
            SplitConfig {
                wallet: dup,
                bps: 5_000,
                label: "b".into(),
            },
        ];
        assert!(validate_split_config(Pubkey::new_unique(), &splits).is_err());
    }
}
