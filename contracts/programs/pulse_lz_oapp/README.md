# Pulse LayerZero V2 OApp (Phase 2)

Standalone Anchor program — receives PaymentIntent dari peer EVM (Base Sepolia, Arbitrum Sepolia, Ethereum Sepolia) via LayerZero V2 dan emit `LzPaymentIntentReceived` event yang di-pickup off-chain relayer untuk pre-warm `PaymentSession` di program `pulse_payment`.

> **Scope: DEVNET / TESTNET ONLY.** EID allowlist hardcoded ke testnet EIDs (40161, 40231, 40245, 40168). Mainnet di luar scope.

---

## 1. Why a separate program?

Program ini di-pisah dari `pulse_payment` karena:

1. **Build isolation** — dependency `oapp` (LayerZero V2 SDK, git rev `c09287a`) heavy & compile-slow. Pisah crate biar Phase 1 (`pulse_payment`) tetap fast-build.
2. **LZ deployment standard** — LayerZero Endpoint register OApp by program ID. Each OApp punya program ID dedicated.
3. **Anchor `#[program]` dispatch** — di Anchor 0.31.1, dispatch enum tidak respect inner `#[cfg]` per-fn, jadi feature-flag-gated entrypoints di program yang sama tidak compile clean. Pisah crate menghindari ini.

Coupling antara dua program tetap loose:
- `pulse_lz_oapp.lz_receive` cuma decode payload + `emit!(LzPaymentIntentReceived)`.
- Off-chain relayer Pulse subscribe event ini → invoke instruction di `pulse_payment` untuk pre-warm session.
- Direct CPI `pulse_lz_oapp` → `pulse_payment` di-defer sampai core program merge supaya tidak coupling tight ke mock state.

---

## 2. Program IDs

| Program | Address |
|---|---|
| `pulse_lz_oapp` | `AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8` |
| LZ V2 Endpoint Solana Devnet | _TBD — fetch dari https://docs.layerzero.network/v2/deployments/chains/solana-testnet_ |

---

## 3. Instructions

| Instruction | Authority | Catatan |
|---|---|---|
| `init_store` | anyone (front-runnable) | Init Store + LzReceiveTypes PDA + register OApp dengan Endpoint via CPI |
| `set_peer_config` | `store.admin` | Register peer EVM address per source EID |
| `lz_receive` | LZ Executor | Decode payload, validate peer, emit event |
| `lz_receive_types_v2` | (read-only) | Return execution plan (akun + ALT + instruksi) untuk Executor V2 |
| `lz_receive_types_info` | (read-only) | Versioning — return (version=2, accounts) |

---

## 4. Payload layout (`PulseLzPayload`, 64 bytes BE)

| offset | size | field        | notes                                |
|--------|------|--------------|--------------------------------------|
| 0      | 32   | `session_id` | Match `PaymentSession.session_id`    |
| 32     | 8    | `amount`     | u64 BE — USDC base units (6 decimals)|
| 40     | 20   | `payer`      | EVM address (raw 20 bytes)           |
| 60     | 4    | `source_eid` | u32 BE — LZ EID asal                 |

- Encoder Rust: [`payload_codec.rs`](./src/payload_codec.rs)
- Encoder TS: [`packages/solana/src/lz/payload-codec.ts`](../../../packages/solana/src/lz/payload-codec.ts)
- Encoder Solidity (EVM-side): _TBD — `abi.encodePacked(sessionId, amount, payer, sourceEid)`_

---

## 5. PDA seeds

| PDA | Seeds |
|---|---|
| `Store` | `[STORE_SEED]` = `"Store"` |
| `PeerConfig` | `[PEER_SEED, store.key(), src_eid.to_be_bytes()]` |
| `LzReceiveTypesAccounts` | `[LZ_RECEIVE_TYPES_SEED, store.key()]` = `"LzReceiveTypes" + store.key()` |

> ⚠️ `LzReceiveTypes` seed literal **harus** literal ini — Executor LZ derive PDA dengan seed yang sama; ganti = OApp ini tidak bisa di-call oleh Executor.

---

## 6. Build

```bash
cd contracts

# Phase 1 only (cepat, ~10s):
NO_DNA=1 anchor build --program-name pulse_payment

# Phase 2 only (oapp git fetch + compile, first run ~3-5 menit):
NO_DNA=1 anchor build --program-name pulse_lz_oapp --no-idl
# IDL build pulse_lz_oapp gagal di Anchor 0.31.1 karena bug upstream LZ
# `endpoint-interface` crate (variabel `send_library_config` tidak ter-resolve di
# Anchor IDL macro context). Workaround: `--no-idl`. Tidak block deployment.

# Build keduanya:
NO_DNA=1 anchor build --program-name pulse_payment && \
  NO_DNA=1 anchor build --program-name pulse_lz_oapp --no-idl
```

Artifacts:
- `target/deploy/pulse_payment.so` (~250 KB)
- `target/deploy/pulse_lz_oapp.so` (~390 KB)

---

## 7. Deploy ke devnet

⚠️ **Saldo wallet `pulse-deploy` saat ini 2 SOL.** Deploy keduanya ~1.2-1.5 SOL. Top-up dulu jika perlu iterasi:

```bash
solana airdrop 3 $(solana address -k contracts/.keys/pulse-deploy.json) -u devnet
```

Deploy:
```bash
cd contracts
anchor deploy --program-name pulse_payment --provider.cluster devnet
anchor deploy --program-name pulse_lz_oapp --provider.cluster devnet
```

Setelah deploy:
```bash
# Init Pulse OApp Store (sekali saja, anyone bisa call):
# Butuh: LZ_ENDPOINT_PROGRAM_ID dari https://docs.layerzero.network/v2/deployments/chains/solana-testnet
# Lihat scripts/lz-init-store.ts (TBD).

# Set peer (admin only):
# Butuh: address EVM Pulse OApp di Base Sepolia (di-deploy via Hardhat di sisi EVM, TBD).
# Lihat scripts/lz-set-peer.ts (TBD).
```

---

## 8. Open work

- [ ] Fetch + plug-in LZ V2 Endpoint program ID Solana Devnet (currently null di `addresses.ts`)
- [ ] EVM-side OApp contract (Solidity) — deploy ke Base Sepolia, register Solana sebagai peer
- [ ] `scripts/lz-init-store.ts` + `scripts/lz-set-peer.ts` — TS helper untuk admin ops
- [ ] Address Lookup Table (ALT) creation — untuk avoid `Transaction too large` saat `lz_receive` (LZ V2 + Solana sering kena ini)
- [ ] Direct CPI `pulse_lz_oapp` → `pulse_payment` saat core program merge (replace event-based relay)
- [ ] E2E test: send LZ message dari Base Sepolia → wait Executor → verify session pre-warmed di Solana
- [ ] Verifiable build via Docker (`anchor build --verifiable`) — wajib sebelum mainnet, optional untuk devnet

---

## 9. Known issues

### `endpoint-interface` IDL build error
Anchor 0.31.1 IDL build gagal compile `endpoint-interface` LZ crate karena `send_library_config` / `default_send_library_config` field-references tidak ter-resolve di IDL macro expansion context. Workaround: `--no-idl`. Affected: client TS untuk `pulse_lz_oapp` perlu di-write tangan (tidak bisa Anchor `Program<IDL>` typed). Issue di-track upstream di LayerZero-v2 repo.

### `Transaction too large`
Common issue saat `lz_receive` — LZ V2 di Solana butuh banyak akun (Endpoint Clear + Peer + Store + remaining_accounts). Mitigation: Address Lookup Table (ALT). Plug-in di `lz_receive_types_v2` via `remaining_accounts`.

### Anchor IDL not generated
Karena `--no-idl` dipakai, client TS harus pakai raw instruction encoding. Lihat `packages/solana/src/lz/` untuk PDA derivation + payload codec (sufficient untuk relayer & init scripts; full IDL-typed Program tidak dibutuhkan).
