# Pulse EVM contracts

Solidity contracts untuk sisi EVM (Base Sepolia + Arbitrum Sepolia) yang menjembatani
intent pembayaran cross-chain ke `pulse_payment` di Solana via LayerZero V2 + trusted relayer.

## Contracts

- **`src/MockUSDC.sol`** — ERC20 mock USDC (6 decimals, simbol `pmUSDC`). Faucet publik
  1× per jam per address (max 1000 pmUSDC), `ownerMint` tanpa cap untuk treasury.
- **`src/PulseSender.sol`** — LayerZero V2 OApp Sender minimal. `pay(...)` pull pmUSDC,
  encode `PulseLzPayload` 64 bytes, dan `_lzSend` ke Solana OApp peer.

## Setup

```bash
cp .env.example .env
# edit .env: PRIVATE_KEY, RPC URLs, etc.

forge install                # install dependencies (jika belum)
forge build
forge test
```

Deps yang sudah ter-install via `forge install`:
- `foundry-rs/forge-std`
- `OpenZeppelin/openzeppelin-contracts@v5.1.0`
- `GNSPS/solidity-bytes-utils`

## Deploy

### 1. MockUSDC ke Base Sepolia

```bash
source .env
forge script script/DeployMockUSDC.s.sol \
  --rpc-url base_sepolia --broadcast --verify -vvvv
```

Catat `MockUSDC deployed: 0x...` ke `.env` sebagai `MOCK_USDC_BASE_SEPOLIA`.

### 2. PulseSender ke Base Sepolia

```bash
LZ_ENDPOINT=$LZ_ENDPOINT_V2_BASE_SEPOLIA \
MOCK_USDC=$MOCK_USDC_BASE_SEPOLIA \
  forge script script/DeployPulseSender.s.sol \
  --rpc-url base_sepolia --broadcast --verify -vvvv
```

Catat alamat ke `.env` sebagai `PULSE_SENDER_BASE_SEPOLIA`.

### 3. Ulangi untuk Arbitrum Sepolia

Ganti `--rpc-url arb_sepolia` dan variabel `_ARB_SEPOLIA`.

### 4. Set Solana peer

Cari Solana OApp Store PDA dari `pulse_lz_oapp` (program ID
`AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8`, seed `b"Store"`). Gunakan helper
`deriveStorePda()` di `packages/solana/src/lz/addresses.ts`.

```bash
PULSE_SENDER=$PULSE_SENDER_BASE_SEPOLIA \
DST_EID=40168 \
PEER_BYTES32=0x<store-pda-bytes-as-32-byte-hex> \
  forge script script/SetPeer.s.sol --rpc-url base_sepolia --broadcast
```

### 5. Set default LZ Executor options

```bash
PULSE_SENDER=$PULSE_SENDER_BASE_SEPOLIA \
OPTIONS_HEX=0x00030100110100000000000000000000000000030d40 \
  forge script script/SetDefaultOptions.s.sol --rpc-url base_sepolia --broadcast
```

(Options di atas adalah type-3 lzReceive dengan gas 200_000 + value 0 — adjust untuk
realita Solana CU cost.)

## Pay flow

```solidity
// Sisi user (Base Sepolia):
mockUsdc.approve(pulseSender, amount);
pulseSender.pay{ value: nativeFee }(40168, sessionId, amount, "");
```

## Layout payload (64 bytes BE, must match Rust `payload_codec::PulseLzPayload`)

| offset | size | field          |
|--------|------|----------------|
| 0      | 32   | session_id     |
| 32     | 8    | amount (u64 BE)|
| 40     | 20   | payer (EVM)    |
| 60     | 4    | source_eid     |

## Address map (devnet)

| Chain               | EID    | LZ Endpoint V2                              | Mock USDC | PulseSender |
|---------------------|--------|---------------------------------------------|-----------|-------------|
| Base Sepolia        | 40245  | 0x6EDCE65403992e310A62460808c4b910D972f10f  | _TBD_     | _TBD_       |
| Arbitrum Sepolia    | 40231  | 0x6EDCE65403992e310A62460808c4b910D972f10f  | _TBD_     | _TBD_       |
| Solana Devnet (OApp)| 40168  | (program) 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 | (USDC mint) 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU | (OApp) AUdFnYGNTsKRvdCNyRRZcUVo7h8x2nf74e1RMYSF1Nm8 |
