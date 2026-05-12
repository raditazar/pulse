"use client";

import { useConnectWallet, useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { getPreferredSolanaWallet } from "@/lib/solana-wallet";
import { CopyIcon } from "./icons";
import { CtaButton, ReadonlyInput } from "./primitives";
import { merchantPrivyAppId } from "./PrivyProvider";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function useMerchantWalletState() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const wallet = getPreferredSolanaWallet(wallets);
  const ownerLabel = user?.email?.address ?? user?.google?.email ?? "Authenticated merchant";

  return {
    authenticated,
    ownerLabel,
    ready,
    wallet,
    walletsReady,
  };
}

export function formatShortAddress(address: string) {
  return shortAddress(address);
}

export function MerchantWalletPanel({ compact = false }: { compact?: boolean }) {
  if (!merchantPrivyAppId) {
    return (
      <div className="rounded-[10px] border border-border bg-bg-soft p-3 text-[11px] leading-relaxed text-muted">
        Set <span className="font-bold text-text">NEXT_PUBLIC_PRIVY_MERCHANT_APP_ID</span> to enable
        merchant email login and Solana wallet connect.
      </div>
    );
  }

  return <ConnectedMerchantWalletPanel compact={compact} />;
}

function ConnectedMerchantWalletPanel({ compact }: { compact: boolean }) {
  const { authenticated, ownerLabel, ready, wallet, walletsReady } = useMerchantWalletState();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { connectWallet } = useConnectWallet();
  const { createWallet } = useCreateWallet();

  const handleLogin = () => {
    login({
      loginMethods: ["email", "google", "passkey", "wallet"],
      walletChainType: "solana-only",
    });
  };

  const handleConnectSolana = () => {
    connectWallet({ walletChainType: "solana-only" });
  };

  const handleCreateEmbedded = async () => {
    await createWallet();
  };

  const handleCopyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard?.writeText(wallet.address);
  };

  if (!ready) {
    return (
      <div className="rounded-[10px] border border-border bg-bg-soft p-3 text-[11px] font-semibold text-muted">
        Loading merchant wallet...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-bg-soft p-3">
        <div>
          <div className="text-[11px] font-bold text-text">Merchant Login</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted">
            Email login or Solana wallets only.
          </div>
        </div>
        <CtaButton className="py-2 text-[11px]" onClick={handleLogin}>
          Connect Wallet
        </CtaButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-bg-soft p-3">
      <div>
        <div className="text-[11px] font-bold text-text">Merchant Wallet</div>
        <div className="mt-0.5 truncate text-[10px] text-muted">
          {ownerLabel}
        </div>
      </div>

      {wallet ? (
        <ReadonlyInput
          mono
          contentClassName={compact ? "truncate" : "break-all leading-relaxed"}
          trailing={
            <button
              type="button"
              onClick={handleCopyWallet}
              className="focus-ring rounded text-muted hover:text-text"
              aria-label="Copy merchant wallet"
            >
              <CopyIcon size={12} />
            </button>
          }
        >
          {compact ? formatShortAddress(wallet.address) : wallet.address}
        </ReadonlyInput>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[11px] text-muted">
          {walletsReady ? "No Solana wallet selected yet." : "Loading Solana wallets..."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {!wallet && (
          <CtaButton className="py-2 text-[11px]" onClick={handleCreateEmbedded}>
            Create Solana Wallet
          </CtaButton>
        )}
        <button
          type="button"
          onClick={handleConnectSolana}
          className="focus-ring rounded-[8px] border border-border bg-surface px-2.5 py-2 text-[11px] font-bold leading-tight text-text hover:text-purple"
        >
          {wallet ? "Switch Solana Wallet" : "Connect Phantom / Solflare"}
        </button>
        <button
          type="button"
          onClick={logout}
          className="focus-ring rounded-[8px] px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-text"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
