"use client";

import {
  useConnectWallet,
  useLogin,
  usePrivy,
  useWallets as useEthereumWallets,
  type ConnectedWallet,
} from "@privy-io/react-auth";
import { useWallets as useSolanaWalletsPrivy } from "@privy-io/react-auth/solana";

type ConnectedSolanaWallet = NonNullable<
  ReturnType<typeof useSolanaWalletsPrivy>["wallets"][number]
>;
import { ChevronRight } from "./icons";
import { FieldRow, PrimaryButton } from "./ui";
import { buyerPrivyAppId } from "./PrivyProvider";
import type { CheckoutChainKey } from "@/lib/chain";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function availableChainsFor(
  hasEvm: boolean,
  hasSolana: boolean,
): CheckoutChainKey[] {
  if (hasEvm && hasSolana) return ["solana", "baseSepolia", "arbSepolia"];
  if (hasEvm) return ["baseSepolia", "arbSepolia"];
  if (hasSolana) return ["solana"];
  return [];
}

export interface BuyerWalletConnectionState {
  ready: boolean;
  authenticated: boolean;
  hasPaymentWallet: boolean;
  hasWallet: boolean;
  ethereumWallet: ConnectedWallet | undefined;
  solanaWallet: ConnectedSolanaWallet | undefined;
  availableChains: CheckoutChainKey[];
  label: string;
  walletAddress: string | undefined;
  walletName: string | undefined;
  handleWalletAction: () => void;
}

export function useBuyerWalletConnection(
  onPay?: (address?: string) => void,
): BuyerWalletConnectionState {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { connectWallet } = useConnectWallet();
  const { wallets: ethereumWallets } = useEthereumWallets();
  const { wallets: solanaWallets } = useSolanaWalletsPrivy();
  const ethereumWallet = ethereumWallets[0];
  const solanaWallet = solanaWallets[0];
  const hasPaymentWallet = ethereumWallets.length > 0 || solanaWallets.length > 0;
  // Prioritas EVM dulu kalau dua-duanya connect (default flow cross-chain).
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
    onPay?.(ethereumWallet?.address ?? solanaWallet?.address);
  };

  return {
    ready,
    authenticated,
    hasPaymentWallet,
    hasWallet: Boolean(ethereumWallet || solanaWallet),
    ethereumWallet,
    solanaWallet,
    availableChains: availableChainsFor(Boolean(ethereumWallet), Boolean(solanaWallet)),
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

export function BuyerPaymentAction({
  onPay,
  disabled,
  pendingLabel,
}: {
  onPay?: (address?: string) => void;
  disabled?: boolean;
  pendingLabel?: string;
}) {
  if (!buyerPrivyAppId) {
    return <PrimaryButton onClick={() => onPay?.()}>Connect Wallet</PrimaryButton>;
  }

  return (
    <ConnectedBuyerPaymentAction
      onPay={onPay}
      disabled={disabled}
      pendingLabel={pendingLabel}
    />
  );
}

function ConnectedBuyerPaymentAction({
  onPay,
  disabled,
  pendingLabel,
}: {
  onPay?: (address?: string) => void;
  disabled?: boolean;
  pendingLabel?: string;
}) {
  const { ready, authenticated, hasPaymentWallet, handleWalletAction } =
    useBuyerWalletConnection(onPay);

  const label = pendingLabel
    ? pendingLabel
    : hasPaymentWallet
      ? "Approve Payment"
      : authenticated
        ? "Add Payment Wallet"
        : "Connect Wallet";

  return (
    <PrimaryButton onClick={handleWalletAction} disabled={!ready || disabled}>
      {label}
    </PrimaryButton>
  );
}
