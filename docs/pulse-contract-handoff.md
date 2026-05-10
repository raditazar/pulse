# Pulse Smart Contract Handoff

## Final program
- Program name: `pulse_payment`
- Devnet program id: `2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF`
- Upgrade authority wallet: `contracts/.keys/pulse-deploy.json`
- Deploy signature: `curomo4RytpQozBU52mC2XyoPnxMt2bb72jEvJeGwTZXGAGyKnZLyhan5sWDb679zwxoEqKfQhMN9FTWnrho4Vs`

## Canonical artifacts
- Anchor config: [contracts/Anchor.toml](/home/kurohitam/code/pulse/contracts/Anchor.toml)
- Program source: [contracts/programs/pulse_payment/src/lib.rs](/home/kurohitam/code/pulse/contracts/programs/pulse_payment/src/lib.rs)
- IDL JSON: [contracts/target/idl/pulse_payment.json](/home/kurohitam/code/pulse/contracts/target/idl/pulse_payment.json)
- TS type helper: [contracts/target/types/pulse_payment.ts](/home/kurohitam/code/pulse/contracts/target/types/pulse_payment.ts)

## PDA seeds
- `Merchant`
  - seeds: `["merchant", authority_pubkey]`
- `PaymentSession`
  - seeds: `["session", merchant_pda, session_id[32]]`
- Cross-chain vault authority
  - seeds: `["vault", session_pda]`

## State model
### Merchant
- `authority: Pubkey`
- `primary_beneficiary: Pubkey`
- `split_beneficiaries: Vec<SplitConfig>`
- `total_split_bps: u16`
- `metadata_uri: String`
- `is_active: bool`
- `bump: u8`

### SplitConfig
- `wallet: Pubkey`
- `bps: u16`
- `label: String`

### PaymentSession
- `merchant: Pubkey`
- `session_id: [u8; 32]`
- `amount_usdc: u64`
- `status: Pending | Paid | Expired | Refunded`
- `created_at: i64`
- `expires_at: i64`
- `paid_by: Option<Pubkey>`
- `source_chain: Option<u32>`
- `bump: u8`

## Instruction interface
### `initialize_merchant`
- Args
  - `primary_beneficiary: Pubkey`
  - `split_beneficiaries: Vec<SplitConfig>`
  - `metadata_uri: String`
- Accounts
  - `authority` signer, writable
  - `merchant` PDA, writable, init
  - `system_program`
- Notes
  - merchant starts with `is_active = true`
  - duplicate wallet across primary + split list is rejected
  - extra split beneficiaries max `4`
  - split list basis points may sum to `<= 10_000`; primary receives the remainder

### `update_merchant_split`
- Args
  - `primary_beneficiary: Pubkey`
  - `split_beneficiaries: Vec<SplitConfig>`
  - `metadata_uri: Option<String>`
- Accounts
  - `authority` signer
  - `merchant` PDA, writable
- Notes
  - only `merchant.authority` can call

### `deactivate_merchant`
- Args
  - none
- Accounts
  - `authority` signer
  - `merchant` PDA, writable
- Notes
  - only `merchant.authority` can call
  - after deactivation, `create_session` is blocked

### `create_session`
- Args
  - `session_id: [u8; 32]`
  - `amount_usdc: u64`
  - `expires_at: i64`
- Accounts
  - `authority` signer, writable
  - `merchant` PDA
  - `session` PDA, writable, init
  - `system_program`
- Notes
  - only `merchant.authority` can call
  - `amount_usdc` is base units, assuming `USDC-style 6 decimals`
  - `expires_at` must be in the future

### `close_session`
- Args
  - none
- Accounts
  - `authority` signer, writable
  - `merchant` PDA
  - `session` PDA, writable, closed to authority
- Notes
  - only `merchant.authority` can call
  - `Pending` session can only be closed if already expired; handler first marks it `Expired`

### `execute_split_payment`
- Args
  - none
- Accounts
  - `payer` signer, writable
  - `merchant` PDA
  - `session` PDA, writable
  - `payer_usdc_ata` writable
  - `usdc_mint`
  - `primary_beneficiary_ata` writable
  - `primary_beneficiary`
  - `token_program`
  - `associated_token_program`
  - `system_program`
- `remaining_accounts`
  - ordered list of beneficiary ATAs matching `merchant.split_beneficiaries`
  - order is strict: index `0` must correspond to `split_beneficiaries[0]`, dst
- Notes
  - `session.status` must still be `Pending`
  - current chain time must be `<= expires_at`
  - full `session.amount_usdc` is split in one instruction path
  - rounding remainder always goes to `primary_beneficiary`

## Session ID format
- canonical type on-chain: `[u8; 32]`
- backend/frontend should treat it as fixed 32-byte identifier
- recommended transport format:
  - hex string with exact 32-byte payload, or
  - raw byte array if using Anchor client directly

## Error handling clients should expect
- `InvalidSplitTotal`
- `TooManyBeneficiaries`
- `DuplicateBeneficiary`
- `MerchantInactive`
- `InvalidSessionAmount`
- `InvalidSessionExpiry`
- `MetadataUriTooLong`
- `SessionNotPending`
- `SessionExpired`
- `Unauthorized`
- `InvalidBeneficiaryAccountCount`
- `InvalidBeneficiaryAta`
- `SplitMathOverflow`
- `SourceBalanceInsufficient`

## Client integration notes
### Derive merchant PDA
- seeds: `["merchant", authority]`

### Derive session PDA
- seeds: `["session", merchant_pda, session_id]`

### Beneficiary ATA ordering
- primary beneficiary ATA is a named account
- extra beneficiaries are passed through `remaining_accounts`
- client must preserve exact array ordering from `merchant.split_beneficiaries`

### Source of truth
- on-chain state is canonical
- DB/indexer may cache events, but client logic should trust on-chain `Merchant` and `PaymentSession`

## Verified commands
```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd /home/kurohitam/code/pulse/contracts

anchor build
anchor test --provider.cluster localnet --provider.wallet ./.keys/pulse-deploy.json --skip-build
anchor deploy --provider.cluster devnet --provider.wallet ./.keys/pulse-deploy.json
```

## Residual note
- `anchor build` still emits one non-blocking warning from Anchor macro internals:
  - deprecated `AccountInfo::realloc`
- This is coming from macro-generated code path, not custom Pulse business logic.
