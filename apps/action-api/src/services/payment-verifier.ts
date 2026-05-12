import { prisma } from "@pulse/database";
import { PublicKey } from "@solana/web3.js";
import { env, getPlatformUsdcTokenAccount } from "../lib/env";
import { solanaConnection } from "../lib/solana";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

type ParsedTx = NonNullable<
  Awaited<ReturnType<typeof solanaConnection.getParsedTransaction>>
>;

type VerificationResult =
  | {
      status: "confirmed";
      payerAddress: string;
      txSignature: string;
    }
  | {
      status: "submitted";
      reason: string;
    }
  | {
      status: "failed";
      reason: string;
    };

function pubkeyToString(value: unknown) {
  if (value instanceof PublicKey) return value.toBase58();
  if (value && typeof value === "object" && "toBase58" in value) {
    return (value as PublicKey).toBase58();
  }
  return String(value);
}

function transactionCallsProgram(tx: ParsedTx, programId: string) {
  const topLevel = tx.transaction.message.instructions.some(
    (instruction) => pubkeyToString(instruction.programId) === programId
  );

  const inner = tx.meta?.innerInstructions?.some((group) =>
    group.instructions.some(
      (instruction) => pubkeyToString(instruction.programId) === programId
    )
  );

  return topLevel || Boolean(inner);
}

function getFeePayer(tx: ParsedTx) {
  return pubkeyToString(tx.transaction.message.accountKeys[0]?.pubkey);
}

function getAccountAddressByIndex(tx: ParsedTx, accountIndex: number) {
  const account = tx.transaction.message.accountKeys[accountIndex];
  return account ? pubkeyToString(account.pubkey) : null;
}

function getTokenBalanceMap(tx: ParsedTx, side: "pre" | "post") {
  const balances =
    side === "pre" ? tx.meta?.preTokenBalances : tx.meta?.postTokenBalances;
  const map = new Map<string, bigint>();

  for (const balance of balances ?? []) {
    const tokenAccount = getAccountAddressByIndex(tx, balance.accountIndex);
    if (!tokenAccount) continue;

    const amount = BigInt(balance.uiTokenAmount.amount);
    map.set(`${tokenAccount}:${balance.mint}`, amount);
  }

  return map;
}

function getTokenAccountDelta(tx: ParsedTx, tokenAccount: string, mint: string) {
  const key = `${tokenAccount}:${mint}`;
  const pre = getTokenBalanceMap(tx, "pre").get(key) ?? 0n;
  const post = getTokenBalanceMap(tx, "post").get(key) ?? 0n;

  return post - pre;
}

function getAssociatedTokenAddress(mint: string, owner: string) {
  return PublicKey.findProgramAddressSync(
    [
      new PublicKey(owner).toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      new PublicKey(mint).toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0].toBase58();
}

async function markSessionFailed(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: "failed" },
  });
}

export async function verifySmartContractPayment(input: {
  sessionId: string;
  txSignature: string;
  payerAddress: string;
  sourceChain?: string;
  sourceTxHash?: string;
}): Promise<VerificationResult> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { merchant: true },
  });

  if (!session) return { status: "failed", reason: "Session not found" };

  if (session.status === "confirmed") {
    if (session.txSignature === input.txSignature) {
      return {
        status: "confirmed",
        payerAddress: session.payerAddress ?? input.payerAddress,
        txSignature: input.txSignature,
      };
    }

    return {
      status: "failed",
      reason: "Session already confirmed with a different signature",
    };
  }

  if (session.status !== "pending" && session.status !== "submitted") {
    return { status: "failed", reason: `Session status is ${session.status}` };
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "expired" },
    });

    return { status: "failed", reason: "Session expired" };
  }

  if (session.tokenMint !== env.USDC_MINT) {
    return { status: "failed", reason: "Session token mint is not configured USDC mint" };
  }

  const existingSignature = await prisma.transaction.findUnique({
    where: { txSignature: input.txSignature },
  });

  if (existingSignature && existingSignature.sessionId !== session.id) {
    return {
      status: "failed",
      reason: "Transaction signature already used by another session",
    };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      status: "submitted",
      txSignature: input.txSignature,
      payerAddress: input.payerAddress,
      sourceChain: input.sourceChain ?? session.sourceChain,
      sourceTxHash: input.sourceTxHash ?? session.sourceTxHash,
      submittedAt: new Date(),
    },
  });

  const tx = await solanaConnection.getParsedTransaction(input.txSignature, {
    commitment: env.SOLANA_COMMITMENT,
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    return {
      status: "submitted",
      reason: "Settlement transaction not found or not confirmed yet",
    };
  }

  if (tx.meta?.err) {
    await markSessionFailed(session.id);
    return { status: "failed", reason: "Settlement transaction failed on-chain" };
  }

  if (!transactionCallsProgram(tx, env.PULSE_PAYMENT_PROGRAM_ID)) {
    await markSessionFailed(session.id);
    return { status: "failed", reason: "Transaction does not call Pulse program" };
  }

  const feePayer = getFeePayer(tx);
  if (feePayer !== input.payerAddress) {
    await markSessionFailed(session.id);
    return { status: "failed", reason: "Payer address does not match fee payer" };
  }

  const primaryBeneficiaryAta = getAssociatedTokenAddress(
    env.USDC_MINT,
    session.merchant.primaryBeneficiary,
  );
  const merchantDelta = getTokenAccountDelta(tx, primaryBeneficiaryAta, env.USDC_MINT);
  const platformDelta =
    session.platformAmountUsdcUnits > 0n
      ? getTokenAccountDelta(tx, getPlatformUsdcTokenAccount(), env.USDC_MINT)
      : 0n;

  if (merchantDelta !== session.merchantAmountUsdcUnits) {
    await markSessionFailed(session.id);
    return {
      status: "failed",
      reason: "Merchant USDC token delta does not match session",
    };
  }

  if (platformDelta !== session.platformAmountUsdcUnits) {
    await markSessionFailed(session.id);
    return {
      status: "failed",
      reason: "Platform USDC token delta does not match session",
    };
  }

  const confirmedAt = new Date();
  const sourceChain = input.sourceChain ?? session.sourceChain;
  const sourceTxHash = input.sourceTxHash ?? session.sourceTxHash;

  await prisma.$transaction([
    prisma.transaction.upsert({
      where: { txSignature: input.txSignature },
      create: {
        sessionId: session.id,
        txSignature: input.txSignature,
        payerAddress: input.payerAddress,
        sourceChain,
        sourceTxHash,
        settlementChain: "solana",
        merchantAmountUsdcUnits: session.merchantAmountUsdcUnits,
        platformAmountUsdcUnits: session.platformAmountUsdcUnits,
        tokenMint: env.USDC_MINT,
        tokenDecimals: session.tokenDecimals,
        confirmedAt,
      },
      update: {
        payerAddress: input.payerAddress,
        sourceChain,
        sourceTxHash,
        confirmedAt,
      },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: {
        status: "confirmed",
        payerAddress: input.payerAddress,
        sourceChain,
        sourceTxHash,
        txSignature: input.txSignature,
        confirmedAt,
      },
    }),
    ...(session.terminalId
      ? [
          prisma.terminal.updateMany({
            where: {
              id: session.terminalId,
              currentSessionId: session.id,
            },
            data: { currentSessionId: null },
          }),
        ]
      : []),
  ]);

  return {
    status: "confirmed",
    payerAddress: input.payerAddress,
    txSignature: input.txSignature,
  };
}
