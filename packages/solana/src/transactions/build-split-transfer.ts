import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

type SplitTransferInput = {
  merchantWallet: string;
  platformWallet: string;
  payerWallet: string;
  merchantLamports: number;
  platformLamports: number;
};

export function buildSplitTransferInstructions({
  merchantWallet,
  platformWallet,
  payerWallet,
  merchantLamports,
  platformLamports,
}: SplitTransferInput): TransactionInstruction[] {
  const payer = new PublicKey(payerWallet);

  return [
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(merchantWallet),
      lamports: merchantLamports,
    }),
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(platformWallet),
      lamports: platformLamports,
    }),
  ];
}

