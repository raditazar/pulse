# Pulse Action API - Frontend Integration Guide

Dokumen ini menjelaskan endpoint yang tersedia untuk FE engineer. Base URL local:

```text
http://localhost:8000/api
```

Untuk Next.js frontend, set env berikut:

```env
NEXT_PUBLIC_ACTION_API_URL="http://localhost:8000"
```

Dipakai di:

```text
apps/web/.env.local
apps/ops/.env.local
```

Semua request/response memakai JSON. Amount USDC ada dalam 2 format:

- `amountUsdc`: decimal string, contoh `"12.50"`.
- `amountUsdcUnits`: integer string/unit terkecil USDC 6 decimals, contoh `"12500000"` untuk 12.5 USDC.

Runtime target pembayaran adalah Solana devnet sesuai env backend:

```env
SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_COMMITMENT="confirmed"
```

Aturan session aktif: untuk satu merchant, hanya session terbaru yang dianggap live. Ketika API membuat session baru, session lama milik merchant dengan status `pending` atau `submitted` akan diubah menjadi `cancelled`.

Setelah session berhasil dibayar (`confirmed` via verifier atau `paid` via manual record), `terminal.currentSessionId` dikosongkan. Scan NFC berikutnya akan mengembalikan `No active session for terminal` sampai kasir membuat session baru.

## Health Check

### `GET /api`

Memastikan API hidup.

Response:

```json
{
  "name": "pulse-action-api",
  "status": "ok",
  "message": "Pulse backend is ready for session and split-payment routes."
}
```

## Merchants

### `POST /api/merchants`

Membuat atau update merchant berdasarkan wallet authority. Endpoint ini dipakai oleh Ops ketika merchant connect wallet pertama kali.

Request:

```json
{
  "authority": "MERCHANT_SOLANA_WALLET",
  "primaryBeneficiary": "MERCHANT_SOLANA_WALLET",
  "splitBasisPoints": 1000,
  "metadataUri": "pulse://merchant/example",
  "name": "Pulse Merchant",
  "walletAddress": "MERCHANT_SOLANA_WALLET",
  "usdcTokenAccount": "MERCHANT_USDC_TOKEN_ACCOUNT",
  "platformFeeBps": 1000,
  "splitBeneficiaries": [
    {
      "wallet": "SPLIT_WALLET",
      "bps": 1000,
      "label": "ops"
    }
  ]
}
```

`walletAddress`, `usdcTokenAccount`, dan `platformFeeBps` opsional, tapi untuk real verifier `usdcTokenAccount` harus tersedia supaya backend bisa memvalidasi delta token USDC merchant.

Response `201`:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "authority": "wallet",
    "primaryBeneficiary": "wallet",
    "splitBasisPoints": 1000,
    "splitBeneficiaries": [],
    "metadataUri": "pulse://merchant/example",
    "name": "Pulse Merchant",
    "isActive": true,
    "createdAt": "2026-05-11T00:00:00.000Z",
    "updatedAt": "2026-05-11T00:00:00.000Z"
  },
  "cluster": "devnet",
  "programId": "program-id"
}
```

### `GET /api/merchants/:id`

Ambil merchant by `id` atau `merchantPda`.

Response:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "authority": "wallet",
    "primaryBeneficiary": "wallet",
    "splitBasisPoints": 1000,
    "splitBeneficiaries": [],
    "metadataUri": null,
    "name": "Pulse Merchant",
    "isActive": true,
    "createdAt": "2026-05-11T00:00:00.000Z",
    "updatedAt": "2026-05-11T00:00:00.000Z"
  },
  "id": "uuid",
  "name": "Pulse Merchant",
  "walletAddress": "wallet",
  "usdcTokenAccount": "token-account",
  "platformFeeBps": 100
}
```

### `PATCH /api/merchants/:id`

Update data merchant untuk halaman settings. `id` bisa `merchant.id` atau `merchantPda`.

Request:

```json
{
  "name": "Kopi Tepi Jalan",
  "metadataUri": "pulse://merchant/kopi-tepi-jalan",
  "walletAddress": "merchant-wallet",
  "usdcTokenAccount": "merchant-usdc-token-account",
  "primaryBeneficiary": "merchant-wallet",
  "platformFeeBps": 125,
  "splitBasisPoints": 1250,
  "isActive": true
}
```

Response mengikuti bentuk `GET /api/merchants/:id`.

### `GET /api/merchants/:id/summary`

Data ringkas untuk dashboard overview merchant.

Response:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "summary": {
    "totalVolumeUsdc": "45.75",
    "totalTransactions": 4,
    "successfulTransactions": 4,
    "pendingSessions": 1,
    "failedSessions": 2,
    "activeTerminals": 1,
    "date": "2026-05-11T00:00:00.000Z"
  }
}
```

### `GET /api/merchants/:id/volume?days=14`

Data chart volume harian untuk dashboard.

Response:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "days": 14,
  "points": [
    {
      "date": "2026-05-11",
      "volumeUsdc": "12.50",
      "transactions": 1
    }
  ]
}
```

### `GET /api/merchants/:id/sessions?limit=20`

Ambil session terbaru milik merchant. `id` bisa `merchant.id` atau `merchantPda`.

Response:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "sessions": [
    {
      "id": "uuid",
      "sessionPda": "session-pda",
      "sessionSeed": "seed",
      "merchantPda": "merchant-pda",
      "merchantId": "uuid",
      "amountUsdc": "12.50",
      "expiresAt": "2026-05-11T00:15:00.000Z",
      "status": "pending",
      "checkoutPath": "/pay/session-pda",
      "createdAt": "2026-05-11T00:00:00.000Z",
      "paidBy": null
    }
  ]
}
```

### `POST /api/merchants/:id/sessions`

Buat latest live cashier session untuk merchant. Endpoint ini cocok untuk Ops “Create Payment” jika produk memakai satu cashier NFC per merchant. API akan:

1. Membatalkan semua session `pending`/`submitted` milik merchant.
2. Mengambil terminal pertama merchant, atau membuat terminal default jika belum ada.
3. Membuat session baru dan set `terminal.currentSessionId` ke session tersebut.
4. Mengembalikan `checkoutUrl` berbasis `/tap/:nfcCode`.

Request bisa memakai decimal:

```json
{
  "amountUsdc": "12.50",
  "sourceChain": "solana"
}
```

Atau USDC units:

```json
{
  "amountUsdcUnits": "12500000",
  "sourceChain": "solana"
}
```

Response `201`:

```json
{
  "sessionId": "session-uuid",
  "terminal": {
    "id": "terminal-uuid",
    "merchantId": "merchant-uuid",
    "label": "Cashier Counter",
    "nfcCode": "cashier-merchant-uuid",
    "currentSessionId": "session-uuid",
    "tapUrl": "http://localhost:3000/tap/cashier-merchant-uuid"
  },
  "amountUsdcUnits": "12500000",
  "merchantAmountUsdcUnits": "12375000",
  "platformAmountUsdcUnits": "125000",
  "platformFeeBps": 100,
  "currency": "USDC",
  "sourceChain": "solana",
  "settlementChain": "solana",
  "tokenMint": "usdc-mint",
  "tokenDecimals": 6,
  "status": "pending",
  "expiresAt": "2026-05-11T00:15:00.000Z",
  "checkoutUrl": "http://localhost:3000/tap/cashier-merchant-uuid"
}
```

### `GET /api/merchants/:id/terminals`

List terminal/NFC milik merchant.

Response:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "terminals": [
    {
      "id": "terminal-uuid",
      "merchantId": "merchant-uuid",
      "label": "Cashier Counter",
      "nfcCode": "NFC-001",
      "currentSessionId": "session-uuid",
      "tapUrl": "http://localhost:3000/tap/NFC-001",
      "createdAt": "2026-05-11T00:00:00.000Z",
      "updatedAt": "2026-05-11T00:00:00.000Z"
    }
  ]
}
```

### `GET /api/merchants/:id/transactions?limit=20&offset=0`

Ambil transaksi merchant. `id` bisa `merchant.id` atau `merchantPda`.

Response:

```json
{
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "transactions": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "sessionPda": "session-pda",
      "txSignature": "signature",
      "payerAddress": "payer-wallet",
      "chain": "solana",
      "sourceChain": "solana",
      "sourceTxHash": null,
      "settlementChain": "solana",
      "amountUsdc": "12.50",
      "splitBreakdown": {
        "merchant": "12375000",
        "platform": "125000",
        "feeBps": 100
      },
      "merchantAmountUsdcUnits": "12375000",
      "platformAmountUsdcUnits": "125000",
      "tokenMint": "usdc-mint",
      "confirmedAt": "2026-05-11T00:01:00.000Z",
      "paidAt": "2026-05-11T00:01:00.000Z",
      "session": {
        "amountUsdc": "12.50",
        "amountUsdcUnits": "12500000",
        "createdAt": "2026-05-11T00:00:00.000Z"
      }
    }
  ],
  "limit": 20,
  "offset": 0
}
```

## Sessions

### `POST /api/sessions`

Ada dua mode pembuatan session.

#### Mode Checkout PDA

Dipakai oleh web/ops flow berbasis `merchantPda`.

Request:

```json
{
  "merchantPda": "merchant-pda",
  "amountUsdc": "12.50"
}
```

Alternatif bisa memakai `merchantId`:

```json
{
  "merchantId": "merchant-uuid",
  "amountUsdc": "12.50",
  "expiresAt": "2026-05-11T12:00:00.000Z",
  "sessionSeed": "optional-32-byte-hex"
}
```

Response `201`:

```json
{
  "session": {
    "id": "uuid",
    "sessionPda": "session-pda",
    "sessionSeed": "seed",
    "merchantPda": "merchant-pda",
    "merchantId": "uuid",
    "amountUsdc": "12.50",
    "expiresAt": "2026-05-11T00:15:00.000Z",
    "status": "pending",
    "checkoutPath": "/pay/session-pda",
    "createdAt": "2026-05-11T00:00:00.000Z",
    "paidBy": null
  },
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "checkoutUrl": "http://localhost:3000/pay/session-pda",
  "cluster": "devnet",
  "programId": "program-id"
}
```

#### Mode Terminal/USDC Units

Dipakai untuk session langsung berbasis `merchantId` dan amount dalam unit USDC.

Request:

```json
{
  "merchantId": "merchant-uuid",
  "amountUsdcUnits": "12500000",
  "sourceChain": "solana"
}
```

Response `201`:

```json
{
  "sessionId": "uuid",
  "merchantId": "merchant-uuid",
  "terminalId": null,
  "amountUsdcUnits": "12500000",
  "merchantAmountUsdcUnits": "12375000",
  "platformAmountUsdcUnits": "125000",
  "platformFeeBps": 100,
  "currency": "USDC",
  "sourceChain": "solana",
  "settlementChain": "solana",
  "tokenMint": "usdc-mint",
  "tokenDecimals": 6,
  "status": "pending",
  "merchant": {
    "id": "merchant-uuid",
    "name": "Pulse Merchant",
    "walletAddress": "wallet",
    "usdcTokenAccount": "merchant-usdc-token-account",
    "platformFeeBps": 100
  },
  "platformUsdcTokenAccount": "platform-usdc-token-account",
  "programId": "program-id",
  "expiresAt": "2026-05-11T00:15:00.000Z",
  "checkoutUrl": "http://localhost:3000/pay/session-id"
}
```

### `GET /api/sessions/:id`

Ambil detail session. `id` bisa `session.id`, `sessionPda`, atau `sessionSeed`.

Untuk Checkout PDA response berbentuk:

```json
{
  "session": {
    "id": "uuid",
    "sessionPda": "session-pda",
    "amountUsdc": "12.50",
    "status": "pending",
    "checkoutPath": "/pay/session-pda"
  },
  "merchant": {
    "id": "uuid",
    "merchantPda": "merchant-pda",
    "name": "Pulse Merchant"
  },
  "cluster": "devnet",
  "programId": "program-id"
}
```

Untuk terminal/USDC units response berbentuk serialized session seperti response mode Terminal/USDC Units.

Catatan: jika session sudah melewati `expiresAt` dan status masih `pending`/`submitted`, API akan mengubah status menjadi `expired`.

### `GET /api/sessions/:id/status`

Ambil status ringkas session by `session.id`.

Response:

```json
{
  "sessionId": "uuid",
  "status": "pending",
  "txSignature": null,
  "confirmedAt": null
}
```

Status yang mungkin:

```text
pending
submitted
confirmed
paid
failed
expired
cancelled
refunded
deactivated
```

### `POST /api/sessions/:id/submit-signature`

Submit signature transaksi Solana untuk diverifikasi backend. API akan mengambil parsed transaction dari RPC dan memvalidasi:

- transaksi confirmed/finalized sesuai env,
- transaksi memanggil Pulse program,
- fee payer sama dengan `payerAddress`,
- delta token USDC merchant sesuai amount merchant,
- delta token USDC platform sesuai fee platform.

Request:

```json
{
  "txSignature": "solana-signature",
  "payerAddress": "payer-wallet",
  "sourceChain": "solana",
  "sourceTxHash": "optional-source-tx"
}
```

Response jika confirmed:

```json
{
  "success": true,
  "status": "confirmed",
  "txSignature": "solana-signature"
}
```

Response jika transaction belum ditemukan/confirmed:

```json
{
  "success": false,
  "status": "submitted",
  "message": "Settlement transaction not found or not confirmed yet"
}
```

## Terminals

### `POST /api/terminals`

Buat terminal/NFC record untuk merchant.

Request:

```json
{
  "merchantId": "merchant-uuid",
  "label": "Cashier Counter",
  "nfcCode": "NFC-001"
}
```

Response `201`:

```json
{
  "id": "terminal-uuid",
  "merchantId": "merchant-uuid",
  "label": "Cashier Counter",
  "nfcCode": "NFC-001",
  "tapUrl": "http://localhost:3000/tap/NFC-001"
}
```

### `GET /api/terminals/:id`

Ambil detail terminal. `id` bisa `terminal.id` atau `nfcCode`.

Response:

```json
{
  "id": "terminal-uuid",
  "merchantId": "merchant-uuid",
  "label": "Cashier Counter",
  "nfcCode": "NFC-001",
  "currentSessionId": "session-uuid",
  "tapUrl": "http://localhost:3000/tap/NFC-001",
  "merchant": {
    "id": "merchant-uuid",
    "name": "Pulse Merchant",
    "walletAddress": "wallet",
    "usdcTokenAccount": "merchant-usdc-token-account"
  }
}
```

### `POST /api/terminals/:id/sessions`

Buat session baru untuk terminal. API akan membatalkan semua session `pending`/`submitted` milik merchant yang sama, lalu terminal diarahkan ke session baru.

Request:

```json
{
  "amountUsdcUnits": "12500000",
  "sourceChain": "solana"
}
```

Response `201`:

```json
{
  "sessionId": "session-uuid",
  "terminalId": "terminal-uuid",
  "amountUsdcUnits": "12500000",
  "merchantAmountUsdcUnits": "12375000",
  "platformAmountUsdcUnits": "125000",
  "platformFeeBps": 100,
  "currency": "USDC",
  "sourceChain": "solana",
  "settlementChain": "solana",
  "tokenMint": "usdc-mint",
  "tokenDecimals": 6,
  "status": "pending",
  "expiresAt": "2026-05-11T00:15:00.000Z",
  "checkoutUrl": "http://localhost:3000/tap/NFC-001"
}
```

## Tap / NFC Checkout

### `GET /api/tap/:nfcCode`

Dipakai buyer checkout page ketika membuka URL NFC. API akan resolve `nfcCode` ke terminal, lalu mengambil `currentSessionId`.

Endpoint ini hanya mengembalikan session yang masih payable: `pending` atau `submitted`. Jika current session sudah `confirmed`, `paid`, `cancelled`, `failed`, atau `expired`, backend akan mengosongkan `currentSessionId` dan mengembalikan error.

Response:

```json
{
  "sessionId": "session-uuid",
  "terminalId": "terminal-uuid",
  "status": "pending",
  "amountUsdcUnits": "12500000",
  "merchantAmountUsdcUnits": "12375000",
  "platformAmountUsdcUnits": "125000",
  "platformFeeBps": 100,
  "currency": "USDC",
  "sourceChain": "solana",
  "settlementChain": "solana",
  "tokenMint": "usdc-mint",
  "tokenDecimals": 6,
  "merchant": {
    "id": "merchant-uuid",
    "name": "Pulse Merchant",
    "walletAddress": "wallet",
    "usdcTokenAccount": "merchant-usdc-token-account"
  },
  "platformUsdcTokenAccount": "platform-usdc-token-account",
  "programId": "program-id",
  "expiresAt": "2026-05-11T00:15:00.000Z"
}
```

Error yang mungkin:

```json
{ "error": "Terminal not found" }
```

```json
{ "error": "No active session for terminal" }
```

```json
{ "error": "Active session expired" }
```

## Transactions

### `POST /api/transactions`

Ada dua mode.

#### Mode On-chain Verification

Sama seperti `POST /api/sessions/:id/submit-signature`, tapi `sessionId` dikirim di body.

Request:

```json
{
  "sessionId": "session-uuid",
  "txSignature": "solana-signature",
  "payerAddress": "payer-wallet",
  "sourceChain": "solana",
  "sourceTxHash": "optional-source-tx"
}
```

Response:

```json
{
  "success": true,
  "status": "confirmed",
  "txSignature": "solana-signature"
}
```

#### Mode Manual Record

Dipakai untuk mencatat transaksi berdasarkan `sessionPda` tanpa menjalankan verifier on-chain.

Request:

```json
{
  "sessionPda": "session-pda",
  "sessionId": "session-uuid",
  "txSignature": "signature",
  "payerAddress": "payer-wallet",
  "tokenMint": "usdc-mint",
  "chain": "solana",
  "amountUsdc": "12.50",
  "splitBreakdown": {
    "merchant": "11.25",
    "platform": "1.25"
  }
}
```

Response `201`:

```json
{
  "success": true,
  "transactionId": "transaction-uuid",
  "txSignature": "signature"
}
```

### `GET /api/transactions/:signature`

Ambil detail transaction by `txSignature`.

Response:

```json
{
  "id": "transaction-uuid",
  "sessionId": "session-uuid",
  "sessionPda": "session-pda",
  "txSignature": "signature",
  "payerAddress": "payer-wallet",
  "chain": "solana",
  "sourceChain": "solana",
  "sourceTxHash": null,
  "settlementChain": "solana",
  "amountUsdc": "12.50",
  "merchantAmountUsdcUnits": "12375000",
  "platformAmountUsdcUnits": "125000",
  "tokenMint": "usdc-mint",
  "tokenDecimals": 6,
  "confirmedAt": "2026-05-11T00:01:00.000Z",
  "paidAt": "2026-05-11T00:01:00.000Z",
  "createdAt": "2026-05-11T00:01:00.000Z"
}
```

## Recommended FE Flows

### Ops: Create Payment Session

1. Merchant connects Solana wallet via Privy.
2. Call `POST /api/merchants` with merchant wallet as `authority` and `primaryBeneficiary`.
3. Recommended for cashier NFC flow: call `POST /api/merchants/:merchantPda/sessions` with:

```json
{
  "amountUsdc": "12.50"
}
```

4. Show/copy `checkoutUrl` from response. This URL points to `/tap/:nfcCode`.

### Web: Buyer Checkout

1. Page receives `sessionId` or `sessionPda` from route `/pay/:sessionId`.
2. Call `GET /api/sessions/:sessionId`.
3. Render merchant name, amount, expiry, and program/session data.
4. Buyer signs payment transaction.
5. Submit real Solana devnet signature with `POST /api/sessions/:id/submit-signature` or `POST /api/transactions`.
6. Poll `GET /api/sessions/:id/status` until status is `confirmed`, `failed`, or `expired`.

### NFC Tap Flow

1. Buyer opens `/tap/:nfcCode`.
2. FE calls `GET /api/tap/:nfcCode`.
3. Render returned session payment detail.
4. Submit payment signature.

## Error Format

Umumnya API mengembalikan:

```json
{
  "error": "Message"
}
```

Untuk validation error:

```json
{
  "error": "Invalid request body",
  "issues": {}
}
```

FE sebaiknya menampilkan `error` atau `message` jika tersedia.
