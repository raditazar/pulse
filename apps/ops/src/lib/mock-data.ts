export const merchant = {
  name: "Corner Coffee",
  emoji: "☕",
  location: "8 Kemang Raya, Jakarta",
  wallet: "7xgY…7Pk3",
  timezone: "Asia/Jakarta (GMT+7)",
};

export const greeting = {
  name: "Alex",
  date: "May 11, 2025",
};

export type DisplayCurrency = "USD" | "SOL";

export const currencies: DisplayCurrency[] = ["USD", "SOL"];

export const statsByCurrency = {
  USD: [
    { label: "Total Volume", value: "$78.13", delta: "+12.5%", deltaUp: true },
    { label: "Total Transactions", value: "42", delta: "+8.2%", deltaUp: true },
    { label: "Successful", value: "39", delta: "93.9%", deltaUp: true, accent: "success" as const },
  ],
  SOL: [
    { label: "Total Volume", value: "0.5209 SOL", delta: "+12.5%", deltaUp: true },
    { label: "Total Transactions", value: "42", delta: "+8.2%", deltaUp: true },
    { label: "Successful", value: "39", delta: "93.9%", deltaUp: true, accent: "success" as const },
  ],
} satisfies Record<DisplayCurrency, { label: string; value: string; delta: string; deltaUp: boolean; accent?: "success" }[]>;

export const volumeChart = {
  points: [
    { day: "Apr 28", usd: 36, sol: 0.24 },
    { day: "Apr 29", usd: 43, sol: 0.29 },
    { day: "Apr 30", usd: 49, sol: 0.33 },
    { day: "May 1", usd: 40, sol: 0.27 },
    { day: "May 2", usd: 59, sol: 0.39 },
    { day: "May 3", usd: 53, sol: 0.35 },
    { day: "May 4", usd: 64, sol: 0.43 },
    { day: "May 5", usd: 39, sol: 0.26 },
    { day: "May 6", usd: 56, sol: 0.37 },
    { day: "May 7", usd: 46, sol: 0.31 },
    { day: "May 8", usd: 76, sol: 0.51 },
    { day: "May 9", usd: 65, sol: 0.43 },
    { day: "May 10", usd: 88, sol: 0.59 },
    { day: "May 11", usd: 81, sol: 0.54 },
  ],
};

export const networkStatus = {
  network: "Solana Devnet",
  status: "Healthy",
  avgConfirmation: "1.2 seconds",
  speedLabel: "Very fast",
};

export type NfcTile = {
  id: string;
  name: string;
  merchant: string;
  status: "active" | "inactive";
  lastTap: string;
  lastTapTone: "success" | "warn" | "muted";
};

export const cashierNfc: NfcTile = {
  id: "A1B2C3",
  name: "Main Cashier NFC",
  merchant: "Corner Coffee",
  status: "active",
  lastTap: "Active session",
  lastTapTone: "success",
};

export type TxStatus = "success" | "failed" | "pending";

export type Transaction = {
  time: string;
  merchant: string;
  amount: Record<DisplayCurrency, string>;
  status: TxStatus;
  wallet: string;
};

export const transactions: Transaction[] = [
  { time: "10:41", merchant: "Corner Coffee", amount: { USD: "$1.56", SOL: "0.0104 SOL" }, status: "success", wallet: "5K3r…j9kL" },
  { time: "10:32", merchant: "Corner Coffee", amount: { USD: "$1.88", SOL: "0.0125 SOL" }, status: "success", wallet: "4GhF…a8mN" },
  { time: "10:21", merchant: "Corner Coffee", amount: { USD: "$0.94", SOL: "0.0063 SOL" }, status: "success", wallet: "3JdZ…k1Pq" },
  { time: "10:15", merchant: "Corner Coffee", amount: { USD: "$3.13", SOL: "0.0209 SOL" }, status: "failed", wallet: "—" },
  { time: "10:02", merchant: "Corner Coffee", amount: { USD: "$1.25", SOL: "0.0083 SOL" }, status: "success", wallet: "2Mnb…z7Xr" },
];

export const createPaymentDefaults = {
  amount: {
    USD: "$3.13",
    SOL: "0.0209 SOL",
  },
  description: "Cappuccino Large",
};
