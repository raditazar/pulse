import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";
import { createSolanaConnection, normalizeSessionSeed } from "@pulse/solana";
import type { CheckoutSessionResponse } from "@pulse/types";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

const EXECUTE_SPLIT_PAYMENT_DISCRIMINATOR = Uint8Array.from([
  0xb3, 0xab, 0xf7, 0x43, 0xf3, 0x52, 0x66, 0x8b,
]);

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function createAssociatedTokenAccountIdempotentIx({
  payer,
  ata,
  owner,
  mint,
}: {
  payer: PublicKey;
  ata: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
}) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function usdcAmountToUnits(amountUsdc: string) {
  const [whole, fraction = ""] = amountUsdc.split(".");
  return BigInt(whole || "0") * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

export async function buildSolanaPayTxBytes({
  session,
  payerAddress,
}: {
  session: CheckoutSessionResponse;
  payerAddress: string;
}) {
  const payer = new PublicKey(payerAddress);
  const merchantPda = new PublicKey(session.merchant.merchantPda);
  const sessionPda = new PublicKey(session.session.sessionPda);
  if (!session.session.tokenMint) {
    throw new Error("Payment session is missing token mint");
  }
  const usdcMint = new PublicKey(session.session.tokenMint);
  const primaryBeneficiary = new PublicKey(session.merchant.primaryBeneficiary);
  const programId = new PublicKey(session.programId);

  // Validate the seed locally because malformed legacy sessions would derive an
  // unusable PDA and fail after the wallet popup.
  normalizeSessionSeed(session.session.sessionSeed);

  const payerUsdcAta = getAssociatedTokenAddress(usdcMint, payer);
  const primaryBeneficiaryAta = getAssociatedTokenAddress(usdcMint, primaryBeneficiary);
  const splitAtas = (session.merchant.splitBeneficiaries ?? []).map((split) =>
    getAssociatedTokenAddress(usdcMint, new PublicKey(split.wallet)),
  );

  const remainingAccounts: AccountMeta[] = splitAtas.map((ata) => ({
    pubkey: ata,
    isSigner: false,
    isWritable: true,
  }));

  const connection = createSolanaConnection();
  const merchantInfo = await connection.getAccountInfo(merchantPda, "confirmed");
  if (!merchantInfo) {
    throw new Error(
      "Merchant Solana account is not initialized yet. Open the merchant dashboard, create a new payment session once with the registered merchant wallet, then retry this checkout.",
    );
  }

  const sessionInfo = await connection.getAccountInfo(sessionPda, "confirmed");
  if (!sessionInfo) {
    throw new Error(
      "Payment session is not initialized on Solana yet. Create a fresh payment session from the merchant dashboard, then retry this checkout.",
    );
  }

  const payerUsdcBalance = await connection.getTokenAccountBalance(payerUsdcAta).catch(() => null);
  if (!payerUsdcBalance) {
    throw new Error("Your Solana wallet does not have a Circle devnet USDC token account yet. Get devnet USDC from the faucet, then try again.");
  }

  const requiredUnits = usdcAmountToUnits(session.session.amountUsdc);
  const availableUnits = BigInt(payerUsdcBalance.value.amount);
  if (availableUnits < requiredUnits) {
    throw new Error(
      `Insufficient devnet USDC. Available ${(Number(availableUnits) / 1_000_000).toFixed(2)} USDC, required ${session.session.amountUsdc} USDC.`,
    );
  }

  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentIx({
      payer,
      ata: primaryBeneficiaryAta,
      owner: primaryBeneficiary,
      mint: usdcMint,
    }),
  );

  for (const split of session.merchant.splitBeneficiaries ?? []) {
    tx.add(
      createAssociatedTokenAccountIdempotentIx({
        payer,
        ata: getAssociatedTokenAddress(usdcMint, new PublicKey(split.wallet)),
        owner: new PublicKey(split.wallet),
        mint: usdcMint,
      }),
    );
  }

  tx.add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: merchantPda, isSigner: false, isWritable: false },
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        { pubkey: payerUsdcAta, isSigner: false, isWritable: true },
        { pubkey: usdcMint, isSigner: false, isWritable: false },
        { pubkey: primaryBeneficiaryAta, isSigner: false, isWritable: true },
        { pubkey: primaryBeneficiary, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ...remainingAccounts,
      ],
      data: Buffer.from(EXECUTE_SPLIT_PAYMENT_DISCRIMINATOR),
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = payer;
  tx.recentBlockhash = blockhash;

  const simulation = await connection.simulateTransaction(tx, undefined, false);
  if (simulation.value.err) {
    const logs = (simulation.value.logs ?? []).join("\n");
    throw new Error(`Solana payment simulation failed: ${JSON.stringify(simulation.value.err)}${logs ? `\n${logs}` : ""}`);
  }

  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}
