type SolanaWalletLike = {
  address: string;
  disconnect?: () => Promise<void>;
  standardWallet?: unknown;
};

export function getPreferredSolanaWallet<T extends SolanaWalletLike>(
  wallets: T[],
) {
  return (
    [...wallets].reverse().find((wallet) => !isPrivySolanaWallet(wallet)) ??
    wallets.at(-1)
  );
}

export async function disconnectExternalSolanaWallets<T extends SolanaWalletLike>(
  wallets: T[],
) {
  await Promise.allSettled(
    wallets
      .filter((wallet) => !isPrivySolanaWallet(wallet))
      .map((wallet) => wallet.disconnect?.()),
  );
}

function isPrivySolanaWallet(wallet: SolanaWalletLike) {
  const standardWallet = wallet.standardWallet;
  if (!standardWallet || typeof standardWallet !== "object") return false;
  return "isPrivyWallet" in standardWallet && standardWallet.isPrivyWallet === true;
}
