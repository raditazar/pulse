import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft, CheckIcon, PulseLogo } from "./icons";

export function PulseLogoMark({ size = 64 }: { size?: number }) {
  return (
    <div
      className="mx-auto grid place-items-center"
      style={{
        width: size,
        height: size,
      }}
    >
      <PulseLogo size={size} />
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={
        "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-3.5 text-[14px] font-bold text-white transition-opacity hover:opacity-95 active:opacity-90 disabled:opacity-60 " +
        className
      }
      style={{
        background: "linear-gradient(90deg, #9945FF, #B871FF)",
        boxShadow: "0 8px 20px -10px rgba(153,69,255,0.55)",
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={
        "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-control border-[1.5px] border-purple bg-surface px-4 py-3 text-[14px] font-bold text-purple transition-colors hover:bg-lavender " +
        className
      }
    >
      {children}
    </button>
  );
}

export function BackButton({
  onClick,
  className = "",
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className={`focus-ring -ml-2 mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-bg-soft ${className}`}
    >
      <ChevronLeft size={16} />
    </button>
  );
}

export function VerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
    >
      <CheckIcon size={10} strokeWidth={3} />
      Verified Merchant
    </span>
  );
}

export function ProgressBar({ value = 60 }: { value?: number }) {
  return (
    <div className="my-4 h-1.5 overflow-hidden rounded-pill bg-bg">
      <div className="h-full rounded-pill progress-stripe" style={{ width: `${value}%` }} />
    </div>
  );
}

export function AlertInfo({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "muted";
}) {
  if (variant === "muted") {
    return (
      <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-control border border-border bg-bg px-3 py-2.5 text-[12px] leading-relaxed text-muted">
        {children}
      </div>
    );
  }
  return (
    <div
      className="inline-flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-[12px] leading-relaxed [&_svg]:shrink-0"
      style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#4338CA" }}
    >
      {children}
    </div>
  );
}

export function FieldRow({
  label,
  children,
  hint,
  amount = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  amount?: boolean;
}) {
  return (
    <div className="rounded-control border border-border bg-surface px-3.5 py-3">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div
        className={`mt-1 flex items-center justify-between font-bold text-text ${amount ? "text-[28px] sm:text-[32px]" : "text-[14px]"}`}
      >
        {children}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function ScreenTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`text-center text-[18px] font-bold leading-tight text-text sm:text-[20px] ${className}`}>
      {children}
    </h1>
  );
}

export function ScreenSub({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-center text-[13px] leading-relaxed text-muted ${className}`}>{children}</p>
  );
}
