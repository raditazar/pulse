import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createSolanaConnection } from "@pulse/solana";

export async function requestSolanaDevnetSol(address: string, amountSol = 1) {
  const connection = createSolanaConnection();
  const signature = await connection.requestAirdrop(
    new PublicKey(address),
    Math.round(amountSol * LAMPORTS_PER_SOL),
  );

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature,
      ...latestBlockhash,
    },
    "confirmed",
  );

  return signature;
}
