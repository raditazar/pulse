"use client";

import { useState } from "react";
import type { CheckoutSessionResponse } from "@pulse/types";
import {
  CopyIcon,
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

function getSessionView(session: CheckoutSessionResponse) {
  const total = Number(session.session.amountUsdc);
  const safeTotal = Number.isFinite(total) ? total : 0;
  const platformCut = (safeTotal * session.merchant.splitBasisPoints) / 10_000;
  const merchantNet = Math.max(0, safeTotal - platformCut);

  return {
    merchantName: session.merchant.name ?? "Pulse Merchant",
    merchantAddress: `${session.merchant.merchantPda.slice(0, 6)}…${session.merchant.merchantPda.slice(-6)}`,
    networkLabel: formatNetworkLabel(session.cluster),
    totalLabel: formatUsdc(safeTotal),
    merchantNetLabel: formatUsdc(merchantNet),
    platformFeeLabel: formatUsdc(platformCut),
  };
}

function PaymentBreakdown({
  session,
}: {
  session: CheckoutSessionResponse;
}) {
  const view = getSessionView(session);
  const breakdown = [
    { label: "Amount to merchant", amount: view.merchantNetLabel },
    { label: "Platform fee", amount: view.platformFeeLabel },
  ];

  return (
    <section className="rounded-card border border-border bg-surface px-4 py-4 shadow-[0_18px_32px_-24px_rgba(15,23,42,0.45)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        Payment Details
      </div>
      <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
        {breakdown.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 text-muted">
            <span>{item.label}</span>
            <span className="num font-semibold text-text">{item.amount}</span>
          </div>
        ))}
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
          <span>This payment is settled in USDC on Solana.</span>
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
  onPay,
  onBack,
}: {
  session: CheckoutSessionResponse;
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
          className={`${stateIconBase} h-[120px] w-[120px] text-white`}
          style={{
            background: "linear-gradient(135deg, #9945FF, #B871FF)",
            boxShadow: "0 18px 36px -18px rgba(153,69,255,0.75)",
          }}
        >
          <div className="grid h-[82px] w-[82px] place-items-center rounded-[24px] bg-white/15 ring-1 ring-white/25">
            <WalletGlyph size={54} />
          </div>
        </div>
        <ScreenTitle>Waiting for wallet approval</ScreenTitle>
        <ScreenSub className="max-w-[320px] px-4">
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
    <div className="flex flex-1 flex-col py-3">
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/checkout-icons/payment-success.png"
            alt="Payment successful"
            className="h-[112px] w-[112px] object-contain"
          />
          <ScreenTitle>Payment Successful!</ScreenTitle>
          <div className="num text-[28px] font-bold leading-none" style={{ color: "var(--color-success)" }}>
            {view.totalLabel}
          </div>
        </div>

        <div className="w-full rounded-card border border-border bg-surface px-4 py-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="grid h-10 w-10 place-items-center rounded-control bg-lavender text-base">
              ☕
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-text">{view.merchantName}</div>
              <div className="text-[11px] text-muted">Paid on {view.networkLabel}</div>
            </div>
            <div className="shrink-0 rounded-pill bg-success-bg px-2 py-1 text-[10px] font-bold text-success">
              Success
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2.5 text-[12px] text-muted">
            <div className="flex items-center justify-between gap-4">
              <span>Total paid</span>
              <span className="num font-bold text-text">{view.totalLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Date</span>
              <span className="text-right font-semibold text-text">Just now</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Tx Signature</span>
              <button
                type="button"
                onClick={handleCopySignature}
                className="focus-ring num inline-flex min-w-0 max-w-[170px] items-center gap-1.5 rounded-[6px] font-semibold text-text hover:text-purple"
                aria-label="Copy transaction signature"
              >
                <span className="truncate">{txSignature}</span>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-bg text-muted">
                  <CopyIcon size={10} />
                </span>
                <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
          {copied && (
            <div className="mt-3 text-center text-[11px] font-semibold text-muted">
              Signature copied.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <PrimaryButton onClick={onDone}>Back to Merchant</PrimaryButton>
        <SecondaryButton onClick={handleOpenSolscan}>View on Solscan</SecondaryButton>
      </div>
    </div>
  );
}

export function ErrorScreen({
  reason = "Wallet approval was rejected",
  session,
  onRetry,
  onBack,
}: {
  reason?: string;
  session?: CheckoutSessionResponse | null;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  const view = session ? getSessionView(session) : null;

  return (
    <div className="flex flex-1 flex-col py-3">
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/checkout-icons/payment-error.png"
            alt="Payment failed"
            className="h-[112px] w-[112px] object-contain"
          />
          <ScreenTitle>Payment Failed</ScreenTitle>
          <ScreenSub className="max-w-[320px]">
            Something went wrong while processing the payment. Please try again.
          </ScreenSub>
        </div>

        <div className="w-full rounded-card border border-border bg-surface px-4 py-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                Reason
              </div>
              <div className="mt-1 text-[14px] font-bold text-text">{reason}</div>
            </div>
            <div className="shrink-0 rounded-pill bg-red-100 px-2 py-1 text-[10px] font-bold text-red-600">
              Failed
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2.5 text-[12px] text-muted">
            <div className="flex items-center justify-between gap-4">
              <span>Merchant</span>
              <span className="font-semibold text-text">{view?.merchantName ?? "Pulse Merchant"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Total</span>
              <span className="num font-bold text-text">{view?.totalLabel ?? "0.00 USDC"}</span>
            </div>
            <div className="rounded-control border border-border bg-bg px-3 py-2 text-center text-[12px] font-semibold text-muted">
              No funds were moved.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex w-full flex-col gap-2">
        <PrimaryButton onClick={onRetry}>Try Again</PrimaryButton>
        <SecondaryButton onClick={onBack}>Back to Merchant</SecondaryButton>
      </div>
    </div>
  );
}
