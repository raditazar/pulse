# @pulse/relayer

Off-chain trusted relayer Pulse cross-chain. Listen ke event PaymentIntent dari
**dua sumber** + settle di Solana via `pulse_payment.execute_trusted_split`.

## Arsitektur listener

```
┌──────────────────────┐
│ PulseSender (EVM)    │  PaymentIntentSent
│ - Base Sepolia       │ ─────────────┐
│ - Arb Sepolia        │              │
└──────────────────────┘              ▼
                                ┌───────────────┐    execute_trusted_split
                                │ TrustedSplitSettler │ ─────────────► pulse_payment
                                │ (dedup inflight  │       (Solana Devnet)
                                │  + session check)│
                                └───────────────┘
                                      ▲
┌──────────────────────┐              │
│ pulse_lz_oapp        │  LzPaymentIntentReceived (kalau LZ V2 wired)
│ (Solana Devnet)      │ ─────────────┘
└──────────────────────┘
```

**Primary path (EVM listener)** — polling `getLogs` per chain, latency 5-10 detik
setelah `pay()`. Tidak butuh LZ V2 wiring. Cukup untuk demo hackathon.

**Backup path (Solana LZ listener)** — aktif kalau `ENABLE_SOLANA_LZ_LISTENER=true`
dan LZ V2 receive config sudah live di Solana testnet. Settler dedup via in-memory
inflight lock + on-chain `session.status` check, jadi kalau kedua listener fire
untuk session yang sama, hanya yang pertama yang execute.

## Setup

```bash
cp .env.example .env
# edit address PulseSender + RPC

mkdir -p .keys
solana-keygen new --no-bip39-passphrase -o .keys/pulse-relayer.json
# Fund relayer SOL + USDC devnet:
solana airdrop 2 -k .keys/pulse-relayer.json --url devnet
# Top up USDC via Circle faucet (https://faucet.circle.com).

pnpm install
pnpm --filter @pulse/relayer dev
```

Pre-req: admin sudah call `pulse_payment.init_config(trusted_relayer)` dengan pubkey
relayer ini.

## Env reference

| Variable | Purpose |
|---|---|
| `RELAYER_KEYPAIR_PATH` | Path JSON keypair signer (= `PulseConfig.trusted_relayer`) |
| `SOLANA_RPC_URL` | Devnet RPC |
| `PULSE_PAYMENT_PROGRAM_ID` | Anchor program ID |
| `PULSE_LZ_OAPP_PROGRAM_ID` | OApp program ID |
| `USDC_MINT_DEVNET` | USDC mint devnet |
| `BASE_SEPOLIA_RPC_URL` | RPC EVM |
| `ARB_SEPOLIA_RPC_URL` | RPC EVM |
| `PULSE_SENDER_BASE_SEPOLIA` | Address kontrak — listener auto-enable kalau set |
| `PULSE_SENDER_ARB_SEPOLIA` | sda |
| `ENABLE_SOLANA_LZ_LISTENER` | `true`/`false` toggle backup path |
| `POLL_INTERVAL_MS` | Solana polling, default 4000 |
| `EVM_POLL_INTERVAL_MS` | EVM polling, default 5000 |

## Module layout

- `src/config.ts` — env + keypair loading + mainnet guard
- `src/types.ts` — `PulsePaymentIntent` (unified event type)
- `src/evm-listener.ts` — viem-based polling getLogs untuk PaymentIntentSent
- `src/solana-lz-listener.ts` — polling logs pulse_lz_oapp untuk LzPaymentIntentReceived
- `src/session-resolver.ts` — getProgramAccounts session_id + decode Merchant
- `src/settler.ts` — build + send `execute_trusted_split` IX, dedup inflight
- `src/index.ts` — boot both listeners paralel
- `src/logger.ts` — pino (pretty di dev, JSON di prod)

## Operasional

- **Cursor in-memory** — restart re-scan dari block/sig terkini, tidak rewind history.
  Idempotency dijaga settler via on-chain status check.
- **Dedup** — kalau session sudah Paid (oleh listener lain atau e2e script), settler skip.
- **In-flight lock** — per sessionId, supaya race antara EVM+Solana listener tidak settle 2×.
- **Block range cap** — EVM `getLogs` di-cap 1000 block per call (public RPC limit).

## Catatan production

- Persistent cursor (Redis / Postgres) supaya restart tidak miss event lama.
- Websocket subscription (Alchemy / QuickNode) ganti polling.
- HSM / KMS untuk relayer keypair.
- Persist Transaction record ke DB action-api.
- Multi-relayer dengan election (Raft / DB lock) untuk HA.
