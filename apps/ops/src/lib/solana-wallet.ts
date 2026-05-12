type SolanaWalletLike = {
  address: string;
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

function isPrivySolanaWallet(wallet: SolanaWalletLike) {
  const standardWallet = wallet.standardWallet;
  if (!standardWallet || typeof standardWallet !== "object") return false;
  return "isPrivyWallet" in standardWallet && standardWallet.isPrivyWallet === true;
}
