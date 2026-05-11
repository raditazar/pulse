"use client";

import {
  useConnectWallet,
  useLogin,
  usePrivy,
  useWallets as useEthereumWallets,
} from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { ChevronRight } from "./icons";
import { FieldRow, PrimaryButton } from "./ui";
import { buyerPrivyAppId } from "./PrivyProvider";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function useBuyerWalletConnection(onPay?: (address?: string) => void) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { connectWallet } = useConnectWallet();
  const { wallets: ethereumWallets } = useEthereumWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const ethereumWallet = ethereumWallets[0];
  const solanaWallet = solanaWallets[0];
  const hasPaymentWallet = ethereumWallets.length > 0 || solanaWallets.length > 0;
  const walletName = ethereumWallet?.meta.name ?? solanaWallet?.standardWallet.name;
  const walletAddress = ethereumWallet?.address ?? solanaWallet?.address;
  const label = walletName ?? (authenticated ? "Choose a payment wallet" : "Not connected");

  const handleWalletAction = () => {
    if (!ready) return;
    if (!authenticated) {
      login({
        loginMethods: ["wallet", "email", "google", "passkey"],
        walletChainType: "ethereum-and-solana",
      });
      return;
    }
    if (!hasPaymentWallet) {
      connectWallet({
        walletChainType: "ethereum-and-solana",
      });
      return;
    }
    onPay?.(solanaWallet?.address ?? ethereumWallet?.address);
  };

  return {
    ready,
    authenticated,
    hasPaymentWallet,
    hasWallet: Boolean(ethereumWallet || solanaWallet),
    label,
    walletAddress: walletAddress ? shortAddress(walletAddress) : undefined,
    walletName,
    handleWalletAction,
  };
}

export function BuyerWalletField() {
  if (!buyerPrivyAppId) {
    return (
      <FieldRow label="Wallet">
        <span className="font-semibold text-muted">Privy app ID required</span>
        <span className="text-muted">
          <ChevronRight />
        </span>
      </FieldRow>
    );
  }

  return <ConnectedBuyerWalletField />;
}

function ConnectedBuyerWalletField() {
  const { ready, hasWallet, label, walletAddress, walletName, handleWalletAction } =
    useBuyerWalletConnection();

  return (
    <button
      type="button"
      onClick={handleWalletAction}
      disabled={!ready}
      aria-label="Connect payment wallet"
      className={`focus-ring w-full rounded-control border border-border bg-surface px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
        hasWallet ? "" : "hover:border-purple/40 hover:bg-lavender"
      }`}
    >
      <div className="text-[11px] font-medium text-muted">Wallet</div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[14px] font-bold text-text">
        <span className="min-w-0">
          {hasWallet && ready ? (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold text-text">{walletName}</span>
              <span className="num truncate text-[11px] font-semibold text-muted">
                {walletAddress}
              </span>
            </span>
          ) : (
            <span className="font-semibold text-muted">
              {!ready ? "Loading wallets..." : label}
            </span>
          )}
        </span>
        <span className="text-muted">
          <ChevronRight />
        </span>
      </div>
    </button>
  );
}

export function BuyerPaymentAction({ onPay }: { onPay?: () => void }) {
  if (!buyerPrivyAppId) {
    return <PrimaryButton onClick={onPay}>Connect Wallet</PrimaryButton>;
  }

  return <ConnectedBuyerPaymentAction onPay={onPay} />;
}

function ConnectedBuyerPaymentAction({
  onPay,
}: {
  onPay?: (address?: string) => void;
}) {
  const { ready, authenticated, hasPaymentWallet, handleWalletAction } = useBuyerWalletConnection(onPay);

  return (
    <PrimaryButton onClick={handleWalletAction} disabled={!ready}>
      {hasPaymentWallet ? "Approve Payment" : authenticated ? "Add Payment Wallet" : "Connect Wallet"}
    </PrimaryButton>
  );
}
