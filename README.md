# Pulse

Pulse adalah payment rail Solana-native untuk pembayaran dunia nyata. Merchant membuat sesi pembayaran melalui dashboard, pelanggan membuka checkout dari NFC/tap link, lalu pembayaran USDC diselesaikan dengan logika split-payment ke wallet merchant dan platform. Repo ini juga berisi jalur cross-chain dari EVM testnet ke settlement Solana melalui kontrak EVM dan trusted relayer.

## Stack

- PNPM workspace + Turborepo
- Next.js 16, React 19, Tailwind CSS 4
- Hono untuk Action API
- Prisma 7 + PostgreSQL
- Solana Web3/Kit, Anchor program untuk `pulse_payment` dan `pulse_lz_oapp`
- Foundry untuk kontrak EVM
- Viem untuk integrasi EVM

## Struktur Repo

```text
apps/
  web/          Checkout PWA untuk pelanggan
  ops/          Dashboard merchant dan operasional
  action-api/   Backend API untuk merchant, terminal, session, tap, dan transaksi
  relayer/      Trusted relayer cross-chain EVM -> Solana
packages/
  database/     Prisma schema, client, dan seed
  solana/       Helper koneksi, transaksi, cross-chain, dan LayerZero Solana
  evm/          Helper ABI, address, chain config, dan payment client EVM
  types/        Shared TypeScript types
  ui/           Shared UI components
contracts/      Anchor programs untuk Solana
evm/            Solidity contracts dan Foundry scripts
docs/           Catatan arsitektur dan handoff integrasi
```

## Prasyarat

- Node.js `24.15.0` sesuai `.nvmrc`
- PNPM `10.33.3`
- PostgreSQL untuk database lokal
- Solana CLI dan Anchor untuk pengembangan program Solana
- Foundry untuk kontrak EVM

## Setup Lokal

Install dependency:

```bash
pnpm install
```

Generate Prisma client:

```bash
pnpm db:generate
```

Siapkan database dari root `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public
```

Push schema dan seed data jika diperlukan:

```bash
pnpm --filter @pulse/database db:push
pnpm --filter @pulse/database db:seed
```

## Environment

Contoh env tersedia di:

- `apps/web/.env.example`
- `apps/ops/.env.example`
- `apps/relayer/.env.example`
- `evm/.env.example`
- `contracts/.env.cctp.example`

Untuk menjalankan API, buat env untuk `apps/action-api` atau ekspor variabel saat menjalankan service:

```env
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
PLATFORM_USDC_TOKEN_ACCOUNT=<platform-usdc-token-account>
PULSE_PAYMENT_PROGRAM_ID=2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Menjalankan App

Jalankan semua service dev lewat Turborepo:

```bash
pnpm dev
```

Atau jalankan per service:

```bash
pnpm --filter @pulse/action-api dev
pnpm --filter @pulse/web dev
pnpm --filter @pulse/ops dev
pnpm --filter @pulse/relayer dev
```

Port default:

- Web checkout: `http://localhost:3000`
- Ops dashboard: `http://localhost:3001`
- Action API: `http://localhost:8000/api`

Pastikan `NEXT_PUBLIC_ACTION_API_URL` di `apps/web/.env` dan `apps/ops/.env` mengarah ke API yang sama.

## Script Utama

```bash
pnpm build
pnpm typecheck
pnpm db:generate
```

Per package:

```bash
pnpm --filter @pulse/database db:push
pnpm --filter @pulse/database db:seed
pnpm --filter @pulse/contracts test
pnpm --filter @pulse/relayer build
```

## Kontrak Solana

Program Anchor berada di `contracts/`:

- `pulse_payment`: merchant, session, split payment, trusted split, dan config relayer
- `pulse_lz_oapp`: receiver LayerZero/OApp untuk payload cross-chain

Jalankan test Anchor:

```bash
pnpm --filter @pulse/contracts test
```

Catatan detail tersedia di:

- `contracts/programs/pulse_payment/cross_chain/README.md`
- `contracts/programs/pulse_payment/cross_chain/SETUP.md`
- `contracts/programs/pulse_lz_oapp/README.md`

## Kontrak EVM

Kontrak Solidity berada di `evm/`:

- `MockUSDC.sol`: token USDC testnet 6 decimal
- `PulseSender.sol`: sender LayerZero V2 untuk intent pembayaran EVM

Command dasar:

```bash
cd evm
cp .env.example .env
forge build
forge test
```

Lihat `evm/README.md` untuk langkah deploy Base Sepolia dan Arbitrum Sepolia.

## Relayer

Relayer mendengarkan event pembayaran dari EVM dan menyelesaikan settlement ke Solana lewat `execute_trusted_split`.

```bash
cd apps/relayer
cp .env.example .env
```

Isi keypair, RPC, program ID, dan address `PulseSender`, lalu jalankan:

```bash
pnpm --filter @pulse/relayer dev
```

Detail operasional tersedia di `apps/relayer/README.md`.

## Dokumentasi

- `PRODUCT.md`: arah produk, pengguna, dan prinsip desain
- `docs/action-api-fe-integration.md`: integrasi frontend dengan Action API
- `docs/cross-chain-architecture.md`: arsitektur cross-chain
- `docs/pulse-contract-handoff.md`: catatan handoff kontrak

