export type SolanaCluster = "localnet" | "devnet" | "testnet" | "mainnet-beta";

export type PulseSessionStatus =
  | "pending"
  | "submitted"
  | "confirmed"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
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
  privyUserId: string;
  authority: string;
  email?: string | null;
  businessType?: string | null;
  primaryBeneficiary: string;
  splitBasisPoints: number;
  splitBeneficiaries: SplitBeneficiaryInput[];
  metadataUri?: string | null;
  profilePhotoUrl?: string | null;
  name?: string | null;
  walletAddress: string;
  usdcTokenAccount: string;
  platformFeeBps: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateMerchantInput = {
  privyUserId: string;
  authority: string;
  email?: string;
  businessType?: string;
  primaryBeneficiary: string;
  splitBasisPoints: number;
  name?: string;
  metadataUri?: string;
  profilePhotoUrl?: string;
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
  tokenMint?: string;
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
