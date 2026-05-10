export const merchant = {
  name: "Kopi Kita",
  address: "Jl. Kemang Raya No. 8",
  emoji: "☕",
};

export const payment = {
  amounts: {
    USD: "$2.50",
    SOL: "0.0167 SOL",
  },
  breakdown: [
    { label: "Amount to merchant", amount: "$2.00" },
    { label: "Bridge fee", amount: "$0.30" },
    { label: "Source chain gas", amount: "$0.20" },
  ],
  total: "$2.50",
  network: "Solana",
  txSignature: "5K3r…j9kL",
  date: "May 11, 2025 · 10:41",
};

export type DisplayCurrency = keyof typeof payment.amounts;

export const errorReason = "Wallet approval was rejected";
