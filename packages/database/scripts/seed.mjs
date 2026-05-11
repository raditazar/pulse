import path from "node:path";
import url from "node:url";
import { config } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const now = new Date();
const minutesFromNow = (minutes) => new Date(now.getTime() + minutes * 60 * 1000);

const merchants = [
  {
    merchantPda: "PulseMockMerchantKopi111111111111111111111111",
    authority: "6x1vVJqV9Nn7T3Q5Yb8uJmYxJd8BvTnLz4hQ3mB2Kp9A",
    primaryBeneficiary: "8yqSxN2gH5jV7mRb9Lk2pQwT4nYc6FzDa1Xe3Pu7HsA",
    name: "Kopi Tepi Jalan",
    walletAddress: "8yqSxN2gH5jV7mRb9Lk2pQwT4nYc6FzDa1Xe3Pu7HsA",
    usdcTokenAccount: "KopiUsdcTokenAcct11111111111111111111111111",
    platformFeeBps: 125,
    splitBasisPoints: 1250,
    splitBeneficiaries: [
      { wallet: "CafeOpsWallet111111111111111111111111111111", bps: 1250, label: "ops" },
    ],
    metadataUri: "pulse://merchant/kopi-tepi-jalan",
  },
  {
    merchantPda: "PulseMockMerchantBrightMart111111111111111111",
    authority: "4KpGZUXW7pE7wqD8fL9rC2xT5vSaM6nBh3QyJ1Vt9RdP",
    primaryBeneficiary: "9FqA2xMh8LrT6cYv4NpK7sJe3WdB1uGz5QnX8Pa2RmV",
    name: "BrightMart Express",
    walletAddress: "9FqA2xMh8LrT6cYv4NpK7sJe3WdB1uGz5QnX8Pa2RmV",
    usdcTokenAccount: "BrightUsdcTokenAcct111111111111111111111111",
    platformFeeBps: 90,
    splitBasisPoints: 900,
    splitBeneficiaries: [
      { wallet: "BrightOpsWallet1111111111111111111111111111", bps: 900, label: "ops" },
    ],
    metadataUri: "pulse://merchant/brightmart-express",
  },
  {
    merchantPda: "PulseMockMerchantYogaSenja111111111111111111",
    authority: "7LdQ9hWz3Bv6YeR2cN8kTaP5mJx4SuF1GgV9pCb2HsL",
    primaryBeneficiary: "5NnR8wPq2Kc7VxZ4jAa9MhT6sYd3LbF1QuE5Gz8WpC",
    name: "Studio Yoga Senja",
    walletAddress: "5NnR8wPq2Kc7VxZ4jAa9MhT6sYd3LbF1QuE5Gz8WpC",
    usdcTokenAccount: "YogaUsdcTokenAcct11111111111111111111111111",
    platformFeeBps: 150,
    splitBasisPoints: 1500,
    splitBeneficiaries: [
      { wallet: "YogaOpsWallet111111111111111111111111111111", bps: 1500, label: "ops" },
    ],
    metadataUri: "pulse://merchant/studio-yoga-senja",
  },
];

const sessionFixtures = [
  { key: "kopi-active", merchant: 0, terminal: 0, amount: "4.50", units: 4_500_000n, status: "pending", expires: 14 },
  { key: "kopi-paid", merchant: 0, terminal: 1, amount: "8.25", units: 8_250_000n, status: "confirmed", expires: 30 },
  { key: "mart-submitted", merchant: 1, terminal: 0, amount: "19.95", units: 19_950_000n, status: "submitted", expires: 8 },
  { key: "mart-expired", merchant: 1, terminal: 1, amount: "3.20", units: 3_200_000n, status: "expired", expires: -20 },
  { key: "yoga-cancelled", merchant: 2, terminal: 0, amount: "12.00", units: 12_000_000n, status: "cancelled", expires: 5 },
  { key: "yoga-paid", merchant: 2, terminal: 1, amount: "25.00", units: 25_000_000n, status: "confirmed", expires: 45 },
];

function split(units, feeBps) {
  const platformAmountUsdcUnits = (units * BigInt(feeBps)) / 10_000n;
  return {
    platformAmountUsdcUnits,
    merchantAmountUsdcUnits: units - platformAmountUsdcUnits,
  };
}

const createdMerchants = [];
const createdTerminals = [];
const createdSessions = [];

try {
  for (const merchant of merchants) {
    createdMerchants.push(
      await prisma.merchant.upsert({
        where: { merchantPda: merchant.merchantPda },
        update: merchant,
        create: merchant,
      })
    );
  }

  for (const [merchantIndex, merchant] of createdMerchants.entries()) {
    const terminals = [
      { label: "Cashier Counter", nfcCode: `NFC-${merchantIndex + 1}-COUNTER` },
      { label: "Mobile POS", nfcCode: `NFC-${merchantIndex + 1}-MOBILE` },
    ];

    createdTerminals[merchantIndex] = [];
    for (const terminal of terminals) {
      createdTerminals[merchantIndex].push(
        await prisma.terminal.upsert({
          where: { nfcCode: terminal.nfcCode },
          update: {
            merchantId: merchant.id,
            label: terminal.label,
          },
          create: {
            merchantId: merchant.id,
            label: terminal.label,
            nfcCode: terminal.nfcCode,
          },
        })
      );
    }
  }

  for (const fixture of sessionFixtures) {
    const merchant = createdMerchants[fixture.merchant];
    const terminal = createdTerminals[fixture.merchant][fixture.terminal];
    const { merchantAmountUsdcUnits, platformAmountUsdcUnits } = split(
      fixture.units,
      merchant.platformFeeBps
    );
    const confirmed = fixture.status === "confirmed";
    const submitted = fixture.status === "submitted";
    const txSignature = confirmed
      ? `mock_tx_${fixture.key}_confirmed_111111111111111111111111111111111111`
      : submitted
        ? `mock_tx_${fixture.key}_submitted_111111111111111111111111111111111`
        : null;

    const session = await prisma.session.upsert({
      where: { sessionSeed: `seed-${fixture.key}` },
      update: {
        merchantId: merchant.id,
        terminalId: terminal.id,
        amountUsdc: new Prisma.Decimal(fixture.amount),
        amountUsdcUnits: fixture.units,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        platformFeeBps: merchant.platformFeeBps,
        status: fixture.status,
        payerAddress: confirmed || submitted ? `Payer${fixture.key}111111111111111111111111111` : null,
        paidBy: confirmed ? `Payer${fixture.key}111111111111111111111111111` : null,
        txSignature,
        expiresAt: minutesFromNow(fixture.expires),
        submittedAt: submitted || confirmed ? minutesFromNow(-4) : null,
        confirmedAt: confirmed ? minutesFromNow(-2) : null,
      },
      create: {
        sessionPda: `mock-session-pda-${fixture.key}`,
        sessionSeed: `seed-${fixture.key}`,
        merchantId: merchant.id,
        terminalId: terminal.id,
        amountUsdc: new Prisma.Decimal(fixture.amount),
        amountUsdcUnits: fixture.units,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        platformFeeBps: merchant.platformFeeBps,
        currency: "USDC",
        sourceChain: "solana",
        settlementChain: "solana",
        tokenMint: process.env.USDC_MINT ?? "MockUsdcMint111111111111111111111111111111",
        tokenDecimals: 6,
        status: fixture.status,
        payerAddress: confirmed || submitted ? `Payer${fixture.key}111111111111111111111111111` : null,
        paidBy: confirmed ? `Payer${fixture.key}111111111111111111111111111` : null,
        txSignature,
        expiresAt: minutesFromNow(fixture.expires),
        submittedAt: submitted || confirmed ? minutesFromNow(-4) : null,
        confirmedAt: confirmed ? minutesFromNow(-2) : null,
      },
    });

    createdSessions.push({ fixture, session, merchantAmountUsdcUnits, platformAmountUsdcUnits });
  }

  for (const { fixture, session, merchantAmountUsdcUnits, platformAmountUsdcUnits } of createdSessions) {
    if (fixture.status !== "confirmed" || !session.txSignature) continue;

    await prisma.transaction.upsert({
      where: { txSignature: session.txSignature },
      update: {
        payerAddress: session.payerAddress,
        amountUsdc: session.amountUsdc,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        confirmedAt: session.confirmedAt ?? now,
        paidAt: session.confirmedAt ?? now,
      },
      create: {
        sessionId: session.id,
        txSignature: session.txSignature,
        payerAddress: session.payerAddress,
        tokenMint: session.tokenMint,
        chain: session.sourceChain,
        sourceChain: session.sourceChain,
        settlementChain: session.settlementChain,
        amountUsdc: session.amountUsdc,
        merchantAmountUsdcUnits,
        platformAmountUsdcUnits,
        tokenDecimals: session.tokenDecimals,
        splitBreakdown: {
          merchant: merchantAmountUsdcUnits.toString(),
          platform: platformAmountUsdcUnits.toString(),
          feeBps: session.platformFeeBps,
        },
        paidAt: session.confirmedAt ?? now,
        confirmedAt: session.confirmedAt ?? now,
      },
    });
  }

  for (const [merchantIndex, terminals] of createdTerminals.entries()) {
    const active = createdSessions.find(
      ({ fixture }) => fixture.merchant === merchantIndex && fixture.status === "pending"
    );
    await prisma.terminal.update({
      where: { id: terminals[0].id },
      data: { currentSessionId: active?.session.id ?? null },
    });
  }

  console.log(`Seeded ${createdMerchants.length} merchants`);
  console.log(`Seeded ${createdTerminals.flat().length} terminals`);
  console.log(`Seeded ${createdSessions.length} sessions`);
  console.log("Seeded confirmed transactions for paid sessions");
} finally {
  await prisma.$disconnect();
  await pool.end();
}
