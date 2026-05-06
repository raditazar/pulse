export type Merchant = {
  id: string;
  name: string;
  walletAddress: string;
  platformFeeBps: number;
};

export type CheckoutSession = {
  id: string;
  merchantId: string;
  amountLamports: number;
  currency: "SOL" | "USDC";
};

export type SplitPayment = {
  merchantAmountLamports: number;
  platformAmountLamports: number;
};

