pulse-monorepo/
├── apps/ # Aplikasi utama yang akan di-deploy
│ ├── web/ # [Next.js] PWA Consumer (Halaman saat NFC di-tap)
│ │ ├── src/app/ # Routing halaman checkout
│ │ ├── src/components/ # Komponen spesifik PWA
│ │ └── src/hooks/ # Custom hooks (misal: useNFCReader)
│ │
│ ├── ops/ # [Next.js] Merchant Dashboard (Kasir & Admin)
│ │ ├── src/app/ # Routing halaman dashboard, settings, history
│ │ └── src/components/ # Komponen spesifik dashboard (tabel, chart)
│ │
│ └── action-api/ # [Node.js / Hono / Next.js API] Backend Service
│ ├── src/routes/ # Endpoint API untuk generate Solana transaction
│ ├── src/services/ # Logika kalkulasi (termasuk cek fee jika ada cross-chain)
│ └── src/webhooks/ # Listener Helius untuk update status on-chain
│
├── packages/ # Modul/Library internal yang dibagikan antar 'apps'
│ ├── solana/ # Wrapper Web3
│ │ ├── src/connection.ts # RPC connection instances
│ │ └── src/transactions/ # Helper pembangun instruksi split-payment
│ │
│ ├── database/ # Centralized Database Layer (PostgreSQL)
│ │ ├── prisma/ # Schema Prisma (atau Drizzle)
│ │ └── src/index.ts # Export instance database client
│ │
│ ├── ui/ # Shared UI Components (Tailwind + Radix/Shadcn)
│ │ ├── src/Button.tsx # Tombol standar yang dipakai di 'web' dan 'ops'
│ │ └── src/Modal.tsx  
│ │
│ ├── types/ # Shared TypeScript Interfaces
│ │ └── src/index.ts # Interface Merchant, Transaction, Session
│ │
│ └── config/ # Konfigurasi standar untuk semua repo
│ ├── eslint-preset.js
│ ├── tailwind.config.ts
│ └── tsconfig.base.json
│
├── contracts/ # Solana Smart Contracts (Anchor Workspace)
│ ├── programs/
│ │ └── pulse_payment/ # [Rust] Logika on-chain (opsional jika butuh custom split)
│ │ └── src/lib.rs
│ ├── tests/ # [TypeScript] Anchor integration tests
│ └── Anchor.toml
│
├── scripts/ # Script utilitas developer
│ ├── seed-merchant.ts # Script pengisi dummy data merchant di DB
│ └── nfc-writer-cli.js # Script node CLI untuk memprogram ID stiker NFC
│
├── docs/ # Dokumentasi Proyek
│ ├── architecture.md # Diagram alur sistem
│ └── pitch-deck/ # Materi presentasi Colosseum
│
├── package.json # Root workspaces config
├── turbo.json # Turborepo config (jika pakai turbo)
└── .env # Environment variables (RPC URL, DB URL)
