import path from "node:path";
import url from "node:url";
import { config } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/* ── helpers ── */
const now = new Date();
const daysAgo = (d, offsetHours = 0) =>
  new Date(now.getTime() - d * 86_400_000 + offsetHours * 3_600_000);
const minutesFromNow = (m) => new Date(now.getTime() + m * 60_000);

function split(units, feeBps) {
  const platform = (units * BigInt(feeBps)) / 10_000n;
  return { platformAmountUsdcUnits: platform, merchantAmountUsdcUnits: units - platform };
}

const USDC_MINT = process.env.USDC_MINT ?? "MockUsdcMint111111111111111111111111111111";

/* ─────────────────────────────────────────────────────────────
   MERCHANTS
───────────────────────────────────────────────────────────── */
const MERCHANTS = [
  {
    privyUserId: "privy-seed-merchant-001",
    merchantPda: "PulseSeedKopiTepijalan11111111111111111111111",
    authority:   "KopiAuthority1111111111111111111111111111111",
    primaryBeneficiary: "KopiBenef11111111111111111111111111111111111",
    name: "Kopi Tepi Jalan",
    email: "owner@kopitepijalan.id",
    businessType: "F&B / Restaurant",
    walletAddress: "KopiBenef11111111111111111111111111111111111",
    usdcTokenAccount: "KopiUsdcAcct111111111111111111111111111111111",
    platformFeeBps: 125,
    splitBasisPoints: 1250,
    splitBeneficiaries: [{ wallet: "KopiOps1111111111111111111111111111111111111", bps: 1250, label: "ops" }],
    metadataUri: "pulse://merchant/kopi-tepi-jalan",
  },
  {
    privyUserId: "privy-seed-merchant-002",
    merchantPda: "PulseSeedBrightmart1111111111111111111111111",
    authority:   "BrightAuthority111111111111111111111111111111",
    primaryBeneficiary: "BrightBenef1111111111111111111111111111111111",
    name: "BrightMart Express",
    email: "ops@brightmart.co",
    businessType: "Retail",
    walletAddress: "BrightBenef1111111111111111111111111111111111",
    usdcTokenAccount: "BrightUsdcAcct11111111111111111111111111111111",
    platformFeeBps: 90,
    splitBasisPoints: 900,
    splitBeneficiaries: [{ wallet: "BrightOps111111111111111111111111111111111111", bps: 900, label: "ops" }],
    metadataUri: "pulse://merchant/brightmart-express",
  },
  {
    privyUserId: "privy-seed-merchant-003",
    merchantPda: "PulseSeedYogaSenja111111111111111111111111111",
    authority:   "YogaAuthority1111111111111111111111111111111",
    primaryBeneficiary: "YogaBenef11111111111111111111111111111111111",
    name: "Studio Yoga Senja",
    email: "studio@yogasenja.id",
    businessType: "Services",
    walletAddress: "YogaBenef11111111111111111111111111111111111",
    usdcTokenAccount: "YogaUsdcAcct111111111111111111111111111111111",
    platformFeeBps: 150,
    splitBasisPoints: 1500,
    splitBeneficiaries: [{ wallet: "YogaOps1111111111111111111111111111111111111", bps: 1500, label: "ops" }],
    metadataUri: "pulse://merchant/studio-yoga-senja",
  },
  {
    privyUserId: "privy-seed-merchant-004",
    merchantPda: "PulseSeedPasarDigital1111111111111111111111111",
    authority:   "PasarAuthority111111111111111111111111111111",
    primaryBeneficiary: "PasarBenef11111111111111111111111111111111111",
    name: "Pasar Digital Bazaar",
    email: null,
    businessType: "Market / Bazaar",
    walletAddress: "PasarBenef11111111111111111111111111111111111",
    usdcTokenAccount: "PasarUsdcAcct1111111111111111111111111111111",
    platformFeeBps: 100,
    splitBasisPoints: 1000,
    splitBeneficiaries: [],
    metadataUri: "pulse://merchant/pasar-digital",
  },
  {
    privyUserId: "privy-seed-merchant-005",
    merchantPda: "PulseSeedWarpKlothing11111111111111111111111",
    authority:   "WarpAuthority1111111111111111111111111111111",
    primaryBeneficiary: "WarpBenef11111111111111111111111111111111111",
    name: "Warp Clothing Co.",
    email: "hello@warpclothing.com",
    businessType: "Online Store",
    walletAddress: "WarpBenef11111111111111111111111111111111111",
    usdcTokenAccount: "WarpUsdcAcct111111111111111111111111111111111",
    platformFeeBps: 80,
    splitBasisPoints: 800,
    splitBeneficiaries: [
      { wallet: "WarpDesign11111111111111111111111111111111111", bps: 400, label: "design" },
      { wallet: "WarpOps111111111111111111111111111111111111111", bps: 400, label: "ops" },
    ],
    metadataUri: "pulse://merchant/warp-clothing",
  },
];

/* ─────────────────────────────────────────────────────────────
   SESSIONS  (merchantIdx, terminalIdx, amount USDC, status, daysAgo, hoursOffset)
   Statuses: pending|submitted|confirmed|paid|failed|expired|cancelled
───────────────────────────────────────────────────────────── */
const SESSION_FIXTURES = [
  /* Kopi Tepi Jalan — small amounts, high frequency */
  { key: "kopi-01", m: 0, t: 0, amt: "4.50",  units: 4_500_000n,  status: "confirmed", dAgo: 0,  hOff: -1 },
  { key: "kopi-02", m: 0, t: 0, amt: "3.75",  units: 3_750_000n,  status: "confirmed", dAgo: 0,  hOff: -2 },
  { key: "kopi-03", m: 0, t: 1, amt: "8.50",  units: 8_500_000n,  status: "confirmed", dAgo: 0,  hOff: -3 },
  { key: "kopi-04", m: 0, t: 0, amt: "5.25",  units: 5_250_000n,  status: "confirmed", dAgo: 1,  hOff: -1 },
  { key: "kopi-05", m: 0, t: 1, amt: "4.00",  units: 4_000_000n,  status: "confirmed", dAgo: 1,  hOff: -5 },
  { key: "kopi-06", m: 0, t: 0, amt: "6.00",  units: 6_000_000n,  status: "confirmed", dAgo: 2,  hOff: -2 },
  { key: "kopi-07", m: 0, t: 1, amt: "3.50",  units: 3_500_000n,  status: "confirmed", dAgo: 3,  hOff: -1 },
  { key: "kopi-08", m: 0, t: 0, amt: "7.25",  units: 7_250_000n,  status: "confirmed", dAgo: 5,  hOff: -3 },
  { key: "kopi-09", m: 0, t: 0, amt: "4.75",  units: 4_750_000n,  status: "confirmed", dAgo: 7,  hOff: -2 },
  { key: "kopi-10", m: 0, t: 0, amt: "2.50",  units: 2_500_000n,  status: "failed",    dAgo: 8,  hOff: -1 },
  { key: "kopi-11", m: 0, t: 1, amt: "5.00",  units: 5_000_000n,  status: "confirmed", dAgo: 10, hOff: -2 },
  { key: "kopi-12", m: 0, t: 0, amt: "3.25",  units: 3_250_000n,  status: "confirmed", dAgo: 13, hOff: -4 },
  { key: "kopi-active", m: 0, t: 0, amt: "4.50", units: 4_500_000n, status: "pending", dAgo: 0, hOff: 0, expires: 14 },

  /* BrightMart — mid-size retail */
  { key: "mart-01", m: 1, t: 0, amt: "19.95", units: 19_950_000n, status: "confirmed", dAgo: 0,  hOff: -2 },
  { key: "mart-02", m: 1, t: 1, amt: "35.80", units: 35_800_000n, status: "confirmed", dAgo: 1,  hOff: -3 },
  { key: "mart-03", m: 1, t: 0, amt: "12.50", units: 12_500_000n, status: "confirmed", dAgo: 2,  hOff: -1 },
  { key: "mart-04", m: 1, t: 1, amt: "28.00", units: 28_000_000n, status: "confirmed", dAgo: 4,  hOff: -2 },
  { key: "mart-05", m: 1, t: 0, amt: "9.99",  units: 9_990_000n,  status: "expired",   dAgo: 5,  hOff: -6 },
  { key: "mart-06", m: 1, t: 0, amt: "44.50", units: 44_500_000n, status: "confirmed", dAgo: 6,  hOff: -2 },
  { key: "mart-07", m: 1, t: 1, amt: "22.00", units: 22_000_000n, status: "confirmed", dAgo: 8,  hOff: -1 },
  { key: "mart-08", m: 1, t: 0, amt: "15.75", units: 15_750_000n, status: "cancelled", dAgo: 9,  hOff: -3 },
  { key: "mart-09", m: 1, t: 1, amt: "38.20", units: 38_200_000n, status: "confirmed", dAgo: 11, hOff: -2 },
  { key: "mart-10", m: 1, t: 0, amt: "50.00", units: 50_000_000n, status: "confirmed", dAgo: 13, hOff: -1 },
  { key: "mart-active", m: 1, t: 0, amt: "19.95", units: 19_950_000n, status: "submitted", dAgo: 0, hOff: 0, expires: 8 },

  /* Studio Yoga Senja — larger amounts, membership style */
  { key: "yoga-01", m: 2, t: 0, amt: "25.00", units: 25_000_000n, status: "confirmed", dAgo: 0,  hOff: -4 },
  { key: "yoga-02", m: 2, t: 1, amt: "12.00", units: 12_000_000n, status: "confirmed", dAgo: 2,  hOff: -2 },
  { key: "yoga-03", m: 2, t: 0, amt: "50.00", units: 50_000_000n, status: "confirmed", dAgo: 3,  hOff: -1 },
  { key: "yoga-04", m: 2, t: 1, amt: "25.00", units: 25_000_000n, status: "confirmed", dAgo: 6,  hOff: -3 },
  { key: "yoga-05", m: 2, t: 0, amt: "12.00", units: 12_000_000n, status: "confirmed", dAgo: 10, hOff: -2 },
  { key: "yoga-06", m: 2, t: 1, amt: "75.00", units: 75_000_000n, status: "confirmed", dAgo: 12, hOff: -1 },
  { key: "yoga-07", m: 2, t: 0, amt: "25.00", units: 25_000_000n, status: "cancelled", dAgo: 4,  hOff: -5 },
  { key: "yoga-active", m: 2, t: 0, amt: "12.00", units: 12_000_000n, status: "pending", dAgo: 0, hOff: 0, expires: 12 },

  /* Pasar Digital — irregular, varied amounts */
  { key: "pasar-01", m: 3, t: 0, amt: "8.00",  units: 8_000_000n,  status: "confirmed", dAgo: 1,  hOff: -3 },
  { key: "pasar-02", m: 3, t: 1, amt: "14.50", units: 14_500_000n, status: "confirmed", dAgo: 3,  hOff: -1 },
  { key: "pasar-03", m: 3, t: 0, amt: "22.00", units: 22_000_000n, status: "confirmed", dAgo: 7,  hOff: -4 },
  { key: "pasar-04", m: 3, t: 0, amt: "5.50",  units: 5_500_000n,  status: "failed",    dAgo: 9,  hOff: -2 },
  { key: "pasar-05", m: 3, t: 1, amt: "30.00", units: 30_000_000n, status: "confirmed", dAgo: 11, hOff: -1 },
  { key: "pasar-active", m: 3, t: 0, amt: "8.00", units: 8_000_000n, status: "pending", dAgo: 0, hOff: 0, expires: 13 },

  /* Warp Clothing — larger orders, split beneficiaries */
  { key: "warp-01", m: 4, t: 0, amt: "89.00", units: 89_000_000n, status: "confirmed", dAgo: 0,  hOff: -5 },
  { key: "warp-02", m: 4, t: 1, amt: "45.50", units: 45_500_000n, status: "confirmed", dAgo: 2,  hOff: -2 },
  { key: "warp-03", m: 4, t: 0, amt: "120.00",units: 120_000_000n,status: "confirmed", dAgo: 4,  hOff: -1 },
  { key: "warp-04", m: 4, t: 0, amt: "67.00", units: 67_000_000n, status: "confirmed", dAgo: 6,  hOff: -3 },
  { key: "warp-05", m: 4, t: 1, amt: "33.00", units: 33_000_000n, status: "expired",   dAgo: 8,  hOff: -7 },
  { key: "warp-06", m: 4, t: 0, amt: "95.00", units: 95_000_000n, status: "confirmed", dAgo: 10, hOff: -2 },
  { key: "warp-07", m: 4, t: 1, amt: "55.00", units: 55_000_000n, status: "confirmed", dAgo: 13, hOff: -4 },
  { key: "warp-active", m: 4, t: 0, amt: "89.00", units: 89_000_000n, status: "pending", dAgo: 0, hOff: 0, expires: 15 },
];

/* ─── run ── */
try {
  /* 1 — merchants */
  const createdMerchants = [];
  for (const m of MERCHANTS) {
    createdMerchants.push(
      await prisma.merchant.upsert({
        where: { privyUserId: m.privyUserId },
        update: m,
        create: m,
      })
    );
  }
  console.log(`✓ ${createdMerchants.length} merchants`);

  /* 2 — terminals (2 per merchant) */
  const terminalsByMerchant = [];
  for (const [idx, merchant] of createdMerchants.entries()) {
    const defs = [
      { label: "Cashier Counter", nfcCode: `NFC-${idx + 1}-COUNTER` },
      { label: "Mobile POS",      nfcCode: `NFC-${idx + 1}-MOBILE`  },
    ];
    const row = [];
    for (const t of defs) {
      row.push(
        await prisma.terminal.upsert({
          where: { nfcCode: t.nfcCode },
          update: { merchantId: merchant.id, label: t.label },
          create: { merchantId: merchant.id, label: t.label, nfcCode: t.nfcCode },
        })
      );
    }
    terminalsByMerchant.push(row);
  }
  console.log(`✓ ${terminalsByMerchant.flat().length} terminals`);

  /* 3 — sessions */
  const createdSessions = [];
  for (const fx of SESSION_FIXTURES) {
    const merchant  = createdMerchants[fx.m];
    const terminal  = terminalsByMerchant[fx.m][fx.t];
    const { merchantAmountUsdcUnits, platformAmountUsdcUnits } = split(fx.units, merchant.platformFeeBps);

    const isConfirmed = fx.status === "confirmed" || fx.status === "paid";
    const isSubmitted = fx.status === "submitted";
    const hasTx = isConfirmed || isSubmitted;

    const confirmedAt = isConfirmed ? daysAgo(fx.dAgo, fx.hOff) : null;
    const submittedAt = hasTx       ? daysAgo(fx.dAgo, (fx.hOff ?? 0) + 0.1) : null;
    const expiresAt   = fx.expires != null
      ? minutesFromNow(fx.expires)
      : daysAgo(fx.dAgo - 1);                // historical sessions are already expired by time

    const txSignature = isConfirmed
      ? `mock_tx_${fx.key}_confirmed_${merchant.id.slice(0, 8)}`.padEnd(88, "1")
      : isSubmitted
        ? `mock_tx_${fx.key}_submitted_${merchant.id.slice(0, 8)}`.padEnd(88, "1")
        : null;

    const payerAddr = hasTx ? `Payer${fx.key}`.padEnd(44, "P") : null;

    const session = await prisma.session.upsert({
      where: { sessionSeed: `seed-${fx.key}` },
      update: {
        merchantId: merchant.id,
        terminalId: terminal.id,
        amountUsdc: new Prisma.Decimal(fx.amt),
        amountUsdcUnits: fx.units,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        platformFeeBps: merchant.platformFeeBps,
        status: fx.status,
        payerAddress: payerAddr,
        paidBy: isConfirmed ? payerAddr : null,
        txSignature,
        expiresAt,
        submittedAt,
        confirmedAt,
      },
      create: {
        sessionPda:  `mock-pda-${fx.key}`.padEnd(44, "x"),
        sessionSeed: `seed-${fx.key}`,
        merchantId: merchant.id,
        terminalId: terminal.id,
        amountUsdc: new Prisma.Decimal(fx.amt),
        amountUsdcUnits: fx.units,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        platformFeeBps: merchant.platformFeeBps,
        currency: "USDC",
        sourceChain: "solana",
        settlementChain: "solana",
        tokenMint: USDC_MINT,
        tokenDecimals: 6,
        status: fx.status,
        payerAddress: payerAddr,
        paidBy: isConfirmed ? payerAddr : null,
        txSignature,
        expiresAt,
        submittedAt,
        confirmedAt,
      },
    });

    createdSessions.push({ fx, session, merchantAmountUsdcUnits, platformAmountUsdcUnits, confirmedAt, payerAddr });
  }
  console.log(`✓ ${createdSessions.length} sessions`);

  /* 4 — transactions (only confirmed sessions) */
  let txCount = 0;
  for (const { fx, session, merchantAmountUsdcUnits, platformAmountUsdcUnits, confirmedAt, payerAddr } of createdSessions) {
    const isConfirmed = fx.status === "confirmed" || fx.status === "paid";
    if (!isConfirmed || !session.txSignature) continue;

    await prisma.transaction.upsert({
      where: { txSignature: session.txSignature },
      update: {
        payerAddress: payerAddr,
        amountUsdc: session.amountUsdc,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        confirmedAt: confirmedAt ?? now,
        paidAt: confirmedAt ?? now,
      },
      create: {
        sessionId: session.id,
        txSignature: session.txSignature,
        payerAddress: payerAddr,
        tokenMint: session.tokenMint,
        chain: "solana",
        sourceChain: "solana",
        settlementChain: "solana",
        amountUsdc: session.amountUsdc,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        tokenDecimals: 6,
        splitBreakdown: {
          merchant: merchantAmountUsdcUnits.toString(),
          platform: platformAmountUsdcUnits.toString(),
          feeBps: session.platformFeeBps,
        },
        paidAt: confirmedAt ?? now,
        confirmedAt: confirmedAt ?? now,
      },
    });
    txCount++;
  }
  console.log(`✓ ${txCount} transactions`);

  /* 5 — link active session to first terminal per merchant */
  for (const [mIdx, terminals] of terminalsByMerchant.entries()) {
    const active = createdSessions.find(
      ({ fx }) => fx.m === mIdx && fx.status === "pending"
    );
    await prisma.terminal.update({
      where: { id: terminals[0].id },
      data: { currentSessionId: active?.session.id ?? null },
    });
  }
  console.log("✓ terminal currentSessionId linked");

  /* summary */
  console.log("\n— Seed complete —");
  MERCHANTS.forEach((m, i) => {
    const sessions = SESSION_FIXTURES.filter(f => f.m === i);
    const confirmed = sessions.filter(s => s.status === "confirmed" || s.status === "paid").length;
    console.log(`  ${m.name}: ${sessions.length} sessions, ${confirmed} transactions`);
  });
} finally {
  await prisma.$disconnect();
  await pool.end();
}
