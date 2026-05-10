"use client";

import { CopyIcon } from "./icons";
import {
  formatShortAddress,
  useMerchantWalletState,
} from "./MerchantWalletPanel";
import { merchantPrivyAppId } from "./PrivyProvider";
import { ReadonlyInput } from "./primitives";

export function MerchantReceivingWalletField({ fallback }: { fallback: string }) {
  const handleCopyFallback = async () => {
    await navigator.clipboard?.writeText(fallback);
  };

  if (!merchantPrivyAppId) {
    return (
      <ReadonlyInput
        mono
        contentClassName="break-all leading-relaxed"
        trailing={
          <button
            type="button"
            onClick={handleCopyFallback}
            className="focus-ring rounded text-muted hover:text-text"
            aria-label="Copy merchant wallet"
          >
            <CopyIcon size={12} />
          </button>
        }
      >
        {fallback}
      </ReadonlyInput>
    );
  }

  return <ConnectedMerchantReceivingWalletField fallback={fallback} />;
}

function ConnectedMerchantReceivingWalletField({ fallback }: { fallback: string }) {
  const { authenticated, ready, wallet, walletsReady } = useMerchantWalletState();
  const value = !ready
    ? "Loading Privy..."
    : wallet
      ? wallet.address
      : authenticated && walletsReady
        ? "No Solana settlement wallet selected"
    : fallback;
  const copyValue = wallet?.address ?? fallback;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(copyValue);
  };

  return (
    <ReadonlyInput
      mono
      contentClassName="break-all leading-relaxed"
      trailing={
        <button
          type="button"
          onClick={handleCopy}
          className="focus-ring rounded text-muted hover:text-text"
          aria-label="Copy merchant wallet"
        >
          <CopyIcon size={12} />
        </button>
      }
    >
      {wallet ? wallet.address : value}
    </ReadonlyInput>
  );
}
