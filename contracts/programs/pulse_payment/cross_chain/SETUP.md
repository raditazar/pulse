# Pulse Cross-Chain — Environment Setup

Reproducible setup untuk development cross-chain (CCTP V2 + LayerZero V2 OApp) di **Solana Devnet only**. Mainnet diluar scope dokumen ini.

## TL;DR — versi yang dipakai

| Tool | Versi | Catatan |
|---|---|---|
| Rust | `1.94.1` (rustup `1.29.0`) | host toolchain — platform-tools shipped via `cargo-build-sbf` pakai rustc-nya sendiri |
| Solana CLI | **`3.1.12 (Agave)`** | **Bukan 1.17.31/1.18.26** seperti spec lama. Agave 3.x sudah cover requirement modern LZ V2 + CCTP V2 |
| `cargo-build-sbf` platform-tools | `v1.52`, rustc `1.89.0` | dibundle Solana CLI 3.1.12 |
| Anchor CLI | `0.31.1` (active via `avm use 0.31.1`) | **Wajib 0.31.1** — LayerZero V2 Solana OApp pinned di sini. Bukan 0.32 / 1.0 |
| Anchor JS SDK | `@coral-xyz/anchor ^0.32.1` | sudah di `contracts/package.json`. JS sisi client OK pakai 0.32 |
| `avm` | `0.32.1` | manage Anchor versions |
| Docker | `29.2.1` (daemon **off** by default) | hanya dibutuhkan untuk LZ verifiable build di Phase 2 |
| Node | `24.10.0` (sesuai `.nvmrc`) | |
| pnpm | `10.33.3` | |

**Catatan deviasi dari spec asli:** spec minta install Solana CLI 1.17.31 + 1.18.26 dual. Itu instruksi LayerZero versi 2024 — sudah obsolete sejak Agave fork dewasa (>= 2.x). Agave 3.1.12 sudah handle deploy + verifiable build, dan LayerZero V2 Solana OApp examples (lz-devtools `examples/oapp-solana`) pakai Anchor 0.31.1 yang kompatibel. Kalau di Phase 2 ternyata stuck di build LZ, kita bisa downgrade ke 1.18.26 sebagai fallback (lihat _Fallback_ section bawah).

---

## 1. Install Rust toolchain

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup default stable
```

Verifikasi:
```bash
rustup --version
rustc --version    # >= 1.89 OK
cargo --version
```

## 2. Install Solana CLI (Agave)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

Tambahkan ke `~/.zshrc` atau `~/.bashrc`:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Verifikasi:
```bash
solana --version          # solana-cli 3.x.x (Agave)
cargo-build-sbf --version # platform-tools >= v1.52
```

Set network ke devnet (durable):
```bash
solana config set -u devnet
```

## 3. Install Anchor 0.31.1 via avm

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.31.1
avm use 0.31.1
anchor --version    # anchor-cli 0.31.1
```

⚠️ **JANGAN** pakai Anchor 0.32 / 1.0 untuk compile program ini. LayerZero Solana OApp pinned di 0.31.1.

## 4. Devnet wallet (Pulse-scoped)

Untuk memisahkan deploy authority dari personal Solana keypair user, Pulse menyimpan keypair-nya sendiri di `contracts/.keys/` (gitignored).

Generate keypair (sudah dilakukan saat onboarding pertama):

```bash
mkdir -p contracts/.keys
solana-keygen new \
  --outfile contracts/.keys/pulse-deploy.json \
  --no-bip39-passphrase --silent --force

# Pubkey alias dipakai sebagai deploy authority
solana address -k contracts/.keys/pulse-deploy.json
```

Pulse program keypair (untuk identity program, bukan upgrade authority):
```bash
solana-keygen new \
  --outfile contracts/.keys/pulse_payment-program.json \
  --no-bip39-passphrase --silent --force

# Sebelum build pertama, copy ke posisi yang Anchor cari:
mkdir -p contracts/target/deploy
cp contracts/.keys/pulse_payment-program.json \
   contracts/target/deploy/pulse_payment-keypair.json
```

`Anchor.toml` sudah pre-configured untuk pakai `./.keys/pulse-deploy.json` sebagai provider wallet pada cluster devnet.

## 5. Funding devnet

Devnet airdrop sering rate-limited. Strategi yang reliable:

```bash
# Coba airdrop CLI dulu (sering gagal dengan "rate limit reached"):
solana airdrop 2 $(solana address -k contracts/.keys/pulse-deploy.json) -u devnet

# Kalau gagal, transfer dari personal keypair (kalau punya saldo):
solana transfer $(solana address -k contracts/.keys/pulse-deploy.json) 2 \
  -u devnet --allow-unfunded-recipient \
  --keypair ~/.config/solana/id.json --fee-payer ~/.config/solana/id.json

# Fallback terakhir: faucet web (perlu browser):
#   https://faucet.solana.com  (max 5 SOL/req, perlu connect wallet)
```

Cek saldo:
```bash
solana balance $(solana address -k contracts/.keys/pulse-deploy.json) -u devnet
# Target minimum: 2 SOL untuk first deploy, 5 SOL ideal
```

## 6. Devnet USDC (manual, browser-required)

Faucet Circle butuh wallet UI — tidak bisa di-otomasi via CLI:
- **URL**: https://faucet.circle.com
- Connect Phantom/Backpack ke address `pulse-deploy` di atas
- Network: pilih **Solana Devnet**, klaim USDC (max 10/req)
- USDC Mint Devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

Verifikasi saldo USDC:
```bash
spl-token accounts --owner $(solana address -k contracts/.keys/pulse-deploy.json) -u devnet
```

Untuk EVM testnet (Base Sepolia, Arbitrum Sepolia) — pakai faucet yang sama, switch network di wallet UI.

## 7. Clone reference repos

```bash
git clone --depth 1 https://github.com/circlefin/solana-cctp-contracts /tmp/cctp-ref
git clone --depth 1 https://github.com/LayerZero-Labs/devtools /tmp/lz-devtools
```

Bahan baca:
- CCTP V2 program IDs: `/tmp/cctp-ref/programs/v2/Anchor.toml`
- CCTP V2 source: `/tmp/cctp-ref/programs/v2/{message-transmitter-v2,token-messenger-minter-v2}/src/`
- LZ Solana OApp template: `/tmp/lz-devtools/examples/oapp-solana/`

## 8. Docker (defer ke Phase 2)

Docker dipakai untuk LayerZero `anchor build --verifiable`. Tidak dibutuhkan untuk Phase 1 CCTP.

```bash
# Verify (skip start sampai Phase 2):
docker --version

# Untuk start daemon di macOS, launch Docker Desktop dari GUI:
open -a Docker
# Tunggu ~30s, lalu cek:
docker ps
```

---

## Quick verify — semua sudah ter-setup?

Jalankan dari root repo (`Pulse/`):
```bash
node --version              # v24.x
pnpm --version              # 10.x
solana --version            # solana-cli 3.x (Agave)
anchor --version            # anchor-cli 0.31.1
cargo-build-sbf --version   # platform-tools v1.52, rustc 1.89

solana config get | grep "RPC URL"
# RPC URL: https://api.devnet.solana.com  ← harus devnet

solana balance -k contracts/.keys/pulse-deploy.json -u devnet

cd contracts && anchor build
ls target/deploy/pulse_payment.so   # harus ada, ~200-300 KB
```

---

## Program IDs reference (Devnet)

| Program | Address |
|---|---|
| `pulse_payment` (kita) | `2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF` |
| `pulse_lz_oapp` (Phase 2) | `AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8` |
| CCTP V2 `message_transmitter_v2` | `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC` |
| CCTP V2 `token_messenger_minter_v2` | `CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe` |
| USDC mint (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| LayerZero V2 Endpoint (Solana Devnet) | _TBD — fetch dari https://docs.layerzero.network/v2/deployments/chains/solana-testnet, plug-in ke `packages/solana/src/lz/addresses.ts`_ |

CCTP V2 Domain IDs:
- Solana Devnet = `5`
- Ethereum Sepolia = `0`
- Avalanche Fuji = `1`
- Arbitrum Sepolia = `3`
- Base Sepolia = `6`

LayerZero V2 EIDs (testnet):
- Solana Devnet = `40168`
- Ethereum Sepolia = `40161`
- Arbitrum Sepolia = `40231`
- Base Sepolia = `40245`

---

## Fallback — kalau Agave 3.x tidak kompatibel di Phase 2

Skenario: LZ verifiable build error karena platform-tools mismatch atau `loosen_cpi_size_restriction`. Downgrade Solana CLI **hanya untuk LZ compile**, tidak ganti default global.

```bash
# Install 1.18.26 sebagai sidecar (tidak overwrite Agave 3.x):
SOLANA_INSTALL_DIR_118="$HOME/.solana-1.18"
mkdir -p "$SOLANA_INSTALL_DIR_118"
curl -sSfL https://release.solana.com/v1.18.26/install \
  | SOLANA_INSTALL_DIR="$SOLANA_INSTALL_DIR_118" sh

# Pakai sementara via PATH override:
PATH="$SOLANA_INSTALL_DIR_118/active_release/bin:$PATH" anchor build --verifiable
```

Jangan pernah `solana config set` ke 1.18.26 secara global — itu break tool lain yang depend on Agave 3.x.

---

## Anti-mainnet guards

Semua deploy di repo ini **harus** ke devnet. Cek minimal sebelum apapun:

```bash
solana config get | grep -i mainnet && echo "❌ STOP — config pointing to mainnet"
grep -r "mainnet-beta\|api.mainnet" packages/solana/src/ apps/action-api/src/ 2>&1 | grep -v "// devnet" | head
```

Code-side guard live di `packages/solana/src/cross-chain/config.ts` (akan ditambah di Phase 3) — runtime throw kalau `process.env.SOLANA_CLUSTER === 'mainnet-beta'`.
