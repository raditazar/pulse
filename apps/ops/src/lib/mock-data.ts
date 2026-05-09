export const merchant = {
  name: "Kopi Kita",
  emoji: "☕",
  location: "Jl. Kemang Raya No. 8, Jakarta",
  wallet: "7xgY…7Pk3",
  timezone: "Asia/Jakarta (GMT+7)",
};

export const greeting = {
  name: "Andi",
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
  yTicks: {
    USD: ["$95", "$63", "$31"],
    SOL: ["0.63", "0.42", "0.21"],
  },
  // values in chart-y coords (already mapped, lower y = higher value)
  points: [
    { day: "May 5", x: 40, y: 80 },
    { day: "May 6", x: 110, y: 60 },
    { day: "May 7", x: 180, y: 72 },
    { day: "May 8", x: 250, y: 40 },
    { day: "May 9", x: 320, y: 52 },
    { day: "May 10", x: 390, y: 30 },
    { day: "May 11", x: 460, y: 38 },
  ],
};

export const networkStatus = {
  network: "Solana Mainnet",
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

export const nfcTiles: NfcTile[] = [
  {
    id: "A1B2C3",
    name: "Table 1 (NFC #A1B2C3)",
    merchant: "Kopi Kita",
    status: "active",
    lastTap: "Active session",
    lastTapTone: "success",
  },
  {
    id: "D4E5F6",
    name: "Table 2 (NFC #D4E5F6)",
    merchant: "Kopi Kita",
    status: "active",
    lastTap: "Active session",
    lastTapTone: "success",
  },
  {
    id: "G7H8I9",
    name: "Table 3 (NFC #G7H8I9)",
    merchant: "Kopi Kita",
    status: "active",
    lastTap: "Last tap: 10:21",
    lastTapTone: "warn",
  },
  {
    id: "J0K1L2",
    name: "Table 4 (NFC #J0K1L2)",
    merchant: "Kopi Kita",
    status: "inactive",
    lastTap: "Unused",
    lastTapTone: "muted",
  },
];

export type TxStatus = "success" | "failed" | "pending";

export type Transaction = {
  time: string;
  merchant: string;
  amount: Record<DisplayCurrency, string>;
  status: TxStatus;
  wallet: string;
};

export const transactions: Transaction[] = [
  { time: "10:41", merchant: "Kopi Kita", amount: { USD: "$1.56", SOL: "0.0104 SOL" }, status: "success", wallet: "5K3r…j9kL" },
  { time: "10:32", merchant: "Kopi Kita", amount: { USD: "$1.88", SOL: "0.0125 SOL" }, status: "success", wallet: "4GhF…a8mN" },
  { time: "10:21", merchant: "Kopi Kita", amount: { USD: "$0.94", SOL: "0.0063 SOL" }, status: "success", wallet: "3JdZ…k1Pq" },
  { time: "10:15", merchant: "Kopi Kita", amount: { USD: "$3.13", SOL: "0.0209 SOL" }, status: "failed", wallet: "—" },
  { time: "10:02", merchant: "Kopi Kita", amount: { USD: "$1.25", SOL: "0.0083 SOL" }, status: "success", wallet: "2Mnb…z7Xr" },
];

export const createPaymentDefaults = {
  amount: {
    USD: "$3.13",
    SOL: "0.0209 SOL",
  },
  description: "Cappuccino Large",
  selectedSticker: "Table 3 (NFC #A1B2C3)",
};
