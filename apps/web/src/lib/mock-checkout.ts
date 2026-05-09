export const merchant = {
  name: "Kopi Kita",
  address: "Jl. Kemang Raya No. 8",
  emoji: "☕",
};

export const payment = {
  amounts: {
    USD: "$1.56",
    SOL: "0.0104 SOL",
  },
  network: "Solana",
  txSignature: "5K3r…j9kL",
  date: "May 11, 2025 · 10:41",
};

export type DisplayCurrency = keyof typeof payment.amounts;

export const errorReason = "Wallet approval was rejected";
