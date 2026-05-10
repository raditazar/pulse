"use client";

import { useState } from "react";
import type { CheckoutSessionResponse } from "@pulse/types";
import { SegmentedToggle } from "@pulse/ui";
import {
  CheckIcon,
  CopyIcon,
  CrossIcon,
  LockIcon,
  SolanaStripeMark,
  SolanaTokenGlyph,
  WalletGlyph,
} from "./icons";
import { BuyerPaymentAction, BuyerWalletField } from "./BuyerWalletConnect";
import { MerchantCard } from "./MerchantCard";
import {
  buildMockTxSignature,
  formatNetworkLabel,
  formatUsdc,
  type DisplayCurrency,
} from "@/lib/mock-checkout";
import {
  AlertInfo,
  BackButton,
  FieldRow,
  PrimaryButton,
  ProgressBar,
  PulseLogoMark,
  ScreenSub,
  ScreenTitle,
  SecondaryButton,
} from "./ui";

const stateIconBase = "mx-auto grid place-items-center rounded-full text-white";
const currencies: DisplayCurrency[] = ["USDC", "SOL"];

function getSessionView(session: CheckoutSessionResponse) {
  const total = Number(session.session.amountUsdc);
  const platformCut = (total * session.merchant.splitBasisPoints) / 10_000;
  const merchantNet = total - platformCut;

  return {
    merchantName: session.merchant.name ?? "Pulse Merchant",
    merchantAddress: `${session.merchant.merchantPda.slice(0, 6)}…${session.merchant.merchantPda.slice(-6)}`,
    networkLabel: formatNetworkLabel(session.cluster),
    totalLabel: formatUsdc(session.session.amountUsdc),
    merchantNetLabel: formatUsdc(merchantNet.toFixed(2)),
    platformLabel: formatUsdc(platformCut.toFixed(2)),
  };
}

function PaymentBreakdown({ session }: { session: CheckoutSessionResponse }) {
  const view = getSessionView(session);
  return (
    <section className="rounded-card border border-border bg-surface px-4 py-4 shadow-[0_18px_32px_-24px_rgba(15,23,42,0.45)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Payment Details</div>
      <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
        <div className="flex items-center justify-between gap-4 text-muted">
          <span>Merchant receives</span>
          <span className="num font-semibold text-text">{view.merchantNetLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-muted">
          <span>Platform split</span>
          <span className="num font-semibold text-text">{view.platformLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-muted">
          <span>Session</span>
          <span className="num font-semibold text-text">
            {session.session.sessionPda.slice(0, 10)}…
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
        <span className="text-[13px] font-bold text-text">Total</span>
        <span className="num text-[28px] font-bold leading-none text-text sm:text-[32px]">
          {view.totalLabel}
        </span>
      </div>
      <div className="mt-4">
        <AlertInfo>
          <LockIcon size={13} />
          <span>Tip: payments are faster and cheaper through the Solana chain.</span>
        </AlertInfo>
      </div>
    </section>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
      <PulseLogoMark />
      <ScreenTitle className="mt-2">Loading payment session...</ScreenTitle>
      <ScreenSub>Fetching merchant details</ScreenSub>
      <div className="w-full max-w-[260px]">
        <ProgressBar value={60} />
      </div>
    </div>
  );
}

export function CheckoutScreen({
  session,
  currency,
  onCurrencyChange,
  onPay,
  onBack,
}: {
  session: CheckoutSessionResponse;
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  onPay?: (address?: string) => void;
  onBack?: () => void;
}) {
  const view = getSessionView(session);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative -mx-5 -mt-5 overflow-hidden rounded-b-[26px] px-5 pt-5 sm:-mx-6 sm:-mt-6 sm:rounded-t-card sm:px-6 sm:pt-6">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 10%, rgba(255,255,255,0.24), transparent 28%), linear-gradient(135deg, #7C3AED 0%, #9945FF 48%, #B871FF 100%)",
          }}
        />
        <div className="relative">
          <BackButton
            onClick={onBack}
            className="text-white/85 hover:bg-white/12 hover:text-white"
          />
          <MerchantCard name={view.merchantName} address={view.merchantAddress} />
        </div>
      </div>

      <div className="relative z-10 -mt-10">
        <PaymentBreakdown session={session} />
      </div>

      <div className="flex flex-1 flex-col gap-3 pt-4">
        <CurrencyToggle currency={currency} onChange={onCurrencyChange} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="Network" hint="Fast • Low fees">
            <span>{view.networkLabel}</span>
            <SolanaStripeMark />
          </FieldRow>
          <BuyerWalletField />
        </div>

        <div className="mt-auto flex flex-col gap-2.5 pt-3">
          <BuyerPaymentAction onPay={onPay} />
        </div>
      </div>
    </div>
  );
}

export function WalletPendingScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <div
          className={`${stateIconBase} h-[120px] w-[120px] border border-border bg-surface text-purple`}
        >
          <WalletGlyph size={62} />
        </div>
        <ScreenTitle>Waiting for wallet approval</ScreenTitle>
        <ScreenSub className="px-4 max-w-[320px]">
          Complete the approval in your wallet app.
        </ScreenSub>
        <AlertInfo variant="muted">
          <span>⏱ Keep this page open</span>
        </AlertInfo>
      </div>
    </div>
  );
}

export function ProcessingScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
        <div
          className="grid h-[68px] w-[68px] place-items-center rounded-[16px]"
          style={{ background: "#0F172A", boxShadow: "0 10px 22px -8px rgba(15,23,42,0.4)" }}
        >
          <SolanaTokenGlyph size={36} />
        </div>
        <ScreenTitle>
          Sending transaction
          <br />
          on Solana...
        </ScreenTitle>
        <ScreenSub>Please wait a moment.</ScreenSub>
        <div className="h-1.5 w-full max-w-[280px] overflow-hidden rounded-pill bg-bg">
          <div className="h-full progress-stripe rounded-pill" style={{ width: "75%" }} />
        </div>
        <AlertInfo variant="muted">
          <span>⚡ Usually takes only a few seconds</span>
        </AlertInfo>
      </div>
    </div>
  );
}

export function SuccessScreen({
  session,
  txSignature = buildMockTxSignature(),
  onDone,
}: {
  session: CheckoutSessionResponse;
  txSignature?: string;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const view = getSessionView(session);

  const handleCopySignature = async () => {
    await navigator.clipboard?.writeText(txSignature);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleOpenSolscan = () => {
    window.open(`https://solscan.io/tx/${txSignature}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-3 py-2">
      <div
        className={`${stateIconBase} mt-3 h-[88px] w-[88px]`}
        style={{
          background: "linear-gradient(135deg, #14F195, #4ADE80)",
          boxShadow: "0 12px 26px -8px rgba(20,241,149,0.5)",
        }}
      >
        <CheckIcon size={40} strokeWidth={3} />
      </div>
      <ScreenTitle className="mt-1">Payment Successful!</ScreenTitle>
      <div className="num text-[22px] font-bold" style={{ color: "var(--color-success)" }}>
        {view.totalLabel}
      </div>

      <div className="mt-2 flex w-full items-center gap-3 rounded-control border border-border bg-surface p-3">
        <div className="grid h-9 w-9 place-items-center rounded-control bg-lavender text-base">
          ☕
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-text">{view.merchantName}</div>
          <div className="text-[11px] text-muted">{view.networkLabel}</div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-muted">Just now</div>
      </div>

      <div className="flex w-full items-center justify-between text-[12px] text-muted">
        <span>Tx Signature</span>
        <button
          type="button"
          onClick={handleCopySignature}
          className="focus-ring num inline-flex items-center gap-1.5 rounded-[6px] font-semibold text-text hover:text-purple"
          aria-label="Copy transaction signature"
        >
          {txSignature}
          <span className="grid h-5 w-5 place-items-center rounded bg-bg text-muted">
            <CopyIcon size={10} />
          </span>
          <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      {copied && <div className="text-[11px] font-semibold text-muted">Signature copied.</div>}

      <PrimaryButton onClick={onDone} className="mt-3">
        Back to Merchant
      </PrimaryButton>
      <button
        type="button"
        onClick={handleOpenSolscan}
        className="focus-ring text-[12px] font-semibold text-purple hover:underline"
      >
        View on Solscan ↗
      </button>
    </div>
  );
}

function CurrencyToggle({
  currency,
  onChange,
}: {
  currency: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
}) {
  return (
    <SegmentedToggle
      options={currencies.map((item) => ({ value: item }))}
      value={currency}
      onChange={onChange}
    />
  );
}

export function ErrorScreen({
  reason = "Wallet approval was rejected",
  onRetry,
  onBack,
}: {
  reason?: string;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 py-2">
      <div
        className={`${stateIconBase} mt-3 h-[88px] w-[88px]`}
        style={{
          background: "linear-gradient(135deg, #F87171, #EF4444)",
          boxShadow: "0 12px 26px -8px rgba(239,68,68,0.45)",
        }}
      >
        <CrossIcon size={36} />
      </div>
      <ScreenTitle className="mt-1">Payment Failed</ScreenTitle>
      <ScreenSub className="px-2 max-w-[320px]">
        Something went wrong while processing the payment. Please try again.
      </ScreenSub>

      <div className="w-full rounded-control border border-border bg-bg p-3">
        <div className="text-[11px] text-muted">Reason</div>
        <div className="mt-0.5 text-[13px] font-semibold text-text">{reason}</div>
      </div>

      <div className="flex w-full flex-col gap-2 pt-2">
        <PrimaryButton onClick={onRetry}>Try Again</PrimaryButton>
        <SecondaryButton onClick={onBack}>Back to Merchant</SecondaryButton>
      </div>
    </div>
  );
}
