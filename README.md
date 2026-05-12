# Pulse

Pulse is a Solana-native payment rail for real-world payments. Merchants create payment sessions from the dashboard, customers open checkout from an NFC/tap link, and USDC payments settle with split-payment logic to the merchant and platform wallets. This repository also includes the cross-chain path from EVM testnets to Solana settlement through EVM contracts and a trusted relayer.

## Stack

- PNPM workspace + Turborepo
- Next.js 16, React 19, Tailwind CSS 4
- Hono for the Action API
- Prisma 7 + PostgreSQL
- Solana Web3/Kit and Anchor programs for `pulse_payment` and `pulse_lz_oapp`
- Foundry for EVM contracts
- Viem for EVM integration

## Repository Structure

```text
apps/
  web/          Customer checkout PWA
  ops/          Merchant and operations dashboard
  action-api/   Backend API for merchants, terminals, sessions, taps, and transactions
  relayer/      Cross-chain trusted relayer from EVM to Solana
packages/
  database/     Prisma schema, client, and seed script
  solana/       Connection, transaction, cross-chain, and Solana LayerZero helpers
  evm/          ABI, address, chain config, and EVM payment client helpers
  types/        Shared TypeScript types
  ui/           Shared UI components
contracts/      Anchor programs for Solana
evm/            Solidity contracts and Foundry scripts
docs/           Architecture notes and integration handoff docs
```

## Requirements

- Node.js `24.15.0` as defined in `.nvmrc`
- PNPM `10.33.3`
- PostgreSQL for local database development
- Solana CLI and Anchor for Solana program development
- Foundry for EVM contracts

## Local Setup

Install dependencies:

```bash
pnpm install
```

Generate the Prisma client:

```bash
pnpm db:generate
```

Configure the database from the root `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public
```

Push the schema and seed data when needed:

```bash
pnpm --filter @pulse/database db:push
pnpm --filter @pulse/database db:seed
```

## Environment

Example environment files are available at:

- `apps/web/.env.example`
- `apps/ops/.env.example`
- `apps/relayer/.env.example`
- `evm/.env.example`
- `contracts/.env.cctp.example`

To run the API, create an env file for `apps/action-api` or export the variables before starting the service:

```env
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
PLATFORM_USDC_TOKEN_ACCOUNT=<platform-usdc-token-account>
PULSE_PAYMENT_PROGRAM_ID=2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Running the Apps

Run all development services through Turborepo:

```bash
pnpm dev
```

Or run each service individually:

```bash
pnpm --filter @pulse/action-api dev
pnpm --filter @pulse/web dev
pnpm --filter @pulse/ops dev
pnpm --filter @pulse/relayer dev
```

Default ports:

- Web checkout: `http://localhost:3000`
- Ops dashboard: `http://localhost:3001`
- Action API: `http://localhost:8000/api`

Make sure `NEXT_PUBLIC_ACTION_API_URL` in `apps/web/.env` and `apps/ops/.env` points to the same API instance.

## Main Scripts

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

## Solana Contracts

Anchor programs live in `contracts/`:

- `pulse_payment`: merchants, sessions, split payments, trusted splits, and relayer config
- `pulse_lz_oapp`: LayerZero/OApp receiver for cross-chain payloads

Run Anchor tests:

```bash
pnpm --filter @pulse/contracts test
```

Detailed notes are available at:

- `contracts/programs/pulse_payment/cross_chain/README.md`
- `contracts/programs/pulse_payment/cross_chain/SETUP.md`
- `contracts/programs/pulse_lz_oapp/README.md`

## EVM Contracts

Solidity contracts live in `evm/`:

- `MockUSDC.sol`: 6-decimal testnet USDC token
- `PulseSender.sol`: LayerZero V2 sender for EVM payment intents

Basic commands:

```bash
cd evm
cp .env.example .env
forge build
forge test
```

See `evm/README.md` for Base Sepolia and Arbitrum Sepolia deployment steps.

## Relayer

The relayer listens for payment events from EVM and settles them to Solana through `execute_trusted_split`.

```bash
cd apps/relayer
cp .env.example .env
```

Fill in the keypair, RPC, program IDs, and `PulseSender` addresses, then run:

```bash
pnpm --filter @pulse/relayer dev
```

Operational details are available in `apps/relayer/README.md`.

## Documentation

- `PRODUCT.md`: product direction, users, and design principles
- `docs/action-api-fe-integration.md`: frontend integration with the Action API
- `docs/cross-chain-architecture.md`: cross-chain architecture
- `docs/pulse-contract-handoff.md`: contract handoff notes
