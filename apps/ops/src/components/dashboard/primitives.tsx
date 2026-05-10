import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SegmentedToggle } from "@pulse/ui";
import { currencies, type DisplayCurrency } from "@/lib/mock-data";

export function Panel({
  children,
  className = "",
  noPadding = false,
}: {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={`flex flex-col rounded-[14px] border border-border bg-surface panel-shadow ${noPadding ? "" : "p-4 sm:p-5"} ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-3">
      <h3 className="text-[14px] font-bold text-text sm:text-[15px]">{title}</h3>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </header>
  );
}

export function ChipVariant({
  variant,
  children,
}: {
  variant: "success" | "processing" | "pending" | "error" | "muted";
  children: ReactNode;
}) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    success: { bg: "var(--color-success-bg)", color: "var(--color-success)", dot: "var(--color-success)" },
    processing: { bg: "var(--color-processing-bg)", color: "var(--color-processing)", dot: "var(--color-processing)" },
    pending: { bg: "var(--color-warn-bg)", color: "var(--color-warn)", dot: "var(--color-warn)" },
    error: { bg: "#FEE2E2", color: "#B91C1C", dot: "#B91C1C" },
    muted: { bg: "var(--color-bg)", color: "var(--color-muted)", dot: "var(--color-muted)" },
  };
  const v = map[variant];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[10px] font-bold"
      style={{ background: v.bg, color: v.color, border: variant === "muted" ? "1px solid var(--color-border)" : undefined }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
      {children}
    </span>
  );
}

export function CtaButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-95 active:opacity-90 ${className}`}
      style={{
        background: "linear-gradient(90deg, #9945FF, #B871FF)",
        boxShadow: "0 6px 18px -8px rgba(153,69,255,0.5)",
      }}
    >
      {children}
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-text/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-4 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.75)]">
        <div className="text-[16px] font-extrabold text-text">{title}</div>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring rounded-[10px] border border-border bg-bg-soft px-4 py-2.5 text-[12px] font-bold text-muted hover:text-text"
          >
            {cancelLabel}
          </button>
          <CtaButton className="py-2.5 text-[12px]" onClick={onConfirm}>
            {confirmLabel}
          </CtaButton>
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold text-muted">{children}</div>;
}

export function ReadonlyInput({
  children,
  mono = false,
  trailing,
  contentClassName = "truncate",
}: {
  children: ReactNode;
  mono?: boolean;
  trailing?: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-2 rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[12px] font-semibold text-text ${mono ? "num text-[11px]" : ""}`}
    >
      <span className={`min-w-0 flex-1 ${contentClassName}`}>{children}</span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </div>
  );
}

export function CurrencyToggle({
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
      size="sm"
    />
  );
}
