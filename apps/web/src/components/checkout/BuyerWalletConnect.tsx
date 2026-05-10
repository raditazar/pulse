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

function useBuyerWalletConnection(onPay?: () => void) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { connectWallet } = useConnectWallet();
  const { wallets: ethereumWallets } = useEthereumWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const ethereumWallet = ethereumWallets[0];
  const solanaWallet = solanaWallets[0];
  const hasPaymentWallet = ethereumWallets.length > 0 || solanaWallets.length > 0;
  const label = ethereumWallet
    ? `${ethereumWallet.meta.name} · ${shortAddress(ethereumWallet.address)}`
    : solanaWallet
      ? `${solanaWallet.standardWallet.name} · ${shortAddress(solanaWallet.address)}`
      : authenticated
        ? "Choose a payment wallet"
        : "Not connected";

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
    onPay?.();
  };

  return {
    ready,
    authenticated,
    hasPaymentWallet,
    hasWallet: Boolean(ethereumWallet || solanaWallet),
    label,
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
  const { ready, hasWallet, label, handleWalletAction } = useBuyerWalletConnection();

  return (
    <button
      type="button"
      onClick={handleWalletAction}
      disabled={!ready}
      aria-label="Connect payment wallet"
      className="focus-ring w-full rounded-control border border-border bg-surface px-3.5 py-3 text-left transition-colors hover:border-purple/40 hover:bg-lavender disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="text-[11px] font-medium text-muted">Wallet</div>
      <div className="mt-1 flex items-center justify-between text-[14px] font-bold text-text">
        <span className={`font-semibold ${hasWallet ? "text-text" : "text-muted"}`}>
          {!ready ? "Loading wallets..." : label}
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

function ConnectedBuyerPaymentAction({ onPay }: { onPay?: () => void }) {
  const { ready, authenticated, hasPaymentWallet, handleWalletAction } = useBuyerWalletConnection(onPay);

  return (
    <PrimaryButton onClick={handleWalletAction} disabled={!ready}>
      {hasPaymentWallet ? "Approve Payment" : authenticated ? "Add Payment Wallet" : "Connect Wallet"}
    </PrimaryButton>
  );
}
