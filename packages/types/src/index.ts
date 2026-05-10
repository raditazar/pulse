export type SolanaCluster = "localnet" | "devnet" | "testnet" | "mainnet-beta";

export type PulseSessionStatus =
  | "pending"
  | "paid"
  | "expired"
  | "refunded"
  | "deactivated";

export type SplitBeneficiaryInput = {
  wallet: string;
  bps: number;
  label: string;
};

export type PulseMerchantRecord = {
  id: string;
  merchantPda: string;
  authority: string;
  primaryBeneficiary: string;
  splitBasisPoints: number;
  splitBeneficiaries: SplitBeneficiaryInput[];
  metadataUri?: string | null;
  name?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateMerchantInput = {
  authority: string;
  primaryBeneficiary: string;
  splitBasisPoints: number;
  name?: string;
  metadataUri?: string;
  splitBeneficiaries?: SplitBeneficiaryInput[];
};

export type CreateMerchantResponse = {
  merchant: PulseMerchantRecord;
  programId: string;
  cluster: SolanaCluster;
};

export type PulseSessionRecord = {
  id: string;
  sessionPda: string;
  sessionSeed: string;
  merchantPda: string;
  merchantId?: string | null;
  amountUsdc: string;
  expiresAt: string;
  status: PulseSessionStatus;
  checkoutPath: string;
  createdAt?: string;
  paidBy?: string | null;
};

export type CreateSessionInput = {
  merchantId?: string;
  merchantPda?: string;
  amountUsdc: string;
  expiresAt?: string;
  sessionSeed?: string;
};

export type CreateSessionResponse = {
  session: PulseSessionRecord;
  merchant: PulseMerchantRecord;
  checkoutUrl: string;
  programId: string;
  cluster: SolanaCluster;
};

export type CheckoutSessionResponse = {
  session: PulseSessionRecord;
  merchant: PulseMerchantRecord;
  programId: string;
  cluster: SolanaCluster;
};

export type RecordTransactionInput = {
  sessionPda: string;
  sessionId: string;
  txSignature: string;
  payerAddress: string;
  tokenMint?: string | null;
  chain?: string;
  amountUsdc?: string;
  splitBreakdown?: Record<string, unknown> | null;
};

export type RecordTransactionResponse = {
  success: true;
  transactionId: string;
  txSignature: string;
};

export type MerchantTransactionsResponse = {
  merchant: PulseMerchantRecord;
  transactions: Array<{
    id: string;
    txSignature: string;
    payerAddress: string;
    chain: string;
    tokenMint?: string | null;
    amountUsdc?: string | null;
    splitBreakdown?: string | null;
    paidAt: string;
    sessionPda: string;
    sessionId: string;
  }>;
};
