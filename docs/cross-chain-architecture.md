# Pulse Cross-Chain Architecture (LayerZero V2 + Trusted Relayer)

Dokumen ini menjelaskan flow cross-chain Pulse setelah pivot dari CCTP ke LayerZero +
trusted relayer + mock USDC sendiri.

## Komponen

| Lapisan     | Komponen                          | Lokasi                                                                                  |
|-------------|-----------------------------------|-----------------------------------------------------------------------------------------|
| EVM         | `MockUSDC` (ERC20, 6 dec)         | `evm/src/MockUSDC.sol`                                                                  |
| EVM         | `PulseSender` (LZ V2 OApp Sender) | `evm/src/PulseSender.sol`                                                               |
| Bridge      | LayerZero V2 Endpoint + DVN       | (deployed by LayerZero)                                                                 |
| Solana      | `pulse_lz_oapp` (LZ V2 OApp recv) | `contracts/programs/pulse_lz_oapp`                                                      |
| Solana      | `pulse_payment` (settlement)      | `contracts/programs/pulse_payment`                                                      |
| Off-chain   | Trusted relayer                   | `apps/relayer`                                                                          |
| SDK         | `@pulse/solana` + `@pulse/evm`    | `packages/solana`, `packages/evm`                                                       |

## Flow end-to-end (Base/Arb Sepolia → Solana Devnet)

Relayer subscribe **dua sumber** payment intent: EVM event langsung (primary, ~8 detik) +
Solana LZ event (backup, aktif kalau LZ V2 wired). Settler dedup via in-flight lock +
on-chain status check.

```
┌─────────────────┐   ① approve+pay    ┌─────────────────┐
│ Mobile / Web    │ ─────────────────► │  PulseSender    │
│ user wallet     │                    │  (Base Sepolia) │
└─────────────────┘                    └────────┬────────┘
                                                │
                                ╔═══════════════╪═══════════════════════╗
                                ║               │                       ║
                                ║   ② _lzSend(payload 64B)              ║
                                ║   (path LZ V2 — opsional)             ║
                                ║               ▼                       ║
                                ║      ┌─────────────────┐              ║
                                ║      │ LZ V2 Endpoint  │              ║
                                ║      │ + DVN + Executor│              ║
                                ║      └────────┬────────┘              ║
                                ║               │ ③ deliver             ║
                                ║               ▼                       ║
                                ║      ┌─────────────────┐              ║
                                ║      │ pulse_lz_oapp   │              ║
                                ║      │ emit event      │              ║
                                ║      └────────┬────────┘              ║
                                ║               │ ④ Solana event        ║
                                ║               │                       ║
                                ║   ④' EVM event (PaymentIntentSent)    ║
                                ║       (path utama, langsung)          ║
                                ║               │                       ║
                                ║               ▼                       ║
                                ║      ┌─────────────────┐              ║
                                ║      │ apps/relayer    │              ║
                                ║      │ (EVM + Solana   │              ║
                                ║      │  listener)      │              ║
                                ║      └────────┬────────┘              ║
                                ║               │ ⑤ execute_trusted_split║
                                ║               ▼                       ║
                                ║      ┌─────────────────┐              ║
                                ║      │ pulse_payment   │              ║
                                ║      │ (treasury → split│             ║
                                ║      │  beneficiary)   │              ║
                                ║      └─────────────────┘              ║
                                ╚═══════════════════════════════════════╝
```

**Latency aktual (terukur 2026-05-11):** ~8 detik dari `pay()` mined → `session.status = Paid`.

### Detail per langkah

**①** User di chain EVM (Base Sepolia / Arb Sepolia) call:
```solidity
mockUsdc.approve(pulseSender, amount);
pulseSender.pay{ value: nativeFee }(40168, sessionId, amount, "");
```
- Mock USDC ditarik ke `PulseSender` (jadi treasury Pulse di sisi EVM).
- Tidak ada bridging actual — sekedar lock untuk audit & rekonsiliasi.

**②** `PulseSender._lzSend` encode 64-byte `PulseLzPayload`:
```
[0..32)   sessionId
[32..40)  amount     (u64 BE)
[40..60)  payer      (EVM address)
[60..64)  sourceEid  (u32 BE)
```
LZ Endpoint terima fee dalam ETH native, route ke DVN + Executor.

**③** LZ Executor panggil `pulse_lz_oapp.lz_receive` di Solana:
- Validasi peer (sender == `PeerConfig.peer_address`).
- `endpoint::clear` CPI (anti-replay).
- Decode payload, validate `source_eid` ∈ {40161, 40231, 40245, 40168}.
- Emit event `LzPaymentIntentReceived(session_id, source_eid, source_payer, amount, guid, nonce, ts)`.
- **Tidak menggerakkan token.**

**④** Off-chain `apps/relayer`:
- Polling logs program `pulse_lz_oapp` (`getSignaturesForAddress` + `getTransaction`).
- Match event discriminator `0x24f45eb04baa9720` (sha256("event:LzPaymentIntentReceived")[..8]).
- Decode payload, resolve PaymentSession PDA, fetch Merchant data.

**⑤** Relayer sign + send `pulse_payment.execute_trusted_split`:
- Signer = `relayer` (= `PulseConfig.trusted_relayer`).
- Sumber USDC = `relayer_usdc_ata` (treasury devnet USDC).
- Split USDC ke `primary_beneficiary_ata` + secondary `split_beneficiaries[*].ata` sesuai
  `Merchant.split_beneficiaries[i].bps`.
- Set `session.status = Paid`, `session.source_chain = Some(source_eid)`.
- Emit `TrustedSplitExecuted` event.

## Trust model

- **LayerZero** menjamin authenticity payload (sender authority, anti-replay via Endpoint
  nonce, DVN validation).
- **Trusted relayer** men-decouple cross-chain message dari settlement actual. Single
  signer authority bisa dirotasi via `pulse_payment.set_trusted_relayer` (admin-only).
- **`pulse_payment`** memvalidasi:
  - signer == `PulseConfig.trusted_relayer`
  - session ∈ Pending + tidak expired
  - amount match `session.amount_usdc`
  - source EID ∈ allowlist (`{40161, 40231, 40245}`)
  - semua ATA beneficiary cocok (via `get_associated_token_address`)

Compromise scope: kalau relayer key bocor, attacker masih dibatasi oleh constraints di
atas — mereka tidak bisa mengubah split, hanya bisa settle session yang valid sesuai
payment intent yang sudah ter-deliver.

## Address map (devnet)

| Komponen                       | Address / ID                                                                  |
|--------------------------------|-------------------------------------------------------------------------------|
| `pulse_payment` program        | `2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF`                                |
| `pulse_lz_oapp` program        | `AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8`                                |
| USDC devnet mint (Circle)      | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`                                |
| LZ Endpoint Solana (EID 40168) | `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6`                                |
| LZ Endpoint EVM (Base/Arb Sep) | `0x6EDCE65403992e310A62460808c4b910D972f10f`                                  |
| MockUSDC Base Sepolia          | _TBD setelah deploy_                                                          |
| MockUSDC Arb Sepolia           | _TBD setelah deploy_                                                          |
| PulseSender Base Sepolia       | _TBD setelah deploy_                                                          |
| PulseSender Arb Sepolia        | _TBD setelah deploy_                                                          |

EIDs:
- Solana Devnet: `40168`
- Base Sepolia: `40245`
- Arbitrum Sepolia: `40231`
- Ethereum Sepolia: `40161` (allowed di Solana side, tapi belum ada sender deploy)

## Akun + instruction reference

### `pulse_payment`

- `init_config(trusted_relayer: Pubkey)` — admin one-shot, buat PulseConfig PDA.
- `set_trusted_relayer(new_relayer: Pubkey)` — admin-only update.
- `execute_trusted_split(source_eid: u32, source_payer: [u8;20], amount_usdc: u64)`
  - signer: relayer
  - accounts:
    1. relayer (signer, mut)
    2. config (PDA seed: `["pulse-config"]`)
    3. merchant (PDA seed: `["merchant", authority]`)
    4. session (PDA seed: `["session", merchant, session_id]`, mut)
    5. usdc_mint
    6. relayer_usdc_ata (mut)
    7. primary_beneficiary_ata (init_if_needed, mut)
    8. primary_beneficiary
    9. token_program
    10. associated_token_program
    11. system_program
    - remaining: split_beneficiary_atas (in `merchant.split_beneficiaries` order, all mut)

### `pulse_lz_oapp`

- `init_store`, `set_peer_config` — admin setup.
- `lz_receive(params: LzReceiveParams)` — public, called by LZ Executor.
- Event: `LzPaymentIntentReceived { session_id, source_eid, source_payer, amount, guid, nonce, timestamp }`.

### `PulseSender` (Solidity)

- `pay(uint32 dstEid, bytes32 sessionId, uint256 amount, bytes options) payable`
- `quotePay(...) view returns (MessagingFee)`
- Owner-only: `setPeer(uint32, bytes32)`, `setDefaultOptions(bytes)`, `withdrawUsdc`, `setDelegate`.

## Yang BUKAN dalam scope arsitektur ini

- ❌ CCTP (dihapus seluruhnya — termasuk modul Anchor `cross_chain/`, paket TS `cctp/`,
  IDL `message_transmitter_v2` & `token_messenger_minter_v2`).
- ❌ Real USDC bridge — Pulse pakai mock USDC + relayer treasury, bukan real settlement.
- ❌ Mainnet — runtime guard di `packages/solana/src/cross-chain/config.ts` lempar
  `MainnetGuardError` kalau `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet`.

## Roadmap pasca-hackathon

- Replace polling listener dengan websocket `onLogs` di relayer.
- Persistent dedup (Redis / Postgres) di relayer untuk handle restart cepat.
- HSM / KMS untuk relayer keypair.
- Audit pre-mainnet — `execute_trusted_split` constraints harus reviewed external.
- Pertimbangkan CCTP V2 sebagai opsional path Path 2 (no-trust, bridges actual USDC).
