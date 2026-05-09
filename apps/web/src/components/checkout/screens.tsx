"use client";

import {
  CheckIcon,
  ChevronRight,
  CopyIcon,
  CrossIcon,
  LockIcon,
  SolanaStripeMark,
  SolanaTokenGlyph,
  WalletGlyph,
} from "./icons";
import { MerchantCard } from "./MerchantCard";
import { errorReason, merchant, payment, type DisplayCurrency } from "@/lib/mock-checkout";
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
const currencies: DisplayCurrency[] = ["USD", "SOL"];

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
  currency,
  onCurrencyChange,
  onPay,
  onBack,
}: {
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  onPay?: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <BackButton onClick={onBack} />

      <MerchantCard />
      <CurrencyToggle currency={currency} onChange={onCurrencyChange} />

      <FieldRow label="Payment Total" amount>
        <span>{payment.amounts[currency]}</span>
        <span className="text-[12px] font-semibold text-muted">{currency}</span>
      </FieldRow>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldRow label="Network" hint="Fast • Low fees">
          <span>{payment.network}</span>
          <SolanaStripeMark />
        </FieldRow>
        <FieldRow label="Wallet">
          <span className="font-semibold text-muted">Not connected</span>
          <span className="text-muted">
            <ChevronRight />
          </span>
        </FieldRow>
      </div>

      <div className="mt-2 flex flex-col gap-2.5 pt-2">
        <PrimaryButton onClick={onPay}>Connect Wallet</PrimaryButton>
        <AlertInfo>
          <LockIcon size={13} />
          <span>Secure, instant payment on the Solana network.</span>
        </AlertInfo>
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
  currency,
  onDone,
}: {
  currency: DisplayCurrency;
  onDone?: () => void;
}) {
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
        {payment.amounts[currency]}
      </div>

      <div className="mt-2 flex w-full items-center gap-3 rounded-control border border-border bg-surface p-3">
        <div className="grid h-9 w-9 place-items-center rounded-control bg-lavender text-base">
          {merchant.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-text">{merchant.name}</div>
          <div className="text-[11px] text-muted">Solana</div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-muted">{payment.date}</div>
      </div>

      <div className="flex w-full items-center justify-between text-[12px] text-muted">
        <span>Tx Signature</span>
        <span className="num inline-flex items-center gap-1.5 font-semibold text-text">
          {payment.txSignature}
          <span className="grid h-5 w-5 place-items-center rounded bg-bg text-muted">
            <CopyIcon size={10} />
          </span>
        </span>
      </div>

      <PrimaryButton onClick={onDone} className="mt-3">
        Back to Merchant
      </PrimaryButton>
      <button
        type="button"
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
    <div className="inline-grid grid-cols-2 rounded-[10px] border border-border bg-bg-soft p-1">
      {currencies.map((item) => {
        const active = item === currency;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`focus-ring rounded-[8px] px-3 py-2 text-[12px] font-bold transition-colors ${
              active ? "bg-surface text-purple panel-shadow" : "text-muted hover:text-text"
            }`}
            aria-pressed={active}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function ErrorScreen({
  onRetry,
  onBack,
}: {
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
        <div className="mt-0.5 text-[13px] font-semibold text-text">{errorReason}</div>
      </div>

      <div className="flex w-full flex-col gap-2 pt-2">
        <PrimaryButton onClick={onRetry}>Try Again</PrimaryButton>
        <SecondaryButton onClick={onBack}>Back to Merchant</SecondaryButton>
      </div>
    </div>
  );
}
