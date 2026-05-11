export type Merchant = {
  id: string;
  name: string;
  walletAddress: string;
  usdcTokenAccount: string;
  platformFeeBps: number;
};

export type SessionStatus =
  | "pending"
  | "submitted"
  | "confirmed"
  | "failed"
  | "expired"
  | "cancelled";

export type CheckoutSession = {
  id: string;
  merchantId: string;
  terminalId?: string | null;
  amountUsdcUnits: string;
  merchantAmountUsdcUnits: string;
  platformAmountUsdcUnits: string;
  platformFeeBps: number;
  currency: "USDC";
  sourceChain: string;
  settlementChain: "solana";
  tokenMint: string;
  tokenDecimals: 6;
  status: SessionStatus;
  expiresAt: string;
};

export type SplitPayment = {
  merchantAmountUsdcUnits: string;
  platformAmountUsdcUnits: string;
};

export type Terminal = {
  id: string;
  merchantId: string;
  label: string;
  nfcCode: string;
  currentSessionId?: string | null;
};

